import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dashboardSchema } from "../lib/dashboard";

const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const migration = new URL(
  "../supabase/migrations/202611180001_foundation.sql",
  import.meta.url,
);

test("PostgreSQL enforces organization boundaries and computes scoped dashboard aggregates", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
  `);
  await db.exec(await readFile(migration, "utf8"));
  await db.exec(`
    insert into auth.users values ('${uid(1)}'), ('${uid(2)}'), ('${uid(3)}'), ('${uid(4)}'), ('${uid(5)}'), ('${uid(6)}'), ('${uid(7)}');
    insert into public.organizations(id, name, slug) values ('${uid(100)}', 'Jakarta', 'jakarta'), ('${uid(101)}', 'Bandung', 'bandung');
    insert into public.organization_memberships values
      ('${uid(100)}', '${uid(1)}', 'organization_admin'), ('${uid(100)}', '${uid(2)}', 'coordinator'),
      ('${uid(100)}', '${uid(3)}', 'finance'), ('${uid(100)}', '${uid(4)}', 'referee'),
      ('${uid(100)}', '${uid(7)}', 'referee'), ('${uid(101)}', '${uid(5)}', 'organization_admin');
    insert into referee_private.platform_admins values ('${uid(6)}');
    insert into public.referees (id, org_id, user_id, code, name) values
      ('${uid(200)}', '${uid(100)}', '${uid(4)}', 'JKT-01', 'Wasit Jakarta'),
      ('${uid(202)}', '${uid(100)}', '${uid(7)}', 'JKT-02', 'Wasit Lain'),
      ('${uid(201)}', '${uid(101)}', null, 'BDG-01', 'Wasit Bandung');
    insert into public.events (id, org_id, name, sport, starts_on, ends_on, status)
    values ('${uid(300)}', '${uid(100)}', 'Liga Uji', 'Sepak bola', '2090-11-01', '2090-11-20', 'published');
    insert into public.matches (id, org_id, event_id, name, venue, starts_at, ends_at, status) values
      ('${uid(400)}', '${uid(100)}', '${uid(300)}', 'Laga Uji', 'Stadion Uji', '2090-11-01T17:00:00Z', '2090-11-01T18:00:00Z', 'completed'),
      ('${uid(401)}', '${uid(100)}', '${uid(300)}', 'Laga Berikutnya', 'Stadion Uji', '2090-11-02T08:00:00Z', '2090-11-02T09:00:00Z', 'scheduled'),
      ('${uid(402)}', '${uid(100)}', '${uid(300)}', 'Draf Pribadi', 'Stadion Uji', '2090-11-02T09:00:00Z', '2090-11-02T10:00:00Z', 'scheduled');
    insert into public.assignments (id, org_id, match_id, referee_id, position, status) values
      ('${uid(500)}', '${uid(100)}', '${uid(400)}', '${uid(200)}', 'Wasit Utama', 'completed'),
      ('${uid(501)}', '${uid(100)}', '${uid(401)}', '${uid(202)}', 'Wasit Utama', 'pending'),
      ('${uid(502)}', '${uid(100)}', '${uid(402)}', '${uid(200)}', 'Wasit Utama', 'draft'),
      ('${uid(503)}', '${uid(100)}', '${uid(400)}', '${uid(202)}', 'Asisten Wasit', 'completed');
    insert into public.compensation_calculations values
      ('${uid(600)}', '${uid(100)}', '${uid(500)}', 85000), ('${uid(601)}', '${uid(100)}', '${uid(503)}', 70000);
    insert into public.compensation_approvals (id, org_id, calculation_id, approved_idr, snapshot) values
      ('${uid(700)}', '${uid(100)}', '${uid(600)}', 85000, '{"ruleVersion":1}'),
      ('${uid(701)}', '${uid(100)}', '${uid(601)}', 70000, '{"ruleVersion":1}');
    insert into public.payments values
      ('${uid(800)}', '${uid(100)}', 'REF-001', '2090-11-03', 70000, 'recorded'),
      ('${uid(801)}', '${uid(100)}', 'REF-002', '2090-11-04', 10000, 'reversed');
    insert into public.payment_allocations values
      ('${uid(100)}', '${uid(800)}', '${uid(700)}', 40000), ('${uid(100)}', '${uid(800)}', '${uid(701)}', 30000),
      ('${uid(100)}', '${uid(801)}', '${uid(700)}', 10000);
  `);

  async function asUser(n: number) {
    await db.exec(
      `reset role; set role authenticated; set request.jwt.claim.sub = '${uid(n)}';`,
    );
  }

  async function summary(org = 100, day = "2090-11-02") {
    const { rows } = await db.query<{ result: unknown }>(
      "select public.dashboard_summary($1, $2, $2) result",
      [uid(org), day],
    );
    return dashboardSchema.parse(rows[0].result);
  }

  await asUser(1);
  const organization = await summary();
  assert.equal(organization.referees, 2);
  assert.equal(organization.completedMatches, 1);
  assert.equal(organization.trend.length, 6);
  assert.equal(organization.upcoming[0].match, "Laga Berikutnya");
  assert.deepEqual(organization.money, {
    earned: 155000,
    approved: 155000,
    paid: 70000,
    outstanding: 85000,
  });
  assert.equal((await summary(100, "2090-11-01")).completedMatches, 0);
  await assert.rejects(summary(101), /Organization access denied/);
  assert.equal(
    (await db.query("select id from public.referees")).rows.length,
    2,
  );
  await assert.rejects(
    db.exec(
      `insert into public.organization_memberships values ('${uid(101)}', '${uid(1)}', 'organization_admin');`,
    ),
    /permission denied/,
  );

  await asUser(2);
  assert.equal((await summary()).money, null);
  assert.equal(
    (await db.query("select * from public.compensation_calculations")).rows
      .length,
    0,
  );

  await asUser(3);
  assert.equal((await summary()).money?.paid, 70000);
  assert.equal(
    (await db.query("select * from public.payments")).rows.length,
    2,
  );
  await assert.rejects(
    db.exec("update public.compensation_approvals set approved_idr = 0;"),
    /permission denied/,
  );

  await asUser(4);
  const personal = await summary();
  assert.deepEqual(personal.money, {
    earned: 85000,
    approved: 85000,
    paid: 40000,
    outstanding: 45000,
  });
  assert.equal(personal.matches, 1);
  assert.equal(personal.referees, 1);
  assert.equal(personal.upcoming.length, 0);
  assert.equal(
    (await db.query("select * from public.payments")).rows.length,
    0,
  );

  await asUser(5);
  assert.equal((await summary(101)).referees, 1);
  await assert.rejects(summary(), /Organization access denied/);

  await asUser(6);
  assert.equal(
    (await db.query("select * from public.my_organizations()")).rows.length,
    2,
  );

  await db.exec("reset role; set role anon;");
  await assert.rejects(summary(), /permission denied/);
  await db.exec("reset role;");
  await assert.rejects(
    db.exec(`insert into public.assignments(org_id, match_id, referee_id, position)
    values ('${uid(100)}', '${uid(400)}', '${uid(201)}', 'Wasit Utama');`),
    /foreign key constraint/,
  );
});
