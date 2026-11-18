import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { demoOps, demoView, redeemDemo, runDemo } from "../lib/operations/demo";
import type { Command, Workspace } from "../lib/operations/model";

const uid = (n: number) =>
  "00000000-0000-4000-8000-" + String(n).padStart(12, "0");

test("demo supports event, roster, invitation, two duties, acceptance and recording pay", () => {
  let state = demoOps();
  const org = state.club.id;
  const event = runDemo(state, "organization_admin", {
    org,
    action: "event",
    name: "Event baru",
    region: "Bandung",
    starts_on: "2090-02-01",
    ends_on: "2090-02-07",
  });
  state = event.state;
  const result = runDemo(state, "organization_admin", {
    org,
    action: "invite",
    event_id: event.id,
    email: "guest@example.test",
  });
  const guest = redeemDemo(
    result.state,
    { [result.id]: result.token! },
    result.token!,
    "Wasit Tamu",
    "guest@example.test",
    "Semarang",
  );
  assert.equal(
    demoView(guest.state, "referee", true, guest.referee_id).events.length,
    1,
  );
  assert.throws(
    () =>
      redeemDemo(
        guest.state,
        { [result.id]: result.token! },
        result.token!,
        "Wasit Tamu",
        "guest@example.test",
        "Semarang",
      ),
    /tidak aktif/,
  );
  const create = (name: string, starts_at: string, ends_at: string) =>
    runDemo(state, "coordinator", {
      org,
      action: "match",
      event_id: event.id,
      name,
      venue: "GOR A",
      starts_at,
      ends_at,
    });
  state = guest.state;
  const first = create(
    "Laga 1",
    "2090-02-02T09:00:00+07:00",
    "2090-02-02T10:00:00+07:00",
  );
  state = first.state;
  const next = create(
    "Laga 2",
    "2090-02-02T10:00:00+07:00",
    "2090-02-02T11:00:00+07:00",
  );
  state = runDemo(next.state, "organization_admin", {
    org,
    action: "coach",
    event_id: event.id,
    match_id: next.id,
    referee_id: guest.referee_id,
  }).state;
  const assignment = runDemo(state, "coordinator", {
    org,
    action: "assign",
    match_id: first.id,
    referee_id: guest.referee_id,
    position: "Crew Chief",
    fee_idr: 150000,
  });
  assert.throws(
    () =>
      runDemo(state, "coordinator", {
        org,
        action: "assign",
        match_id: next.id,
        referee_id: guest.referee_id,
        position: "Crew Chief",
        fee_idr: 150000,
      }),
    /bertabrakan/,
  );
  state = runDemo(
    assignment.state,
    "referee",
    { org, action: "decide", assignment_id: assignment.id, accept: true },
    guest.referee_id,
  ).state;
  state = runDemo(state, "coordinator", {
    org,
    action: "complete",
    match_id: first.id,
  }).state;
  state = runDemo(state, "coordinator", {
    org,
    action: "pay",
    assignment_id: assignment.id,
    amount: 75000,
    reference: "UJI-001",
  }).state;
  assert.equal(state.ledger[0].amount, 75000);
  assert.equal(
    state.assignments.find((a) => a.id === assignment.id)?.paid,
    75000,
  );
});

