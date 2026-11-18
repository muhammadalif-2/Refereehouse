"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  House,
  Link2,
  LogOut,
  ShieldCheck,
  Trophy,
  UsersRound,
} from "lucide-react";
import { Brand } from "./brand";
import { signOut } from "@/app/actions";
import { dateShift, formatDate, todayInJakarta } from "@/lib/dates";
import { idr } from "@/lib/dashboard";
import {
  demoStorage,
  demoView,
  runDemo,
  type DemoInviteTokens,
} from "@/lib/operations/demo";
import {
  canPay,
  canSchedule,
  commandSchema,
  isCommission,
  isOperator,
  jakartaInput,
  positions,
  type Club,
  type Workspace,
} from "@/lib/operations/model";

const demoChanged = "rh-basket-demo-changed";
const listen = (callback: () => void) => {
  window.addEventListener("storage", callback);
  window.addEventListener(demoChanged, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(demoChanged, callback);
  };
};
const readDemo = () => localStorage.getItem(demoStorage);
const serverDemo = () => null;

const roleLabels: Record<Club["role"], string> = {
  super_admin: "Admin platform",
  organization_admin: "Komisi Wasit",
  coordinator: "Koordinator Wasit",
  finance: "Keuangan",
  referee: "Wasit",
  guest: "Wasit Tamu",
};
const statusLabels: Record<string, string> = {
  pending: "Menunggu",
  accepted: "Diterima",
  declined: "Ditolak",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  draft: "Draf",
  scheduled: "Terjadwal",
  in_progress: "Berlangsung",
  postponed: "Ditunda",
  used: "Diterima",
  revoked: "Dicabut",
  expired: "Kedaluwarsa",
  active: "Aktif",
};
const pages = [
  ["overview", "Ringkasan", House],
  ["schedule", "Event & Jadwal", CalendarDays],
  ["crew", "Wasit & Penugasan", UsersRound],
  ["payments", "Pembayaran", CircleDollarSign],
  ["invite", "Undangan", Link2],
] as const;
type View = (typeof pages)[number][0];
type DemoSession = { state: Workspace; tokens: DemoInviteTokens };

