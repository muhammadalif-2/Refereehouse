import { dateShift, todayInJakarta } from "../dates";
import {
  canPay,
  canSchedule,
  isCommission,
  isOperator,
  type Club,
  type Command,
  type Game,
  type Workspace,
} from "./model";

const uid = (n: number) =>
  "00000000-0000-4000-8000-" + String(n).padStart(12, "0");
const person = uid(21);
export function demoOps(): Workspace {
  const today = todayInJakarta();
  const starts = dateShift(today, 1);
  const eventId = uid(1);
  const game = uid(11);
  return {
    club: {
      id: uid(40),
      name: "Pengcab Bola Basket Jakarta",
      role: "organization_admin",
    },
    events: [
      {
        id: eventId,
        name: "Jakarta Basketball Series",
        region: "Jakarta",
        starts_on: today,
        ends_on: dateShift(today, 14),
      },
    ],
    referees: [
      {
        id: person,
        name: "Rizky Pratama",
        region: "Jakarta",
        active: true,
        mine: false,
      },
      {
        id: uid(22),
        name: "Dewi Lestari",
        region: "Bandung",
        active: true,
        mine: false,
      },
      {
        id: uid(23),
        name: "Andi Saputra",
        region: "Bogor",
        active: true,
        mine: false,
      },
    ],
    games: [
      {
        id: game,
        event_id: eventId,
        name: "Garuda vs. Rajawali",
        venue: "GOR Cempaka",
        starts_at: starts + "T14:00:00+07:00",
        ends_at: starts + "T15:30:00+07:00",
        status: "scheduled",
      },
      {
        id: uid(12),
        event_id: eventId,
        name: "Panther vs. Bintang",
        venue: "GOR Cempaka",
        starts_at: starts + "T16:00:00+07:00",
        ends_at: starts + "T17:30:00+07:00",
        status: "scheduled",
      },
    ],
    roster: [person, uid(22), uid(23)].map((referee_id) => ({
      event_id: eventId,
      referee_id,
    })),
    coaches: [
      {
        id: uid(30),
        event_id: eventId,
        match_id: uid(12),
        referee_id: person,
        mine: false,
      },
    ],
    assignments: [
      {
        id: uid(31),
        match_id: game,
        referee_id: person,
        position: "Crew Chief",
        fee_idr: 175000,
        paid: 0,
        status: "pending",
        mine: false,
      },
    ],
    invites: [],
    ledger: [],
  };
}

const active = (status: string) =>
  ["pending", "accepted", "completed"].includes(status);
const overlaps = (a: Game, b: Game) =>
  a.status !== "cancelled" &&
  b.status !== "cancelled" &&
  Date.parse(a.starts_at) < Date.parse(b.ends_at) &&
  Date.parse(b.starts_at) < Date.parse(a.ends_at);

export type DemoInviteTokens = Record<string, string>;

export function demoView(
  original: Workspace,
  role: Club["role"],
  project = true,
  personId = person,
): Workspace {
  const state = structuredClone(original);
  state.club.role = role;
  for (const r of state.referees)
    r.mine = role === "referee" && r.id === personId;
  for (const c of state.coaches)
    c.mine = role === "referee" && c.referee_id === personId;
  for (const a of state.assignments)
    a.mine = role === "referee" && a.referee_id === personId;
  if (role === "referee" && state.referees.some((r) => r.mine && r.event_only))
    state.club.role = "guest";
  if (project && role === "referee") {
    const visible = new Set(
      state.roster
        .filter((r) => r.referee_id === personId)
        .map((r) => r.event_id),
    );
    state.events = state.events.filter((e) => visible.has(e.id));
    state.games = state.games.filter((g) => visible.has(g.event_id));
    state.assignments = state.assignments.filter(
      (a) =>
        a.mine ||
        state.games.some(
          (g) => g.id === a.match_id && canSchedule(state, g.event_id, g.id),
        ),
    );
    state.coaches = state.coaches.filter((c) => visible.has(c.event_id));
    state.roster = state.roster.filter(
      (r) =>
        state.games.some(
          (g) =>
            g.event_id === r.event_id && canSchedule(state, g.event_id, g.id),
        ) || r.referee_id === personId,
    );
    const visiblePeople = new Set([
      personId,
      ...state.roster.map((r) => r.referee_id),
      ...state.coaches.map((c) => c.referee_id),
    ]);
    state.referees = state.referees.filter((r) => visiblePeople.has(r.id));
    state.ledger = state.ledger.filter((l) =>
      state.assignments.some((a) => a.id === l.assignment_id),
    );
  }
  if (project && !isCommission(role)) state.invites = [];
  return state;
}

