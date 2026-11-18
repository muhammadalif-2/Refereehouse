import { z } from "zod";
import type { Role } from "../access";

const uuid = z.uuid();
const date = z.iso.date();
const time = z.iso.datetime({ offset: true });
const name = z.string().trim().min(2).max(150);
const object = z.object({ org: uuid });
export const positions = ["Crew Chief", "Umpire 1", "Umpire 2"] as const;

export const commandSchema = z.discriminatedUnion("action", [
  object.extend({
    action: z.literal("event"),
    name,
    region: name,
    starts_on: date,
    ends_on: date,
  }),
  object.extend({ action: z.literal("referee"), name, region: name }),
  object.extend({
    action: z.literal("roster"),
    event_id: uuid,
    referee_id: uuid,
  }),
  object.extend({
    action: z.literal("match"),
    event_id: uuid,
    name,
    venue: name,
    starts_at: time,
    ends_at: time,
  }),
  object.extend({
    action: z.literal("reschedule"),
    match_id: uuid,
    venue: name,
    starts_at: time,
    ends_at: time,
  }),
  object.extend({
    action: z.literal("coach"),
    event_id: uuid,
    match_id: uuid.nullable(),
    referee_id: uuid,
  }),
  object.extend({ action: z.literal("remove_coach"), coach_id: uuid }),
  object.extend({
    action: z.literal("assign"),
    match_id: uuid,
    referee_id: uuid,
    position: z.enum(positions),
    fee_idr: z.number().int().min(0).max(100_000_000),
  }),
  object.extend({
    action: z.literal("decide"),
    assignment_id: uuid,
    accept: z.boolean(),
  }),
  object.extend({ action: z.literal("cancel"), assignment_id: uuid }),
  object.extend({ action: z.literal("complete"), match_id: uuid }),
  object.extend({
    action: z.literal("pay"),
    assignment_id: uuid,
    amount: z.number().int().positive().max(100_000_000),
    reference: z.string().trim().min(2).max(80),
  }),
  object.extend({
    action: z.literal("invite"),
    event_id: uuid.nullable(),
    email: z.email().trim().toLowerCase(),
  }),
  object.extend({ action: z.literal("revoke_invite"), invite_id: uuid }),
]);

export type Command = z.infer<typeof commandSchema>;
export type Club = { id: string; name: string; role: Role | "guest" };
export type Event = {
  id: string;
  name: string;
  region: string;
  starts_on: string;
  ends_on: string;
};
export type Referee = {
  id: string;
  name: string;
  region: string;
  active: boolean;
  mine: boolean;
  event_only?: boolean;
};
export type Game = {
  id: string;
  event_id: string;
  name: string;
  venue: string;
  starts_at: string;
  ends_at: string;
  status: string;
};
export type Assignment = {
  id: string;
  match_id: string;
  referee_id: string;
  position: string;
  fee_idr: number;
  paid: number;
  status: string;
  mine: boolean;
};
export type Coach = {
  id: string;
  event_id: string;
  match_id: string | null;
  referee_id: string;
  mine: boolean;
};
export type Invite = {
  id: string;
  event_id: string | null;
  email: string;
  expires_at: string;
  status: string;
};
export type Ledger = {
  id: string;
  assignment_id: string;
  reference: string;
  amount: number;
  paid_on: string;
};
export type Workspace = {
  club: Club;
  events: Event[];
  referees: Referee[];
  games: Game[];
  roster: { event_id: string; referee_id: string }[];
  assignments: Assignment[];
  coaches: Coach[];
  invites: Invite[];
  ledger: Ledger[];
};

export const tokenPattern = /^[0-9a-f]{64}$/;

export function isCommission(role: Club["role"]) {
  return role === "organization_admin" || role === "super_admin";
}

export function isOperator(role: Club["role"]) {
  return isCommission(role) || role === "coordinator";
}

export function canSchedule(
  state: Workspace,
  eventId: string,
  matchId?: string,
) {
  return (
    isOperator(state.club.role) ||
    state.coaches.some(
      (c) =>
        c.mine &&
        c.event_id === eventId &&
        (c.match_id === null || c.match_id === matchId),
    )
  );
}

export function canPay(state: Workspace, game: Game) {
  return (
    state.club.role === "finance" || canSchedule(state, game.event_id, game.id)
  );
}

export function jakartaInput(value: string) {
  return new Date(new Date(value).getTime() + 7 * 60 * 60_000)
    .toISOString()
    .slice(0, 16);
}