test("database enforces event-only guest access, game coach scope and an auditable payment ledger", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role authenticated;
    create role anon;
    create schema auth;
    create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to authenticated, anon;
  `);
  for (const filename of [
    "202611180001_foundation.sql",
    "202611180002_basketball_operations.sql",
  ]) {
    const url = new URL("../supabase/migrations/" + filename, import.meta.url);
    await db.exec(await readFile(url, "utf8"));
  }
  const org = uid(30);
  await db.exec(`
    insert into auth.users values
      ('${uid(1)}','admin@example.test',now(),'{"full_name":"Komisi A"}'),
      ('${uid(2)}','guest@example.test',now(),'{"full_name":"Wasit B"}'),
      ('${uid(3)}','other@example.test',now(),'{"full_name":"Wasit C"}'),
      ('${uid(4)}','coord@example.test',now(),'{"full_name":"Koordinator A"}');
    insert into public.organizations(id,name,slug) values ('${org}','Pengcab A','pengcab-a');
    insert into public.organization_memberships values ('${org}','${uid(1)}','organization_admin'),('${org}','${uid(4)}','coordinator');
  `);
  async function asUser(id: number) {
    await db.exec(
      `reset role; set role authenticated; set request.jwt.claim.sub = '${uid(id)}'`,
    );
  }
  async function action(
    command: Omit<Command, "org"> | Record<string, unknown>,
  ) {
    const { rows } = await db.query<{ result: { id: string; token?: string } }>(
      "select public.basketball_command($1::jsonb) result",
      [JSON.stringify({ ...command, org })],
    );
    return rows[0].result;
  }
  async function workspace() {
    const { rows } = await db.query<{ result: Workspace }>(
      "select public.basketball_workspace($1) result",
      [org],
    );
    return rows[0].result;
  }
  async function accept(token: string) {
    await db.query("select public.basketball_accept_invite($1,'Bandung')", [
      token,
    ]);
  }
  await asUser(1);
  const event = await action({
    action: "event",
    name: "Dibuka untuk tamu",
    region: "Jakarta",
    starts_on: "2090-01-01",
    ends_on: "2090-01-03",
  });
  const hidden = await action({
    action: "event",
    name: "Internal pengcab",
    region: "Jakarta",
    starts_on: "2090-01-01",
    ends_on: "2090-01-03",
  });
  const invite = await action({
    action: "invite",
    event_id: event.id,
    email: "guest@example.test",
  });
  const starts = "2090-01-02T09:00:00+07:00";
  const crewGame = await action({
    action: "match",
    event_id: event.id,
    name: "Laga wasit",
    venue: "GOR A",
    starts_at: starts,
    ends_at: "2090-01-02T10:00:00+07:00",
  });
  const coachGame = await action({
    action: "match",
    event_id: event.id,
    name: "Laga coach",
    venue: "GOR A",
    starts_at: "2090-01-02T10:00:00+07:00",
    ends_at: "2090-01-02T11:00:00+07:00",
  });
  await asUser(3);
  await assert.rejects(accept(invite.token!), /email/);
  await assert.rejects(workspace(), /akses/i);
  await asUser(2);
  await accept(invite.token!);
  const guest = await workspace();
  assert.equal(guest.club.role, "guest");
  assert.deepEqual(
    guest.events.map((e) => e.id),
    [event.id],
  );
  const r = guest.referees[0].id;
  await asUser(1);
  await assert.rejects(
    action({ action: "roster", event_id: hidden.id, referee_id: r }),
    /luar pengcab/,
  );
  await action({
    action: "coach",
    event_id: event.id,
    match_id: coachGame.id,
    referee_id: r,
  });
  await asUser(4);
  await assert.rejects(
    action({ action: "coach", event_id: event.id, referee_id: r }),
    /komisi/i,
  );
  await assert.rejects(
    action({
      action: "assign",
      match_id: coachGame.id,
      referee_id: r,
      position: "Crew Chief",
      fee_idr: 150000,
    }),
    /bertabrakan/,
  );
  const a = await action({
    action: "assign",
    match_id: crewGame.id,
    referee_id: r,
    position: "Crew Chief",
    fee_idr: 150000,
  });
  await asUser(2);
  await action({ action: "decide", assignment_id: a.id, accept: true });
  await assert.rejects(
    action({
      action: "reschedule",
      match_id: crewGame.id,
      venue: "GOR B",
      starts_at: starts,
      ends_at: "2090-01-02T10:00:00+07:00",
    }),
    /dibatasi/,
  );
  await assert.rejects(
    action({
      action: "reschedule",
      match_id: coachGame.id,
      venue: "GOR B",
      starts_at: starts,
      ends_at: "2090-01-02T10:30:00+07:00",
    }),
    /bertabrakan/,
  );
  await action({
    action: "reschedule",
    match_id: coachGame.id,
    venue: "GOR B",
    starts_at: "2090-01-02T10:00:00+07:00",
    ends_at: "2090-01-02T11:00:00+07:00",
  });
  await asUser(4);
  await action({ action: "complete", match_id: crewGame.id });
  await action({
    action: "pay",
    assignment_id: a.id,
    amount: 75000,
    reference: "BANK-001",
  });
  await assert.rejects(
    action({
      action: "pay",
      assignment_id: a.id,
      amount: 1000,
      reference: "bank-001",
    }),
    /sudah dipakai/,
  );
  await assert.rejects(
    action({
      action: "pay",
      assignment_id: a.id,
      amount: 75001,
      reference: "BANK-003",
    }),
    /melebihi/,
  );
  await asUser(2);
  assert.equal(
    (await workspace()).assignments.find((x) => x.id === a.id)?.paid,
    75000,
  );
  assert.equal(
    (await workspace()).games.find((x) => x.id === coachGame.id)?.venue,
    "GOR B",
  );
  await assert.rejects(
    action({
      action: "pay",
      assignment_id: a.id,
      amount: 75000,
      reference: "BANK-002",
    }),
    /tidak diizinkan/,
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select 1 from referee_private.basketball_audit where action='pay'",
      )
    ).rows.length,
    1,
  );
});