export function runDemo(
  original: Workspace,
  role: Club["role"],
  command: Command,
  personId?: string,
) {
  const state = demoView(original, role, false, personId);
  const commission = isCommission(role);
  const operator = isOperator(role);
  const require = (
    condition: unknown,
    message = "Akses aksi ini dibatasi.",
  ) => {
    if (!condition) throw new Error(message);
  };
  const game =
    "match_id" in command
      ? state.games.find((g) => g.id === command.match_id)
      : undefined;
  const assignment =
    "assignment_id" in command
      ? state.assignments.find((a) => a.id === command.assignment_id)
      : undefined;
  const event =
    "event_id" in command
      ? state.events.find((e) => e.id === command.event_id)
      : undefined;
  const id = crypto.randomUUID();
  let token: string | undefined;
  function checkPeriod(candidate: Game) {
    const parent = state.events.find((e) => e.id === candidate.event_id);
    const local = (time: string) =>
      new Date(Date.parse(time) + 7 * 3600000).toISOString().slice(0, 10);
    require(parent &&
      Date.parse(candidate.starts_at) < Date.parse(candidate.ends_at) &&
      local(candidate.starts_at) >= parent.starts_on &&
      local(candidate.ends_at) <=
        parent.ends_on, "Jadwal harus berada di dalam tanggal event.");
  }
  function ensureAvailable(
    referee: string,
    candidate: Game,
    allowCurrent = false,
  ) {
    require(!state.assignments.some(
      (a) =>
        a.referee_id === referee &&
        active(a.status) &&
        (!allowCurrent || a.match_id !== candidate.id) &&
        state.games.some((g) => g.id === a.match_id && overlaps(g, candidate)),
    ), "Wasit sudah memiliki jadwal yang bertabrakan.");
    require(!state.coaches.some(
      (c) =>
        c.referee_id === referee &&
        c.match_id &&
        (!allowCurrent || c.match_id !== candidate.id) &&
        state.games.some((g) => g.id === c.match_id && overlaps(g, candidate)),
    ), "Coach sudah memiliki jadwal yang bertabrakan.");
  }
  switch (command.action) {
    case "event":
      require(operator);
      require(command.ends_on >=
        command.starts_on, "Tanggal selesai mendahului tanggal mulai.");
      state.events.push({
        id,
        name: command.name,
        region: command.region,
        starts_on: command.starts_on,
        ends_on: command.ends_on,
      });
      break;
    case "referee":
      require(operator);
      state.referees.push({
        id,
        name: command.name,
        region: command.region,
        active: true,
        mine: false,
      });
      break;
    case "roster":
      require(operator || Boolean(event && canSchedule(state, event.id)));
      require(event &&
        state.referees.some(
          (r) => r.id === command.referee_id && r.active && !r.event_only,
        ), "Wasit tamu memerlukan undangan untuk event ini.");
      if (
        !state.roster.some(
          (r) =>
            r.event_id === command.event_id &&
            r.referee_id === command.referee_id,
        )
      )
        state.roster.push({
          event_id: command.event_id,
          referee_id: command.referee_id,
        });
      break;
    case "match": {
      require(event && canSchedule(state, event.id));
      const candidate = {
        id,
        event_id: command.event_id,
        name: command.name,
        venue: command.venue,
        starts_at: command.starts_at,
        ends_at: command.ends_at,
        status: "scheduled",
      };
      checkPeriod(candidate);
      state.games.push(candidate);
      break;
    }
    case "reschedule":
      if (
        !game ||
        game.status !== "scheduled" ||
        !canSchedule(state, game.event_id, game.id)
      )
        throw new Error("Laga ini tidak dapat dijadwalkan ulang.");
      {
        const candidate = {
          ...game,
          venue: command.venue,
          starts_at: command.starts_at,
          ends_at: command.ends_at,
        };
        checkPeriod(candidate);
        for (const a of state.assignments.filter(
          (a) => a.match_id === game.id && active(a.status),
        ))
          ensureAvailable(a.referee_id, candidate, true);
        for (const c of state.coaches.filter((c) => c.match_id === game.id))
          ensureAvailable(c.referee_id, candidate, true);
        Object.assign(game, candidate);
      }
      break;
    case "coach":
      require(
        commission &&
          event &&
          (!command.match_id ||
            (game?.event_id === event?.id && game?.status === "scheduled")),
      );
      require(state.roster.some(
        (r) =>
          r.event_id === command.event_id &&
          r.referee_id === command.referee_id,
      ), "Daftarkan wasit ke event dulu.");
      require(!state.coaches.some(
        (c) =>
          c.event_id === command.event_id &&
          c.match_id === command.match_id &&
          c.referee_id === command.referee_id,
      ), "Coach sudah ditugaskan.");
      if (game) ensureAvailable(command.referee_id, game);
      state.coaches.push({
        id,
        event_id: command.event_id,
        match_id: command.match_id,
        referee_id: command.referee_id,
        mine: false,
      });
      break;
    case "remove_coach":
      require(commission);
      state.coaches = state.coaches.filter((c) => c.id !== command.coach_id);
      break;
    case "assign":
      if (
        !game ||
        game.status !== "scheduled" ||
        !canSchedule(state, game.event_id, game.id)
      )
        throw new Error("Akses penugasan laga ini dibatasi.");
      require(state.roster.some(
        (r) =>
          r.event_id === game.event_id && r.referee_id === command.referee_id,
      ), "Daftarkan wasit ke event dulu.");
      require(!state.assignments.some(
        (a) =>
          a.match_id === game.id &&
          a.position === command.position &&
          active(a.status),
      ), "Posisi sudah terisi.");
      ensureAvailable(command.referee_id, game);
      {
        const previous = state.assignments.find(
          (a) =>
            a.match_id === game.id &&
            a.referee_id === command.referee_id &&
            a.position === command.position,
        );
        if (previous)
          Object.assign(previous, {
            status: "pending",
            fee_idr: command.fee_idr,
          });
        else
          state.assignments.push({
            id,
            match_id: game.id,
            referee_id: command.referee_id,
            position: command.position,
            fee_idr: command.fee_idr,
            paid: 0,
            status: "pending",
            mine: false,
          });
      }
      break;
    case "decide":
      if (
        !assignment ||
        assignment.status !== "pending" ||
        !assignment.mine ||
        !state.games.some(
          (g) => g.id === assignment.match_id && g.status === "scheduled",
        )
      )
        throw new Error("Penugasan ini tidak dapat dikonfirmasi.");
      assignment.status = command.accept ? "accepted" : "declined";
      break;
    case "cancel": {
      const assignedGame = state.games.find(
        (g) => g.id === assignment?.match_id,
      );
      if (
        !assignment ||
        !assignedGame ||
        !["pending", "accepted"].includes(assignment.status) ||
        !canSchedule(state, assignedGame.event_id, assignedGame.id)
      )
        throw new Error("Penugasan ini tidak dapat dibatalkan.");
      assignment.status = "cancelled";
      break;
    }
    case "complete":
      if (
        !game ||
        game.status !== "scheduled" ||
        !canSchedule(state, game.event_id, game.id)
      )
        throw new Error("Laga ini tidak dapat diselesaikan.");
      require(!state.assignments.some(
        (a) => a.match_id === game.id && a.mine && a.status === "accepted",
      ), "Minta petugas lain menyelesaikan laga yang kamu wasiti.");
      game.status = "completed";
      for (const a of state.assignments.filter((a) => a.match_id === game.id)) {
        if (a.status === "accepted") a.status = "completed";
        if (a.status === "pending") a.status = "cancelled";
      }
      break;
    case "pay": {
      const assignedGame = state.games.find(
        (g) => g.id === assignment?.match_id,
      );
      if (
        !assignment ||
        !assignedGame ||
        assignment.mine ||
        assignment.status !== "completed" ||
        !canPay(state, assignedGame)
      )
        throw new Error("Pembayaran ini tidak dapat dicatat.");
      require(command.amount <=
        assignment.fee_idr - assignment.paid, "Jumlah melebihi sisa honor.");
      require(!state.ledger.some(
        (l) => l.reference.toLowerCase() === command.reference.toLowerCase(),
      ), "Referensi pembayaran sudah dipakai.");
      assignment.paid += command.amount;
      state.ledger.push({
        id,
        assignment_id: assignment.id,
        reference: command.reference,
        amount: command.amount,
        paid_on: todayInJakarta(),
      });
      break;
    }
    case "invite":
      require(commission && (command.event_id === null || event));
      token = (crypto.randomUUID() + crypto.randomUUID()).replaceAll("-", "");
      state.invites.push({
        id,
        event_id: command.event_id,
        email: command.email,
        expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: "active",
      });
      break;
    case "revoke_invite":
      require(commission);
      state.invites = state.invites.map((invite) =>
        invite.id === command.invite_id && invite.status === "active"
          ? { ...invite, status: "revoked" }
          : invite,
      );
      break;
  }
  return { state, id, token, inviteId: token ? id : undefined };
}

export const demoStorage = "rh-basket-workspace-v2";
export function redeemDemo(
  state: Workspace,
  tokens: DemoInviteTokens,
  token: string,
  name: string,
  email: string,
  region: string,
) {
  const invite = state.invites.find(
    (i) =>
      tokens[i.id] === token &&
      i.status === "active" &&
      Date.parse(i.expires_at) > Date.now(),
  );
  if (!invite || invite.email !== email.trim().toLowerCase())
    throw new Error("Undangan tidak aktif atau email tidak cocok.");
  const referee_id = crypto.randomUUID();
  state.referees.push({
    id: referee_id,
    name,
    region,
    active: true,
    mine: false,
    event_only: Boolean(invite.event_id),
  });
  if (invite.event_id)
    state.roster.push({ event_id: invite.event_id, referee_id });
  invite.status = "used";
  return { state, referee_id };
}
