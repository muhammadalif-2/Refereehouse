begin;

create schema referee_private;
revoke all on schema referee_private from public;
grant usage on schema referee_private to authenticated;

create type public.organization_role as enum ('organization_admin', 'coordinator', 'finance', 'referee');
create type public.event_status as enum ('draft', 'published', 'cancelled');
create type public.match_status as enum ('scheduled', 'in_progress', 'completed', 'postponed', 'cancelled');
create type public.assignment_status as enum ('draft', 'pending', 'accepted', 'declined', 'completed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 150)
);
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 150),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);
create table public.organization_memberships (
  org_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null,
  primary key (org_id, user_id)
);
create index memberships_user on public.organization_memberships(user_id);
create table referee_private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table referee_private.platform_admins enable row level security;

create table public.referees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  user_id uuid references auth.users(id) on delete set null,
  code text not null,
  name text not null check (char_length(btrim(name)) between 1 and 150),
  active boolean not null default true,
  unique (org_id, id), unique (org_id, user_id), unique (org_id, code)
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  name text not null check (char_length(btrim(name)) between 1 and 160),
  sport text not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  status public.event_status not null default 'draft',
  unique (org_id, id)
);
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  event_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  venue text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status public.match_status not null default 'scheduled',
  foreign key (org_id, event_id) references public.events(org_id, id),
  unique (org_id, id)
);
create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  match_id uuid not null,
  referee_id uuid not null,
  position text not null check (char_length(btrim(position)) between 1 and 100),
  status public.assignment_status not null default 'draft',
  foreign key (org_id, match_id) references public.matches(org_id, id),
  foreign key (org_id, referee_id) references public.referees(org_id, id),
  unique (org_id, id), unique (org_id, match_id, referee_id, position)
);
create index events_dates on public.events(org_id, starts_on, ends_on);
create index matches_dates on public.matches(org_id, starts_at);
create index matches_event on public.matches(org_id, event_id);
create index assignments_referee on public.assignments(org_id, referee_id, status);

-- Read model foundation. Later migrations add policy versions, line items,
-- audited approvals and transaction-only payment recording.
create table public.compensation_calculations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  assignment_id uuid not null,
  earned_idr integer not null check (earned_idr >= 0),
  foreign key (org_id, assignment_id) references public.assignments(org_id, id),
  unique (org_id, id), unique (org_id, assignment_id)
);
create table public.compensation_approvals (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  calculation_id uuid not null,
  approved_idr integer not null check (approved_idr >= 0),
  approved_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  foreign key (org_id, calculation_id) references public.compensation_calculations(org_id, id),
  unique (org_id, id), unique (org_id, calculation_id)
);
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  reference text not null,
  paid_on date not null,
  amount_idr integer not null check (amount_idr > 0),
  status text not null check (status in ('recorded', 'failed', 'reversed')),
  unique (org_id, id), unique (org_id, reference)
);
create table public.payment_allocations (
  org_id uuid not null,
  payment_id uuid not null,
  approval_id uuid not null,
  amount_idr integer not null check (amount_idr > 0),
  primary key (org_id, payment_id, approval_id),
  foreign key (org_id, payment_id) references public.payments(org_id, id),
  foreign key (org_id, approval_id) references public.compensation_approvals(org_id, id)
);
create index payment_allocations_approval on public.payment_allocations(org_id, approval_id);

create function referee_private.organization_role(target uuid) returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when exists (select 1 from referee_private.platform_admins where user_id = (select auth.uid())) then 'super_admin'
    else (select role::text from public.organization_memberships where org_id = target and user_id = (select auth.uid()))
  end
$$;

create function referee_private.own_referee(target uuid, referee uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.referees where org_id = target and id = referee and user_id = (select auth.uid())
  )
$$;

