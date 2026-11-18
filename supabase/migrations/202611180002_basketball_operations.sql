begin;

alter table public.events add column region text not null default 'Belum ditentukan' check (char_length(region) between 2 and 150);
alter table public.referees add column region text not null default 'Belum ditentukan' check (char_length(region) between 2 and 150);
alter table public.assignments add column fee_idr integer not null default 0 check (fee_idr between 0 and 100000000);
alter table public.matches add unique (org_id, event_id, id);

create table referee_private.event_referees (
  org_id uuid not null,
  event_id uuid not null,
  referee_id uuid not null,
  primary key (org_id, event_id, referee_id),
  foreign key (org_id, event_id) references public.events(org_id, id),
  foreign key (org_id, referee_id) references public.referees(org_id, id)
);
create index event_referees_person on referee_private.event_referees(referee_id);

create table referee_private.basketball_coaches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  event_id uuid not null,
  match_id uuid,
  referee_id uuid not null,
  assigned_by uuid not null references auth.users(id),
  foreign key (org_id,event_id,referee_id) references referee_private.event_referees(org_id,event_id,referee_id),
  foreign key (org_id,event_id,match_id) references public.matches(org_id,event_id,id),
  unique nulls not distinct (org_id,event_id,match_id,referee_id)
);
create index basketball_coaches_person on referee_private.basketball_coaches(referee_id);

create table referee_private.basketball_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  event_id uuid,
  email text not null check (char_length(email) between 3 and 254),
  token_hash bytea not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid not null references auth.users(id),
  redeemed_by uuid references auth.users(id),
  redeemed_at timestamptz,
  revoked_at timestamptz,
  foreign key (org_id,event_id) references public.events(org_id,id)
);
create index basketball_invites_club on referee_private.basketball_invites(org_id);

create table referee_private.basketball_audit (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id),
  actor uuid not null references auth.users(id),
  action text not null,
  record_id uuid,
  occurred_at timestamptz not null default now()
);
alter table referee_private.event_referees enable row level security;
alter table referee_private.basketball_coaches enable row level security;
alter table referee_private.basketball_invites enable row level security;
alter table referee_private.basketball_audit enable row level security;
revoke all on referee_private.event_referees, referee_private.basketball_coaches,
  referee_private.basketball_invites, referee_private.basketball_audit from public, anon, authenticated;

insert into referee_private.event_referees
select distinct a.org_id, m.event_id, a.referee_id
from public.assignments a join public.matches m on m.org_id=a.org_id and m.id=a.match_id
join public.events e on e.id=m.event_id where e.sport='Bola basket'
on conflict do nothing;

create function referee_private.basketball_can_schedule(o uuid, e uuid, g uuid default null)
returns boolean language sql stable security definer set search_path='' as $$
  select coalesce(referee_private.organization_role(o) in ('organization_admin','super_admin','coordinator'), false)
    or exists (
      select 1 from referee_private.basketball_coaches c join public.referees r on r.id=c.referee_id
      where c.org_id=o and c.event_id=e and (c.match_id is null or c.match_id=g)
        and r.user_id=auth.uid() and r.active
    )
$$;
revoke all on function referee_private.basketball_can_schedule(uuid,uuid,uuid) from public, anon, authenticated;

create function referee_private.basketball_check_overlap(person uuid, game uuid, new_start timestamptz, new_end timestamptz, exclude_game boolean)
returns void language plpgsql stable security definer set search_path='' as $$
declare user_id_value uuid := (select user_id from public.referees where id=person);
begin
  if exists (
    select 1 from (
      select a.referee_id, a.match_id from public.assignments a where a.status in ('pending','accepted','completed')
      union all
      select c.referee_id, c.match_id from referee_private.basketball_coaches c where c.match_id is not null
    ) duties
    join public.matches m on m.id=duties.match_id
    join public.referees r on r.id=duties.referee_id
    where (r.id=person or r.user_id=user_id_value)
      and (not exclude_game or m.id<>game)
      and m.status<>'cancelled' and m.starts_at<new_end and new_start<m.ends_at
  ) then
    raise exception 'Jadwal wasit atau coach bertabrakan.' using errcode='23514';
  end if;
