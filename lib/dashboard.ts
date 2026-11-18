import { z } from "zod";
import type { Role } from "./access";

const count = z.number().int().nonnegative();
const status = z.enum([
  "draft",
  "pending",
  "accepted",
  "declined",
  "completed",
  "cancelled",
]);
const activity = z.object({
  id: z.uuid(),
  name: z.string(),
  event: z.string(),
  match: z.string(),
  venue: z.string(),
  startsAt: z.iso.datetime({ offset: true }),
  position: z.string(),
  status,
});
const eventSummary = z.object({
  name: z.string(),
  total: count,
  completed: count,
  assigned: count,
});
const money = z.object({
  earned: count,
  approved: count,
  paid: count,
  outstanding: count,
});
export const dashboardSchema = z.object({
  referees: count,
  activeReferees: count,
  events: count,
  upcomingEvents: count,
  ongoingEvents: count,
  completedEvents: count,
  matches: count,
  upcomingMatches: count,
  completedMatches: count,
  assignments: count,
  pending: count,
  completedAssignments: count,
  money: money.nullable(),
  trend: z.array(
    z.object({ month: z.iso.date(), assigned: count, completed: count }),
  ),
  upcoming: z.array(activity),
  ongoing: z.array(eventSummary),
});

export type Dashboard = z.infer<typeof dashboardSchema>;
export type Assignment = z.infer<typeof activity>;
export type Viewer = { name: string; role: Role };
export const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});
export const number = new Intl.NumberFormat("id-ID");