revoke all on all functions in schema referee_private from public, anon, authenticated;
grant execute on function referee_private.organization_role(uuid), referee_private.own_referee(uuid, uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.referees enable row level security;
alter table public.events enable row level security;
alter table public.matches enable row level security;
alter table public.assignments enable row level security;
alter table public.compensation_calculations enable row level security;
alter table public.compensation_approvals enable row level security;
alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;

revoke all on public.profiles, public.organizations, public.organization_memberships, public.referees, public.events,
  public.matches, public.assignments, public.compensation_calculations, public.compensation_approvals,
  public.payments, public.payment_allocations from public, anon, authenticated;
grant select on public.profiles, public.organizations, public.organization_memberships, public.referees, public.events,
  public.matches, public.assignments, public.compensation_calculations, public.compensation_approvals,
  public.payments, public.payment_allocations to authenticated;

create policy profiles_self on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy organizations_member on public.organizations for select to authenticated
using (referee_private.organization_role(id) is not null);
create policy memberships_visible on public.organization_memberships for select to authenticated
using (user_id = (select auth.uid()) or referee_private.organization_role(org_id) in ('super_admin', 'organization_admin'));

create policy referees_visible on public.referees for select to authenticated using (
  referee_private.organization_role(org_id) in ('super_admin', 'organization_admin', 'coordinator', 'finance')
  or (referee_private.organization_role(org_id) = 'referee' and user_id = (select auth.uid()))
);
create policy assignments_visible on public.assignments for select to authenticated using (
  referee_private.organization_role(org_id) in ('super_admin', 'organization_admin', 'coordinator', 'finance')
  or (referee_private.organization_role(org_id) = 'referee' and status <> 'draft'
      and referee_private.own_referee(org_id, referee_id))
);
create policy matches_visible on public.matches for select to authenticated using (
  referee_private.organization_role(org_id) in ('super_admin', 'organization_admin', 'coordinator', 'finance')
  or (referee_private.organization_role(org_id) = 'referee' and exists (
    select 1 from public.assignments a where a.org_id = matches.org_id and a.match_id = matches.id
  ))
);
create policy events_visible on public.events for select to authenticated using (
  referee_private.organization_role(org_id) in ('super_admin', 'organization_admin', 'coordinator', 'finance')
  or (referee_private.organization_role(org_id) = 'referee' and exists (
    select 1 from public.matches m where m.org_id = events.org_id and m.event_id = events.id
  ))
);

create policy calculations_visible on public.compensation_calculations for select to authenticated using (
  referee_private.organization_role(org_id) in ('super_admin', 'organization_admin', 'finance')
  or (referee_private.organization_role(org_id) = 'referee' and exists (
    select 1 from public.assignments a where a.org_id = compensation_calculations.org_id
      and a.id = compensation_calculations.assignment_id and a.status = 'completed'
  ))
);
create policy approvals_visible on public.compensation_approvals for select to authenticated using (
  exists (select 1 from public.compensation_calculations c where c.org_id = compensation_approvals.org_id and c.id = compensation_approvals.calculation_id)
);
create policy allocations_visible on public.payment_allocations for select to authenticated using (
  exists (select 1 from public.compensation_approvals a where a.org_id = payment_allocations.org_id and a.id = payment_allocations.approval_id)
);
-- Referees receive only their allocated total through the summary RPC because
-- a single payment may span multiple referees.
create policy payments_finance on public.payments for select to authenticated using (
  referee_private.organization_role(org_id) in ('super_admin', 'organization_admin', 'finance')
);

create function referee_private.successful_allocations(target uuid)
returns table(approval_id uuid, amount_idr integer)
language sql stable security definer set search_path = ''
as $$
  select pa.approval_id, pa.amount_idr
  from public.payment_allocations pa
  join public.payments p on p.org_id = pa.org_id and p.id = pa.payment_id and p.status = 'recorded'
  join public.compensation_approvals ca on ca.org_id = pa.org_id and ca.id = pa.approval_id
  join public.compensation_calculations cc on cc.org_id = ca.org_id and cc.id = ca.calculation_id
  join public.assignments a on a.org_id = cc.org_id and a.id = cc.assignment_id
  where pa.org_id = target and (
    referee_private.organization_role(target) in ('super_admin', 'organization_admin', 'finance')
    or (referee_private.organization_role(target) = 'referee' and a.status = 'completed'
      and referee_private.own_referee(target, a.referee_id))
  )
$$;
revoke all on function referee_private.successful_allocations(uuid) from public, anon, authenticated;
grant execute on function referee_private.successful_allocations(uuid) to authenticated;

create function public.my_organizations() returns table(id uuid, name text, role text)
language sql stable security invoker set search_path = ''
as $$
  select o.id, o.name, referee_private.organization_role(o.id) from public.organizations o order by o.name, o.id
$$;
revoke all on function public.my_organizations() from public, anon, authenticated;
grant execute on function public.my_organizations() to authenticated;

create function public.dashboard_summary(target_org uuid, date_from date, date_to date) returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  caller_role text := referee_private.organization_role(target_org);
  local_today date := (now() at time zone 'Asia/Jakarta')::date;
  start_at timestamptz;
  end_at timestamptz;
  trend_start date;
  result jsonb;
begin
  if caller_role is null then
    raise exception 'Organization access denied' using errcode = '42501';
  end if;
  if date_from is null or date_to is null or date_from < date '1900-01-01' or date_to > date '2200-12-31'
    or date_to < date_from or date_to - date_from > 366 then
    raise exception 'Invalid date range' using errcode = '22023';
  end if;
  start_at := date_from::timestamp at time zone 'Asia/Jakarta';
  end_at := (date_to + 1)::timestamp at time zone 'Asia/Jakarta';
  trend_start := (date_trunc('month', date_to::timestamp) - interval '5 months')::date;

  with range_events as (
    select e.* from public.events e
    where e.org_id = target_org and e.starts_on <= date_to and e.ends_on >= date_from
  ), range_matches as (
    select m.* from public.matches m
    where m.org_id = target_org and m.starts_at >= start_at and m.starts_at < end_at
  ), range_assignments as (
    select a.*, m.name as match_name, m.venue, m.starts_at, m.event_id, m.status as match_state
    from public.assignments a join range_matches m on m.id = a.match_id
    where a.org_id = target_org
  ), upcoming as (
    select a.id, r.name, e.name as event, a.match_name as match, a.venue,
      to_char(a.starts_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as "startsAt", a.position, a.status
    from range_assignments a
    join public.referees r on r.org_id = a.org_id and r.id = a.referee_id
    join public.events e on e.org_id = a.org_id and e.id = a.event_id
    where a.starts_at >= now() and a.status in ('pending', 'accepted')
      and a.match_state in ('scheduled', 'in_progress') and e.status = 'published'
    order by a.starts_at, a.id limit 30
  ), ongoing as (
    select e.id, e.name,
      (select count(*) from public.matches m where m.org_id = e.org_id and m.event_id = e.id and m.status <> 'cancelled') total,
      (select count(*) from public.matches m where m.org_id = e.org_id and m.event_id = e.id and m.status = 'completed') completed,
      (select count(distinct a.referee_id) from public.assignments a
        join public.matches m on m.org_id = a.org_id and m.id = a.match_id
        where m.org_id = e.org_id and m.event_id = e.id and m.status <> 'cancelled'
          and a.status in ('pending', 'accepted', 'completed')) assigned
    from range_events e where e.status = 'published' and local_today between e.starts_on and e.ends_on
    order by e.name, e.id limit 12
  ), trend_counts as (
    select date_trunc('month', m.starts_at at time zone 'Asia/Jakarta')::date as "month",
      count(*) assigned, count(*) filter (where a.status = 'completed') completed
    from public.matches m join public.assignments a on a.org_id = m.org_id and a.match_id = m.id
    where m.org_id = target_org and (m.starts_at at time zone 'Asia/Jakarta')::date >= trend_start
      and m.starts_at < end_at and a.status <> 'draft' group by 1
  ), trend as (
    select x.month::date as "month", coalesce(t.assigned, 0) assigned, coalesce(t.completed, 0) completed
    from generate_series(trend_start::timestamp, date_to::timestamp, interval '1 month') x(month)
    left join trend_counts t on t.month = x.month::date
  ), financial as (
    select coalesce(sum(c.earned_idr), 0) earned, coalesce(sum(ca.approved_idr), 0) approved,
      coalesce((select sum(p.amount_idr) from referee_private.successful_allocations(target_org) p
        join public.compensation_approvals ap on ap.org_id = target_org and ap.id = p.approval_id
        join public.compensation_calculations cc on cc.org_id = ap.org_id and cc.id = ap.calculation_id
        join range_assignments ra on ra.id = cc.assignment_id and ra.status = 'completed'), 0) paid
    from range_assignments a
    left join public.compensation_calculations c on c.org_id = a.org_id and c.assignment_id = a.id
    left join public.compensation_approvals ca on ca.org_id = c.org_id and ca.calculation_id = c.id
    where a.status = 'completed'
  )
  select jsonb_build_object(
    'referees', (select count(*) from public.referees where org_id = target_org),
    'activeReferees', (select count(*) from public.referees where org_id = target_org and active),
    'events', (select count(*) from range_events),
    'upcomingEvents', (select count(*) from range_events where status = 'published' and starts_on > local_today),
    'ongoingEvents', (select count(*) from range_events where status = 'published' and local_today between starts_on and ends_on),
    'completedEvents', (select count(*) from range_events where status = 'published' and ends_on < local_today),
    'matches', (select count(*) from range_matches),
    'upcomingMatches', (select count(*) from range_matches where status = 'scheduled' and starts_at >= now()),
    'completedMatches', (select count(*) from range_matches where status = 'completed'),
    'assignments', (select count(*) from range_assignments where status <> 'draft'),
    'pending', (select count(*) from range_assignments where status = 'pending'),
    'completedAssignments', (select count(*) from range_assignments where status = 'completed'),
    'money', case when caller_role = 'coordinator' then null else
      (select jsonb_build_object('earned', earned, 'approved', approved, 'paid', paid, 'outstanding', approved - paid) from financial) end,
    'trend', (select coalesce(jsonb_agg(to_jsonb(t) order by t.month), '[]') from trend t),
    'upcoming', (select coalesce(jsonb_agg(to_jsonb(u) order by u."startsAt", u.id), '[]') from upcoming u),
    'ongoing', (select coalesce(jsonb_agg(to_jsonb(o) - 'id' order by o.name, o.id), '[]') from ongoing o)
  ) into result;
  return result;
end
$$;
revoke all on function public.dashboard_summary(uuid, date, date) from public, anon, authenticated;
grant execute on function public.dashboard_summary(uuid, date, date) to authenticated;

commit;