end;
$$;
revoke all on function referee_private.basketball_check_overlap(uuid,uuid,timestamptz,timestamptz,boolean) from public, anon, authenticated;

create function public.basketball_clubs() returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'name',o.name,'role',
    coalesce(referee_private.organization_role(o.id),'guest')) order by o.name), '[]')
  from public.organizations o
  where auth.uid() is not null and (referee_private.organization_role(o.id) is not null or exists (
    select 1 from referee_private.event_referees er join public.referees r on r.id=er.referee_id
    where er.org_id=o.id and r.user_id=auth.uid() and r.active
  ));
$$;

create function public.basketball_workspace(p_org uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  role_name text := coalesce(referee_private.organization_role(p_org),'guest');
  my_ref uuid;
  staff boolean := role_name in ('organization_admin','super_admin','coordinator','finance');
  commission boolean := role_name in ('organization_admin','super_admin');
begin
  select r.id into my_ref from public.referees r where r.org_id=p_org and r.user_id=actor and r.active;
  if actor is null or (role_name='guest' and not exists (
    select 1 from referee_private.event_referees where org_id=p_org and referee_id=my_ref
  )) then raise exception 'Akses pengcab dibatasi.' using errcode='42501'; end if;

  return (
    with eg as (
      select e.id,e.name,e.region,e.starts_on,e.ends_on from public.events e
      where e.org_id=p_org and e.sport='Bola basket' and e.status<>'cancelled'
        and (staff or exists (select 1 from referee_private.event_referees er where er.org_id=p_org and er.event_id=e.id and er.referee_id=my_ref))
    ), mg as (
      select m.id,m.event_id,m.name,m.venue,m.starts_at,m.ends_at,m.status
      from public.matches m join eg on eg.id=m.event_id where m.org_id=p_org
    ), ml as (
      select a.id,a.match_id,a.referee_id,a.position,a.status,
        coalesce(ap.approved_idr,a.fee_idr) fee_idr,
        coalesce((select sum(pa.amount_idr) from public.payment_allocations pa
          join public.payments p on p.org_id=pa.org_id and p.id=pa.payment_id and p.status='recorded'
          where pa.org_id=p_org and pa.approval_id=ap.id),0) paid,
        coalesce(a.referee_id=my_ref,false) mine,ap.id approval_id
      from public.assignments a join mg on mg.id=a.match_id
      left join public.compensation_calculations cc on cc.org_id=a.org_id and cc.assignment_id=a.id
      left join public.compensation_approvals ap on ap.org_id=cc.org_id and ap.calculation_id=cc.id
      where a.org_id=p_org and (staff or (a.referee_id=my_ref and a.status<>'draft') or referee_private.basketball_can_schedule(p_org,mg.event_id,mg.id))
    ), cs as (
      select c.id,c.event_id,c.match_id,c.referee_id,coalesce(c.referee_id=my_ref,false) mine
      from referee_private.basketball_coaches c join eg on eg.id=c.event_id where c.org_id=p_org
    ), rs as (
      select er.event_id,er.referee_id from referee_private.event_referees er join eg on eg.id=er.event_id
      where er.org_id=p_org and (staff or er.referee_id=my_ref or exists (
        select 1 from cs where mine and cs.event_id=er.event_id
      ))
    ), refs as (
      select r.id,r.name,r.region,r.active,coalesce(r.id=my_ref,false) mine,
        (r.user_id is not null and not exists (select 1 from public.organization_memberships om
          where om.org_id=p_org and om.user_id=r.user_id)) event_only
      from public.referees r where r.org_id=p_org and
        (r.id=my_ref or exists (select 1 from rs where rs.referee_id=r.id)
          or exists (select 1 from cs where cs.referee_id=r.id)
          or ((staff or exists (select 1 from cs where mine and cs.match_id is null)) and (r.user_id is null or exists (select 1 from public.organization_memberships om
            where om.org_id=p_org and om.user_id=r.user_id))))
    ), iv as (
      select i.id,i.event_id,i.email,i.expires_at,
        case when i.redeemed_at is not null then 'used' when i.revoked_at is not null then 'revoked'
          when i.expires_at<=now() then 'expired' else 'active' end status
      from referee_private.basketball_invites i where commission and i.org_id=p_org
    ), pl as (
      select p.id,ml.id assignment_id,p.reference,pa.amount_idr amount,p.paid_on
      from ml join public.payment_allocations pa on pa.org_id=p_org and pa.approval_id=ml.approval_id
      join public.payments p on p.org_id=p_org and p.id=pa.payment_id and p.status='recorded'
    )
    select jsonb_build_object(
      'club',(select jsonb_build_object('id',o.id,'name',o.name,'role',role_name) from public.organizations o where o.id=p_org),
      'events',coalesce((select jsonb_agg(eg order by eg.starts_on,eg.name) from eg),'[]'),
      'games',coalesce((select jsonb_agg(mg order by mg.starts_at,mg.id) from mg),'[]'),
      'referees',coalesce((select jsonb_agg(refs order by refs.name) from refs),'[]'),
      'roster',coalesce((select jsonb_agg(rs) from rs),'[]'),
      'coaches',coalesce((select jsonb_agg(cs) from cs),'[]'),
      'assignments',coalesce((select jsonb_agg(to_jsonb(ml)-'approval_id' order by ml.id) from ml),'[]'),
      'invites',coalesce((select jsonb_agg(iv order by iv.expires_at desc) from iv),'[]'),
      'ledger',coalesce((select jsonb_agg(pl order by pl.paid_on desc,pl.id) from pl),'[]')
    )
  );
end;
$$;

create function public.basketball_command(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  o uuid := (p->>'org')::uuid;
  op text := p->>'action';
  role_name text := coalesce(referee_private.organization_role(o),'guest');
  commission boolean := role_name in ('organization_admin','super_admin');
  operator boolean := role_name in ('organization_admin','super_admin','coordinator');
  event_id_value uuid := (p->>'event_id')::uuid;
  match_id_value uuid := (p->>'match_id')::uuid;
  referee_id_value uuid := (p->>'referee_id')::uuid;
  assignment_id_value uuid := (p->>'assignment_id')::uuid;
  event_row public.events;
  game public.matches;
  assignment public.assignments;
  referee_row public.referees;
  record_id uuid;
  token text;
  new_start timestamptz;
  new_end timestamptz;
  calculation_id_value uuid;
  approval_id_value uuid;
  approved integer;
  amount integer;
  balance bigint;
  reference_value text;
  duty record;
begin
  if actor is null or o is null then raise exception 'Masuk untuk melanjutkan.' using errcode='42501'; end if;
  -- A single transaction guard covers schedule writes across club boundaries.
  perform pg_advisory_xact_lock(237116811);
  role_name := coalesce(referee_private.organization_role(o),'guest');
  commission := role_name in ('organization_admin','super_admin');
  operator := role_name in ('organization_admin','super_admin','coordinator');
  if assignment_id_value is not null then
    select * into assignment from public.assignments a where a.org_id=o and a.id=assignment_id_value;
    match_id_value := assignment.match_id;
    referee_id_value := assignment.referee_id;
  end if;
  if match_id_value is not null then
    select * into game from public.matches m where m.org_id=o and m.id=match_id_value;
    if game.id is null or (event_id_value is not null and event_id_value<>game.event_id) then
      raise exception 'Laga tidak tersedia.' using errcode='42501';
    end if;
    event_id_value := game.event_id;
  end if;
  if event_id_value is not null then
    select * into event_row from public.events e
    where e.org_id=o and e.id=event_id_value and e.sport='Bola basket' and e.status<>'cancelled';
    if event_row.id is null then raise exception 'Event tidak tersedia.' using errcode='42501'; end if;
  end if;
  if referee_id_value is not null then
    select * into referee_row from public.referees r where r.org_id=o and r.id=referee_id_value;
  end if;

  case op
    when 'event' then
      if not operator then raise exception 'Hanya pengelola pengcab dapat menambah event.' using errcode='42501'; end if;
      insert into public.events(org_id,name,sport,region,starts_on,ends_on,status)
      values(o,btrim(p->>'name'),'Bola basket',btrim(p->>'region'),(p->>'starts_on')::date,(p->>'ends_on')::date,'published')
      returning id into record_id;
    when 'referee' then
      if not operator then raise exception 'Hanya pengelola pengcab dapat menambah wasit.' using errcode='42501'; end if;
      insert into public.referees(org_id,code,name,region)
      values(o,gen_random_uuid()::text,btrim(p->>'name'),btrim(p->>'region')) returning id into record_id;
    when 'roster' then
      if event_row.id is null or not referee_private.basketball_can_schedule(o,event_row.id,null)
        or referee_row.active is distinct from true or (referee_row.user_id is not null and not exists (
          select 1 from public.organization_memberships om where om.org_id=o and om.user_id=referee_row.user_id
        ) and not exists (select 1 from referee_private.event_referees where org_id=o and event_id=event_row.id and referee_id=referee_row.id))
      then raise exception 'Wasit luar pengcab harus menerima undangan event ini.' using errcode='42501'; end if;
      insert into referee_private.event_referees values(o,event_row.id,referee_row.id) on conflict do nothing;
      record_id := referee_row.id;
    when 'match','reschedule' then
      if event_row.id is null or not referee_private.basketball_can_schedule(o,event_row.id,case when op='reschedule' then game.id end)
        or (op='reschedule' and game.status is distinct from 'scheduled') then
        raise exception 'Akses perubahan jadwal dibatasi.' using errcode='42501';
      end if;
      new_start := (p->>'starts_at')::timestamptz;
      new_end := (p->>'ends_at')::timestamptz;
      if new_start is null or new_end is null or new_start>=new_end or (new_start at time zone 'Asia/Jakarta')::date<event_row.starts_on
        or (new_end at time zone 'Asia/Jakarta')::date>event_row.ends_on
      then raise exception 'Jadwal harus berada di dalam tanggal event.' using errcode='23514'; end if;
      if op='match' then
        insert into public.matches(org_id,event_id,name,venue,starts_at,ends_at)
        values(o,event_row.id,btrim(p->>'name'),btrim(p->>'venue'),new_start,new_end) returning id into record_id;
      else
        for duty in
          select a.referee_id from public.assignments a where a.match_id=game.id and a.status in ('pending','accepted')
          union select c.referee_id from referee_private.basketball_coaches c where c.match_id=game.id
        loop
          perform referee_private.basketball_check_overlap(duty.referee_id,game.id,new_start,new_end,true);
        end loop;
        update public.matches set starts_at=new_start,ends_at=new_end,venue=btrim(p->>'venue') where id=game.id;
        record_id := game.id;
      end if;
    when 'coach','assign' then
      if referee_row.active is distinct from true or event_row.id is null or not exists (
        select 1 from referee_private.event_referees where org_id=o and event_id=event_row.id and referee_id=referee_row.id
      ) then raise exception 'Daftarkan wasit aktif ke event terlebih dahulu.' using errcode='42501'; end if;
      if op='coach' and not commission then raise exception 'Hanya komisi dapat menetapkan coach.' using errcode='42501'; end if;
      if op='assign' and (game.id is null or not referee_private.basketball_can_schedule(o,event_row.id,game.id))
      then raise exception 'Akses penugasan dibatasi.' using errcode='42501'; end if;
      if game.id is not null then
        if game.status<>'scheduled' then raise exception 'Laga harus berstatus terjadwal.' using errcode='23514'; end if;
        perform referee_private.basketball_check_overlap(referee_row.id,game.id,game.starts_at,game.ends_at,false);
      end if;
      if op='coach' then
        insert into referee_private.basketball_coaches(org_id,event_id,match_id,referee_id,assigned_by)
        values(o,event_row.id,game.id,referee_row.id,actor) returning id into record_id;
      else
        if coalesce(p->>'position','') not in ('Crew Chief','Umpire 1','Umpire 2') then
          raise exception 'Posisi wasit tidak valid.' using errcode='23514';
        end if;
        if exists (select 1 from public.assignments a where a.match_id=game.id and a.position=p->>'position' and a.status in ('pending','accepted','completed'))
        then raise exception 'Posisi sudah terisi.' using errcode='23505'; end if;
        insert into public.assignments(org_id,match_id,referee_id,position,status,fee_idr)
        values(o,game.id,referee_row.id,p->>'position','pending',(p->>'fee_idr')::integer)
        on conflict (org_id,match_id,referee_id,position) do update
        set status='pending',fee_idr=excluded.fee_idr where assignments.status in ('cancelled','declined','draft')
        returning id into record_id;
      end if;
    when 'remove_coach' then
      if not commission then raise exception 'Hanya komisi dapat melepas coach.' using errcode='42501'; end if;
      delete from referee_private.basketball_coaches where org_id=o and id=(p->>'coach_id')::uuid returning id into record_id;
    when 'decide' then
      if assignment.status is distinct from 'pending' or game.status is distinct from 'scheduled' or
        referee_row.active is distinct from true or referee_row.user_id is distinct from actor
      then raise exception 'Penugasan ini tidak dapat dikonfirmasi.' using errcode='42501'; end if;
      update public.assignments set status=case when (p->>'accept')::boolean then 'accepted'::public.assignment_status else 'declined'::public.assignment_status end
      where id=assignment.id returning id into record_id;
    when 'cancel' then
      if coalesce(assignment.status::text,'') not in ('pending','accepted') or game.status is distinct from 'scheduled'
        or not referee_private.basketball_can_schedule(o,event_row.id,game.id)
      then raise exception 'Penugasan ini tidak dapat dibatalkan.' using errcode='42501'; end if;
      update public.assignments set status='cancelled' where id=assignment.id returning id into record_id;
    when 'complete' then
      if game.status is distinct from 'scheduled' or not referee_private.basketball_can_schedule(o,event_row.id,game.id)
        or exists (select 1 from public.assignments a join public.referees r on r.id=a.referee_id
          where a.match_id=game.id and a.status='accepted' and r.user_id=actor)
      then raise exception 'Petugas lain harus menyelesaikan laga yang kamu wasiti.' using errcode='42501'; end if;
      update public.matches set status='completed' where id=game.id returning id into record_id;
      update public.assignments set status=case when status='accepted' then 'completed'::public.assignment_status else 'cancelled'::public.assignment_status end
        where match_id=game.id and status in ('accepted','pending');
    when 'pay' then
      if assignment.status is distinct from 'completed' or referee_row.user_id=actor
        or (role_name<>'finance' and not referee_private.basketball_can_schedule(o,event_row.id,game.id))
      then raise exception 'Pembayaran honor ini tidak diizinkan.' using errcode='42501'; end if;
      amount := (p->>'amount')::int;
      reference_value := lower(btrim(p->>'reference'));
      if amount is null or amount<=0 or char_length(coalesce(reference_value,'')) not between 2 and 80
      then raise exception 'Jumlah atau referensi pembayaran tidak valid.' using errcode='23514'; end if;
      insert into public.compensation_calculations(org_id,assignment_id,earned_idr) values(o,assignment.id,assignment.fee_idr)
      on conflict (org_id,assignment_id) do nothing;
      select cc.id,cc.earned_idr into calculation_id_value,approved from public.compensation_calculations cc where cc.org_id=o and cc.assignment_id=assignment.id;
      insert into public.compensation_approvals(org_id,calculation_id,approved_idr,approved_by,snapshot)
      values(o,calculation_id_value,approved,actor,jsonb_build_object('event',event_row.name,'match',game.name,'referee',referee_row.name,'position',assignment.position,'honor_idr',approved))
      on conflict (org_id,calculation_id) do nothing;
      select ap.id,ap.approved_idr into approval_id_value,approved from public.compensation_approvals ap where ap.org_id=o and ap.calculation_id=calculation_id_value;
      select approved-coalesce(sum(pa.amount_idr),0) into balance from public.payment_allocations pa
        join public.payments pp on pp.org_id=pa.org_id and pp.id=pa.payment_id and pp.status='recorded'
        where pa.org_id=o and pa.approval_id=approval_id_value;
      if amount>balance then raise exception 'Jumlah melebihi sisa honor.' using errcode='23514'; end if;
      if exists (select 1 from public.payments pp where pp.org_id=o and lower(btrim(pp.reference))=reference_value)
      then raise exception 'Referensi pembayaran sudah dipakai.' using errcode='23505'; end if;
      insert into public.payments(org_id,reference,paid_on,amount_idr,status)
      values(o,btrim(p->>'reference'),(now() at time zone 'Asia/Jakarta')::date,amount,'recorded') returning id into record_id;
      insert into public.payment_allocations values(o,record_id,approval_id_value,amount);
    when 'invite' then
      if not commission then raise exception 'Hanya komisi dapat membuat undangan.' using errcode='42501'; end if;
      if (p->>'email') is null or char_length(p->>'email')>254 or (p->>'email') !~ '^[^ @]+@[^ @]+[.][^ @]+$'
      then raise exception 'Email undangan tidak valid.' using errcode='23514'; end if;
      token := replace(gen_random_uuid()::text || gen_random_uuid()::text,'-','');
      insert into referee_private.basketball_invites(org_id,event_id,email,token_hash,created_by)
      values(o,event_row.id,lower(btrim(p->>'email')),sha256(convert_to(token,'UTF8')),actor) returning id into record_id;
    when 'revoke_invite' then
      if not commission then raise exception 'Hanya komisi dapat mencabut undangan.' using errcode='42501'; end if;
      update referee_private.basketball_invites set revoked_at=now() where org_id=o and id=(p->>'invite_id')::uuid
        and revoked_at is null and redeemed_at is null returning id into record_id;
    else
      raise exception 'Aksi tidak dikenal.' using errcode='22023';
  end case;
  insert into referee_private.basketball_audit(org_id,actor,action,record_id) values(o,actor,op,record_id);
  return jsonb_build_object('id',record_id,'token',token);
end;
$$;

create function public.basketball_accept_invite(p_token text,p_region text) returns uuid
language plpgsql security definer set search_path='' as $$
declare
  actor uuid := auth.uid();
  invite referee_private.basketball_invites;
  account_email text;
  person_name text;
  ref uuid;
begin
  if actor is null or p_token !~ '^[0-9a-f]{64}$' or char_length(coalesce(btrim(p_region),'')) not between 2 and 150
  then raise exception 'Undangan tidak valid.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(237116811);
  select * into invite from referee_private.basketball_invites where token_hash=sha256(convert_to(p_token,'UTF8')) for update;
  select lower(u.email),left(coalesce(nullif(btrim(p.full_name),''),nullif(btrim(u.raw_user_meta_data->>'full_name'),''),split_part(u.email,'@',1)),150)
    into account_email,person_name
  from auth.users u left join public.profiles p on p.id=u.id where u.id=actor and u.email_confirmed_at is not null;
  if invite.id is null or invite.email is distinct from account_email or invite.revoked_at is not null
     or invite.expires_at<=now() or (invite.redeemed_by is not null and invite.redeemed_by<>actor)
     or (invite.event_id is not null and not exists (select 1 from public.events e where e.id=invite.event_id and e.status<>'cancelled'))
  then raise exception 'Undangan tidak aktif atau email akun tidak cocok.' using errcode='42501'; end if;
  if invite.redeemed_by=actor then return invite.org_id; end if;

  insert into public.profiles(id,full_name) values(actor,person_name) on conflict do nothing;
  insert into public.referees(org_id,user_id,code,name,region)
  values(invite.org_id,actor,gen_random_uuid()::text,person_name,btrim(p_region))
  on conflict(org_id,user_id) do nothing;
  select id into ref from public.referees where org_id=invite.org_id and user_id=actor and active;
  if ref is null then raise exception 'Profil wasit sedang nonaktif.' using errcode='42501'; end if;
  if invite.event_id is null then
    insert into public.organization_memberships(org_id,user_id,role) values(invite.org_id,actor,'referee') on conflict do nothing;
  else
    insert into referee_private.event_referees values(invite.org_id,invite.event_id,ref) on conflict do nothing;
  end if;
  update referee_private.basketball_invites set redeemed_by=actor,redeemed_at=now() where id=invite.id;
  insert into referee_private.basketball_audit(org_id,actor,action,record_id) values(invite.org_id,actor,'accept_invite',invite.id);
  return invite.org_id;
end;
$$;

revoke all on function public.basketball_clubs(),public.basketball_workspace(uuid),public.basketball_command(jsonb),public.basketball_accept_invite(text,text) from public, anon, authenticated;
grant execute on function public.basketball_clubs(),public.basketball_workspace(uuid),public.basketball_command(jsonb),public.basketball_accept_invite(text,text) to authenticated;

commit;