const text = (form: FormData, key: string) => String(form.get(key) ?? "");
const dateTime = (form: FormData, key: string) => text(form, key) + ":00+07:00";
const money = (n: number) => idr.format(n);
function time(value: string) {
  return (
    formatDate(value, {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB"
  );
}

function Panel({
  title,
  children,
  detail,
}: {
  title: string;
  children: ReactNode;
  detail?: string;
}) {
  return (
    <section className="ops-card">
      <div className="ops-card-head">
        <h2>{title}</h2>
        {detail && <span>{detail}</span>}
      </div>
      {children}
    </section>
  );
}

function Text({
  title,
  name,
  type = "text",
  value,
  min,
  max = 150,
}: {
  title: string;
  name: string;
  type?: string;
  value?: string;
  min?: string;
  max?: number;
}) {
  return (
    <label>
      {title}
      <input
        required
        name={name}
        type={type}
        defaultValue={value}
        min={min}
        max={type === "number" ? max : undefined}
        maxLength={type === "text" || type === "email" ? max : undefined}
      />
    </label>
  );
}

function Select({
  title,
  name,
  choices,
  blank,
}: {
  title: string;
  name: string;
  choices: { id: string; name: string }[];
  blank?: string;
}) {
  return (
    <label>
      {title}
      <select name={name} required={!blank}>
        {blank ? (
          <option value="">{blank}</option>
        ) : (
          <option value="">Pilih {title.toLowerCase()}</option>
        )}
        {choices.map((choice) => (
          <option value={choice.id} key={choice.id}>
            {choice.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Operations({
  initial,
  clubs,
  demo = false,
}: {
  initial: Workspace;
  clubs: Club[];
  demo?: boolean;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const stored = useSyncExternalStore(
    listen,
    demo ? readDemo : serverDemo,
    serverDemo,
  );
  let session: DemoSession = { state: initial, tokens: {} };
  if (stored) {
    try {
      session = JSON.parse(stored) as DemoSession;
    } catch {
      /* Use the demo seed if local storage could not be read. */
    }
  }
  const [eventKey, setEvent] = useState("");
  const [gameKey, setGame] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const [inviteResult, setInvite] = useState<{ url: string; id: string }>();
  const demoRole = search.get("peran");
  const role =
    demo &&
    demoRole &&
    ["organization_admin", "coordinator", "finance", "referee"].includes(
      demoRole,
    )
      ? (demoRole as Club["role"])
      : initial.club.role;
  const personId = session.state.referees.find(
    (r) => r.id === search.get("wasit"),
  )?.id;
  const state = demo ? demoView(session.state, role, true, personId) : initial;
  const commission = isCommission(role);
  const operator = isOperator(role);
  const coach = state.coaches.some((c) => c.mine);
  const visible = pages.filter((page) => page[0] !== "invite" || commission);
  const view: View =
    visible.find((page) => page[0] === search.get("menu"))?.[0] ?? "overview";
  const event = state.events.find((e) => e.id === eventKey) ?? state.events[0];
  const games = state.games.filter((game) => game.event_id === event?.id);
  const game = games.find((g) => g.id === gameKey) ?? games[0];
  const canEvent = Boolean(event && canSchedule(state, event.id));
  const canGame = Boolean(game && canSchedule(state, game.event_id, game.id));
  const roster = state.referees.filter(
    (ref) =>
      ref.active &&
      state.roster.some(
        (r) => r.event_id === event?.id && r.referee_id === ref.id,
      ),
  );
  const duty = state.assignments.filter((a) => a.match_id === game?.id);
  const coaches = state.coaches.filter(
    (c) =>
      c.event_id === event?.id &&
      (c.match_id === null || c.match_id === game?.id),
  );
  const paymentItems = state.assignments.filter(
    (a) => games.some((g) => g.id === a.match_id) && a.status === "completed",
  );
  const today = todayInJakarta();
  const referee = (id: string) =>
    state.referees.find((r) => r.id === id)?.name ?? "Wasit";
  const navigate = (key: string, value: string) => {
    const params = new URLSearchParams(search.toString());
    params.set(key, value);
    router.push("/ruang-kerja?" + params, { scroll: false });
    setFeedback(undefined);
  };

  async function mutate(payload: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setFeedback(undefined);
    try {
      const command = commandSchema.parse({ ...payload, org: state.club.id });
      let response: { id?: string; token?: string };
      if (demo) {
        const result = runDemo(session.state, role, command, personId);
        if (result.inviteId && result.token)
          session.tokens[result.inviteId] = result.token;
        localStorage.setItem(
          demoStorage,
          JSON.stringify({ state: result.state, tokens: session.tokens }),
        );
        window.dispatchEvent(new Event(demoChanged));
        response = { id: result.id, token: result.token };
      } else {
        const res = await fetch("/api/operasional", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command),
        });
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error ?? "Perubahan belum tersimpan.");
        response = data;
        router.refresh();
      }
      if (response.id && response.token)
        setInvite({
          url: location.origin + "/undangan/" + response.token,
          id: response.id,
        });
      if (
        command.action === "revoke_invite" &&
        command.invite_id === inviteResult?.id
      )
        setInvite(undefined);
      if (command.action === "event" && response.id) setEvent(response.id);
      if (command.action === "match" && response.id) setGame(response.id);
      setFeedback({
        text:
          command.action === "invite"
            ? "Undangan dibuat. Salin tautan sebelum meninggalkan halaman."
            : "Perubahan tersimpan.",
      });
      return true;
    } catch (error) {
      setFeedback({
        text:
          error instanceof Error && error.name !== "ZodError"
            ? error.message
            : "Periksa kembali isian formulir.",
        error: true,
      });
      return false;
    } finally {
      setBusy(false);
    }
  }

  function form(
    button: string,
    values: (data: FormData) => Record<string, unknown>,
    children: ReactNode,
    reset = true,
  ) {
    return (
      <form
        className="ops-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const target = e.currentTarget;
          if ((await mutate(values(new FormData(target)))) && reset)
            target.reset();
        }}
      >
        <fieldset disabled={busy}>
          {children}
          <button className="primary">{button}</button>
        </fieldset>
      </form>
    );
  }

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <Link href="/" aria-label="Referee House beranda">
          <Brand />
        </Link>
        <div className="ops-club">
          <span className="org-icon">
            <ShieldCheck size={17} />
          </span>
          <div>
            <strong>{state.club.name}</strong>
            <small>{demo ? "Data Demo" : "Ruang kerja pengcab"}</small>
          </div>
        </div>
        <nav aria-label="Menu operasional">
          {visible.map(([key, label, Icon]) => (
            <button
              className={view === key ? "active" : ""}
              key={key}
              onClick={() => navigate("menu", key)}
              aria-current={view === key ? "page" : undefined}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
        <div className="ops-sidebar-foot">
          {demo ? (
            <Link href="/">
              <ArrowUpRight size={16} /> Beranda
            </Link>
          ) : (
            <form action={signOut}>
              <button>
                <LogOut size={16} /> Keluar
              </button>
            </form>
          )}
        </div>
      </aside>
      <main className="ops-main">
        <header className="ops-toolbar">
          <span>
            Operasional Basket <ChevronRight size={14} />{" "}
            {visible.find((p) => p[0] === view)?.[1]}
          </span>
          {demo ? (
            <div className="ops-switch">
              <label>
                Simulasi peran
                <select
                  value={role}
                  onChange={(e) => {
                    setInvite(undefined);
                    navigate("peran", e.target.value);
                  }}
                >
                  {(
                    [
                      "organization_admin",
                      "coordinator",
                      "finance",
                      "referee",
                    ] as const
                  ).map((r) => (
                    <option key={r} value={r}>
                      {r === "referee"
                        ? "Wasit / Referee Coach"
                        : roleLabels[r]}
                    </option>
                  ))}
                </select>
              </label>
              {role === "referee" && (
                <label>
                  Akun demo
                  <select
                    value={personId ?? state.referees.find((r) => r.mine)?.id}
                    onChange={(e) => navigate("wasit", e.target.value)}
                  >
                    {session.state.referees.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          ) : (
            clubs.length > 1 && (
              <label>
                Pengcab / event tamu
                <select
                  value={state.club.id}
                  onChange={(e) => navigate("pengcab", e.target.value)}
                >
                  {clubs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )
          )}
        </header>
        <div className="ops-content">
          <div className="ops-title">
            <div>
              <span className="ops-kicker">
                <Trophy size={14} /> BOLA BASKET
              </span>
              <h1>
                {view === "overview"
                  ? coach
                    ? "Referee Coach"
                    : roleLabels[state.club.role]
                  : visible.find((p) => p[0] === view)?.[1]}
              </h1>
              <p>
                {view === "overview"
                  ? "Jadwal laga, kru pertandingan, dan pencatatan honor dalam satu ruang kerja."
                  : state.club.name}
              </p>
            </div>
            {demo && <span className="ops-demo">DEMO INTERAKTIF</span>}
          </div>
          {demo && (
            <p className="ops-demo-note">
              Perubahan tersimpan di browser ini. Gunakan data fiktif dan ganti
              peran untuk menguji alur.
            </p>
          )}
          {feedback && (
            <div
              className={feedback.error ? "ops-feedback error" : "ops-feedback"}
              role={feedback.error ? "alert" : "status"}
            >
              {feedback.text}
            </div>
          )}

          {view === "overview" && (
            <>
              <div className="ops-metrics">
                {[
                  ["Event", state.events.length, Trophy],
                  ["Laga", state.games.length, CalendarDays],
                  [
                    "Penugasan",
                    state.assignments.filter((a) =>
                      ["pending", "accepted", "completed"].includes(a.status),
                    ).length,
                    ClipboardList,
                  ],
                  [
                    "Honor tercatat",
                    money(state.assignments.reduce((n, a) => n + a.paid, 0)),
                    CircleDollarSign,
                  ],
                ].map(([label, value, Icon]) => {
                  const MetricIcon = Icon as typeof Trophy;
                  return (
                    <div className="ops-card" key={String(label)}>
                      <span className="tile blue">
                        <MetricIcon size={19} />
                      </span>
                      <small>{String(label)}</small>
                      <strong>{String(value)}</strong>
                    </div>
                  );
                })}
              </div>
              <Panel
                title={coach ? "Cakupan Referee Coach" : "Langkah berikutnya"}
              >
                {coach ? (
                  <ul className="ops-list">
                    {state.coaches
                      .filter((c) => c.mine)
                      .map((c) => (
                        <li key={c.id}>
                          <strong>
                            {
                              state.events.find((e) => e.id === c.event_id)
                                ?.name
                            }
                          </strong>
                          <span>
                            {c.match_id
                              ? state.games.find((g) => g.id === c.match_id)
                                  ?.name
                              : "Seluruh event"}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="ops-quick">
                    <button onClick={() => navigate("menu", "schedule")}>
                      <CalendarDays size={18} />
                      {operator
                        ? "Kelola event dan jadwal"
                        : "Lihat jadwal laga"}
                      <ArrowUpRight size={15} />
                    </button>
                    <button onClick={() => navigate("menu", "crew")}>
                      <UsersRound size={18} />
                      {operator ? "Kelola wasit dan kru" : "Lihat penugasan"}
                      <ArrowUpRight size={15} />
                    </button>
                    {commission && (
                      <button onClick={() => navigate("menu", "invite")}>
                        <Link2 size={18} />
                        Buat undangan
                        <ArrowUpRight size={15} />
                      </button>
                    )}
                  </div>
                )}
              </Panel>
            </>
          )}

          {["schedule", "crew", "payments"].includes(view) && (
            <div className="ops-filters">
              <label>
                Event
                <select
                  value={event?.id ?? ""}
                  onChange={(e) => {
                    setEvent(e.target.value);
                    setGame("");
                  }}
                >
                  {!event && <option value="">Belum ada event</option>}
                  {state.events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
              {view === "crew" && (
                <label>
                  Laga
                  <select
                    value={game?.id ?? ""}
                    onChange={(e) => setGame(e.target.value)}
                  >
                    {!game && <option value="">Belum ada laga</option>}
                    {games.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          )}

          {view === "schedule" && (
            <>
              <div className="ops-grid">
                {operator && (
                  <Panel title="Tambah event">
                    {form(
                      "Simpan event",
                      (f) => ({
                        action: "event",
                        name: text(f, "name"),
                        region: text(f, "region"),
                        starts_on: text(f, "start"),
                        ends_on: text(f, "end"),
                      }),
                      <>
                        <Text title="Nama event" name="name" />
                        <Text title="Daerah penyelenggara" name="region" />
                        <div className="ops-two">
                          <Text
                            title="Mulai"
                            name="start"
                            type="date"
                            value={today}
                          />
                          <Text
                            title="Selesai"
                            name="end"
                            type="date"
                            value={dateShift(today, 1)}
                          />
                        </div>
                      </>,
                    )}
                  </Panel>
                )}
                {event && canEvent && (
                  <Panel title="Tambah laga" detail="Waktu Indonesia Barat">
                    {form(
                      "Simpan laga",
                      (f) => ({
                        action: "match",
                        event_id: event.id,
                        name: text(f, "name"),
                        venue: text(f, "venue"),
                        starts_at: dateTime(f, "start"),
                        ends_at: dateTime(f, "end"),
                      }),
                      <>
                        <Text title="Tim / nama laga" name="name" />
                        <Text title="Venue / lapangan" name="venue" />
                        <div className="ops-two">
                          <Text
                            title="Mulai (WIB)"
                            name="start"
                            type="datetime-local"
                            value={event.starts_on + "T09:00"}
                          />
                          <Text
                            title="Selesai (WIB)"
                            name="end"
                            type="datetime-local"
                            value={event.starts_on + "T10:30"}
                          />
                        </div>
                      </>,
                    )}
                  </Panel>
                )}
              </div>
              <Panel
                title={event?.name ?? "Jadwal pertandingan"}
                detail={event?.region}
              >
                {games.length === 0 && (
                  <p className="ops-empty">Belum ada laga untuk ditampilkan.</p>
                )}
                {games.map((g) => (
                  <article className="ops-row" key={g.id}>
                    <div>
                      <strong>{g.name}</strong>
                      <p>
                        {time(g.starts_at)} · {g.venue}
                      </p>
                    </div>
                    <span className={"status " + g.status}>
                      {statusLabels[g.status] ?? g.status}
                    </span>
                    {g.status === "scheduled" &&
                      canSchedule(state, g.event_id, g.id) && (
                        <details className="ops-details">
                          <summary>Kelola laga</summary>
                          {form(
                            "Simpan jadwal",
                            (f) => ({
                              action: "reschedule",
                              match_id: g.id,
                              venue: text(f, "venue"),
                              starts_at: dateTime(f, "start"),
                              ends_at: dateTime(f, "end"),
                            }),
                            <>
                              <Text
                                title="Venue / lapangan"
                                name="venue"
                                value={g.venue}
                              />
                              <Text
                                title="Mulai (WIB)"
                                name="start"
                                type="datetime-local"
                                value={jakartaInput(g.starts_at)}
                              />
                              <Text
                                title="Selesai (WIB)"
                                name="end"
                                type="datetime-local"
                                value={jakartaInput(g.ends_at)}
                              />
                            </>,
                            false,
                          )}
                          <button
                            className="ops-outline"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Selesaikan laga dan batalkan penugasan yang belum dikonfirmasi?",
                                )
                              )
                                void mutate({
                                  action: "complete",
                                  match_id: g.id,
                                });
                            }}
                          >
                            Selesaikan laga
                          </button>
                        </details>
                      )}
                  </article>
                ))}
              </Panel>
            </>
          )}

          {view === "crew" && (
            <>
              <div className="ops-grid">
                {operator && (
                  <Panel title="Tambah wasit">
                    {form(
                      "Simpan wasit",
                      (f) => ({
                        action: "referee",
                        name: text(f, "name"),
                        region: text(f, "region"),
                      }),
                      <>
                        <Text title="Nama lengkap" name="name" />
                        <Text title="Daerah asal" name="region" />
                      </>,
                    )}
                  </Panel>
                )}
                {event && canEvent && (
                  <Panel title="Daftarkan wasit ke event">
                    {form(
                      "Tambah ke roster",
                      (f) => ({
                        action: "roster",
                        event_id: event.id,
                        referee_id: text(f, "referee"),
                      }),
                      <Select
                        title="Wasit"
                        name="referee"
                        choices={state.referees.filter(
                          (r) =>
                            r.active &&
                            !r.event_only &&
                            !roster.some((x) => x.id === r.id),
                        )}
                      />,
                    )}
                  </Panel>
                )}
                {event && commission && (
                  <Panel title="Tetapkan Referee Coach">
                    {form(
                      "Tetapkan coach",
                      (f) => ({
                        action: "coach",
                        event_id: event.id,
                        match_id: text(f, "match") || null,
                        referee_id: text(f, "referee"),
                      }),
                      <>
                        <Select title="Wasit" name="referee" choices={roster} />
                        <Select
                          title="Cakupan"
                          name="match"
                          choices={games.filter(
                            (g) => g.status === "scheduled",
                          )}
                          blank="Seluruh event"
                        />
                      </>,
                    )}
                  </Panel>
                )}
                {game && game.status === "scheduled" && canGame && (
                  <Panel title="Tugaskan wasit" detail={game.name}>
                    {form(
                      "Buat penugasan",
                      (f) => ({
                        action: "assign",
                        match_id: game.id,
                        referee_id: text(f, "referee"),
                        position: text(f, "position"),
                        fee_idr: Number(text(f, "fee")),
                      }),
                      <>
                        <Select title="Wasit" name="referee" choices={roster} />
                        <Select
                          title="Posisi"
                          name="position"
                          choices={positions.map((name) => ({
                            id: name,
                            name,
                          }))}
                        />
                        <Text
                          title="Honor (Rp)"
                          name="fee"
                          type="number"
                          min="0"
                          max={100000000}
                          value="175000"
                        />
                      </>,
                    )}
                  </Panel>
                )}
              </div>
              <div className="ops-grid">
                <Panel title="Roster wasit" detail={event?.name}>
                  {!roster.length && (
                    <p className="ops-empty">
                      Belum ada wasit terdaftar untuk event ini.
                    </p>
                  )}
                  <ul className="ops-list">
                    {roster.map((r) => (
                      <li key={r.id}>
                        <strong>{r.name}</strong>
                        <span>{r.region}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="Referee Coach">
                  {!coaches.length && (
                    <p className="ops-empty">
                      Belum ada coach dalam cakupan ini.
                    </p>
                  )}
                  <ul className="ops-list">
                    {coaches.map((c) => (
                      <li key={c.id}>
                        <strong>{referee(c.referee_id)}</strong>
                        <span>
                          {c.match_id ? "Laga terpilih" : "Seluruh event"}
                        </span>
                        {commission && (
                          <button
                            className="ops-text"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm("Lepas coach dari cakupan ini?")
                              )
                                void mutate({
                                  action: "remove_coach",
                                  coach_id: c.id,
                                });
                            }}
                          >
                            Lepas
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
              <Panel title="Kru pertandingan" detail={game?.name}>
                {!duty.length && (
                  <p className="ops-empty">
                    Belum ada penugasan yang terlihat di laga ini.
                  </p>
                )}
                {duty.map((a) => (
                  <article className="ops-row" key={a.id}>
                    <div>
                      <strong>{referee(a.referee_id)}</strong>
                      <p>
                        {a.position} · {money(a.fee_idr)}
                      </p>
                    </div>
                    <span className={"status " + a.status}>
                      {statusLabels[a.status]}
                    </span>
                    {a.mine && a.status === "pending" && (
                      <div className="ops-actions">
                        <button
                          className="ops-outline"
                          disabled={busy}
                          onClick={() =>
                            void mutate({
                              action: "decide",
                              assignment_id: a.id,
                              accept: true,
                            })
                          }
                        >
                          Terima
                        </button>
                        <button
                          className="ops-text"
                          disabled={busy}
                          onClick={() =>
                            void mutate({
                              action: "decide",
                              assignment_id: a.id,
                              accept: false,
                            })
                          }
                        >
                          Tolak
                        </button>
                      </div>
                    )}
                    {canGame &&
                      game?.status === "scheduled" &&
                      ["pending", "accepted"].includes(a.status) && (
                        <button
                          className="ops-text"
                          disabled={busy}
                          onClick={() => {
                            if (window.confirm("Batalkan penugasan ini?"))
                              void mutate({
                                action: "cancel",
                                assignment_id: a.id,
                              });
                          }}
                        >
                          Batalkan
                        </button>
                      )}
                  </article>
                ))}
              </Panel>
            </>
          )}

          {view === "payments" && (
            <Panel title="Honor laga selesai" detail="Pencatatan pembayaran">
              {!paymentItems.length && (
                <p className="ops-empty">
                  Honor muncul setelah penugasan diterima dan laga diselesaikan.
                </p>
              )}
              {paymentItems.map((a) => {
                const g = games.find((x) => x.id === a.match_id)!;
                const balance = a.fee_idr - a.paid;
                return (
                  <article className="ops-row" key={a.id}>
                    <div>
                      <strong>
                        {referee(a.referee_id)} · {g.name}
                      </strong>
                      <p>
                        {a.position} · Honor {money(a.fee_idr)} · Dibayar{" "}
                        {money(a.paid)}
                      </p>
                      {state.ledger
                        .filter((l) => l.assignment_id === a.id)
                        .map((l) => (
                          <p key={l.id}>
                            {l.paid_on} · {l.reference} · {money(l.amount)}
                          </p>
                        ))}
                    </div>
                    <span
                      className={
                        "status " + (balance ? "pending" : "completed")
                      }
                    >
                      {balance ? "Sisa " + money(balance) : "Lunas"}
                    </span>
                    {balance > 0 && !a.mine && canPay(state, g) && (
                      <details className="ops-details">
                        <summary>Catat pembayaran</summary>
                        {form(
                          "Catat pembayaran",
                          (f) => ({
                            action: "pay",
                            assignment_id: a.id,
                            amount: Number(text(f, "amount")),
                            reference: text(f, "reference"),
                          }),
                          <>
                            <Text
                              title="Jumlah (Rp)"
                              name="amount"
                              type="number"
                              min="1"
                              max={balance}
                              value={String(balance)}
                            />
                            <Text
                              title="Referensi pembayaran"
                              name="reference"
                              max={80}
                            />
                          </>,
                        )}
                      </details>
                    )}
                  </article>
                );
              })}
            </Panel>
          )}

          {view === "invite" && commission && (
            <div className="ops-grid">
              <Panel title="Buat undangan" detail="Berlaku 7 hari">
                {form(
                  "Buat tautan",
                  (f) => ({
                    action: "invite",
                    event_id: text(f, "event") || null,
                    email: text(f, "email"),
                  }),
                  <>
                    <Text
                      title="Email wasit"
                      name="email"
                      type="email"
                      max={254}
                    />
                    <Select
                      title="Cakupan akses"
                      name="event"
                      choices={state.events}
                      blank="Keanggotaan pengcab"
                    />
                    <p className="ops-empty">
                      Untuk wasit lintas daerah, pilih event agar aksesnya
                      terbatas ke event tersebut.
                    </p>
                  </>,
                )}
                {inviteResult && (
                  <div className="ops-invite-result">
                    <label>
                      Tautan undangan
                      <input readOnly value={inviteResult.url} />
                    </label>
                    <div className="ops-actions">
                      <button
                        className="ops-outline"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(
                              inviteResult.url,
                            );
                            setFeedback({ text: "Tautan disalin." });
                          } catch {
                            setFeedback({
                              text: "Pilih dan salin tautan dari kolom undangan.",
                            });
                          }
                        }}
                      >
                        Salin tautan
                      </button>
                      <a
                        className="ops-text"
                        href={inviteResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Buka undangan
                      </a>
                    </div>
                  </div>
                )}
              </Panel>
              <Panel title="Riwayat undangan">
                {!state.invites.length && (
                  <p className="ops-empty">Belum ada undangan.</p>
                )}
                {state.invites.map((i) => (
                  <article className="ops-row" key={i.id}>
                    <div>
                      <strong>{i.email}</strong>
                      <p>
                        {state.events.find((e) => e.id === i.event_id)?.name ??
                          "Pengcab"}{" "}
                        · {statusLabels[i.status]}
                      </p>
                    </div>
                    {i.status === "active" && (
                      <button
                        className="ops-text"
                        disabled={busy}
                        onClick={() => {
                          if (window.confirm("Cabut undangan ini?"))
                            void mutate({
                              action: "revoke_invite",
                              invite_id: i.id,
                            });
                        }}
                      >
                        Cabut
                      </button>
                    )}
                  </article>
                ))}
              </Panel>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
