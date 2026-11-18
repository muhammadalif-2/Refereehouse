import type { Assignment, Event, Game, Workspace } from "./model";

export const eventStatuses = {
  upcoming: "Mendatang",
  ongoing: "Berlangsung",
  finished: "Berakhir",
} as const;

export function eventStatus(event: Event, today: string) {
  if (today < event.starts_on) return "upcoming";
  return today > event.ends_on ? "finished" : "ongoing";
}

export function paymentTotals(assignments: Assignment[]) {
  let due = 0;
  let paid = 0;
  for (const assignment of assignments) {
    if (assignment.status !== "completed") continue;
    due += assignment.fee_idr;
    paid += assignment.paid;
  }
  return { due, paid, remaining: Math.max(0, due - paid) };
}

type EventRecord = {
  event: Event;
  games: Game[];
  assignments: Assignment[];
  refereeIds: Set<string>;
  completed: number;
};

export function eventData(workspace: Workspace) {
  const refs = new Map(workspace.referees.map((r) => [r.id, r]));
  const events = new Map<string, EventRecord>(
    workspace.events.map((event) => [
      event.id,
      {
        event,
        games: [],
        assignments: [],
        refereeIds: new Set<string>(),
        completed: 0,
      },
    ]),
  );
  const gameEvents = new Map<string, EventRecord>();
  for (const game of workspace.games) {
    const record = events.get(game.event_id);
    if (!record) continue;
    record.games.push(game);
    if (game.status === "completed") record.completed++;
    gameEvents.set(game.id, record);
  }
  for (const slot of workspace.roster)
    events.get(slot.event_id)?.refereeIds.add(slot.referee_id);
  for (const assignment of workspace.assignments) {
    const record = gameEvents.get(assignment.match_id);
    record?.assignments.push(assignment);
    record?.refereeIds.add(assignment.referee_id);
  }
  return Array.from(events.values(), (record) => ({
    ...record,
    referees: Array.from(record.refereeIds).flatMap((id) => {
      const referee = refs.get(id);
      return referee ? [referee] : [];
    }),
    payment: paymentTotals(record.assignments),
  }));
}

export type EventData = ReturnType<typeof eventData>[number];

export function filterEvents(
  records: EventData[],
  filter: { event?: string; region?: string; from?: string; to?: string },
) {
  return records.filter(
    ({ event }) =>
      (!filter.event || event.id === filter.event) &&
      (!filter.region || event.region === filter.region) &&
      (!filter.from || event.ends_on >= filter.from) &&
      (!filter.to || event.starts_on <= filter.to),
  );
}
