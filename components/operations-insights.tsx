"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Search,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import { idr } from "@/lib/dashboard";
import {
  eventStatus,
  eventStatuses,
  filterEvents,
  paymentTotals,
  type EventData,
} from "@/lib/operations/insights";
import type { Workspace } from "@/lib/operations/model";
import { eventDates } from "./event-directory";

const views = {
  events: {
    title: "Event",
    columns: ["Daerah", "Periode", "Status", "Laga selesai"],
    icon: Trophy,
  },
  games: {
    title: "Pertandingan",
    columns: ["Venue", "Mulai (WIB)", "Status", "Penugasan"],
    icon: CalendarDays,
  },
  referees: {
    title: "Wasit",
    columns: ["Daerah asal", "Akses", "Event", "Penugasan"],
    icon: UsersRound,
  },
  assignments: {
    title: "Penugasan",
    columns: ["Posisi", "Status", "Honor", "Dibayar"],
    icon: ClipboardList,
  },
  payments: {
    title: "Pembayaran",
    columns: ["Honor selesai", "Dibayar", "Sisa", "Status"],
    icon: CircleDollarSign,
  },
} as const;
type View = keyof typeof views;
type Row = {
  id: string;
  title: string;
  context?: string;
  cells: string[];
  detail: [string, string][];
  status: string;
  date?: string;
  href?: string;
};
type Open = (
  event: string,
  match?: string,
  view?: "crew" | "payments",
) => string;

const formatTime = (value: string) =>
  formatDate(value, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const formatMoney = (value: number) => idr.format(value);
const assignmentStates: Record<string, string> = {
  pending: "Menunggu",
  accepted: "Diterima",
  declined: "Ditolak",
  completed: "Selesai",
  cancelled: "Dibatalkan",
  draft: "Draf",
  scheduled: "Terjadwal",
  in_progress: "Berlangsung",
  postponed: "Ditunda",
};

function reportRows(
  state: Workspace,
  records: EventData[],
  scoped: boolean,
  today: string,
  open: Open,
) {
  const display = new Map(state.referees.map((r) => [r.id, r.name]));
  const refs = new Map<string, { events: string[]; assignments: number }>();
  const gameRows: Row[] = [];
  const dutyRows: Row[] = [];
  const payRows: Row[] = [];
  const receipts = new Map<string, string[]>();
  for (const entry of state.ledger) {
    const line = `${eventDates(entry.paid_on, entry.paid_on)} · ${entry.reference} · ${formatMoney(entry.amount)}`;
    const lines = receipts.get(entry.assignment_id) ?? [];
    lines.push(line);
    receipts.set(entry.assignment_id, lines);
  }
  if (!scoped)
    for (const referee of state.referees)
      refs.set(referee.id, { events: [], assignments: 0 });

  const eventRows: Row[] = records.map(
    ({ event, games, completed, assignments, referees, payment }) => {
      const status = eventStatuses[eventStatus(event, today)];
      const dates = eventDates(event.starts_on, event.ends_on);
      const gameById = new Map(games.map((game) => [game.id, game]));
      const crewCounts = new Map<string, number>();
      for (const referee of referees) {
        const entry = refs.get(referee.id) ?? { events: [], assignments: 0 };
        entry.events.push(event.name);
        refs.set(referee.id, entry);
      }
      for (const a of assignments) {
        const game = gameById.get(a.match_id);
        if (!game) continue;
        const person = refs.get(a.referee_id);
        if (person) person.assignments++;
        crewCounts.set(game.id, (crewCounts.get(game.id) ?? 0) + 1);
        const referee = display.get(a.referee_id) ?? "Wasit";
        const status = assignmentStates[a.status] ?? a.status;
        const info: [string, string][] = [
          ["Event", event.name],
          ["Pertandingan", game.name],
          ["Waktu", formatTime(game.starts_at) + " WIB"],
          ["Venue", game.venue],
        ];
        dutyRows.push({
          id: a.id,
          title: referee,
          context: game.name,
          cells: [
            a.position,
            status,
            formatMoney(a.fee_idr),
            formatMoney(a.paid),
          ],
          detail: [
            ...info,
            ["Posisi", a.position],
            ["Status penugasan", status],
            ["Honor", formatMoney(a.fee_idr)],
          ],
          href: open(event.id, game.id, "crew"),
          date: game.starts_at,
          status,
        });
        if (a.status !== "completed") continue;
        const remaining = Math.max(0, a.fee_idr - a.paid);
        const paymentStatus =
          remaining === 0 ? "Lunas" : a.paid > 0 ? "Sebagian" : "Belum dibayar";
        payRows.push({
          id: a.id,
          title: referee,
          context: game.name,
          cells: [
            formatMoney(a.fee_idr),
            formatMoney(a.paid),
            formatMoney(remaining),
            paymentStatus,
          ],
          detail: [
            ...info,
            ["Honor selesai", formatMoney(a.fee_idr)],
            ["Sisa honor", formatMoney(remaining)],
            [
              "Riwayat pembayaran",
              receipts.get(a.id)?.join("\n") ?? "Belum ada pembayaran tercatat",
            ],
          ],
          href: open(event.id, game.id, "payments"),
          date: game.starts_at,
          status: paymentStatus,
        });
      }
      for (const game of games) {
        const status = assignmentStates[game.status] ?? game.status;
        gameRows.push({
          id: game.id,
          title: game.name,
          context: event.name,
          cells: [
            game.venue,
            formatTime(game.starts_at),
            status,
            String(crewCounts.get(game.id) ?? 0),
          ],
          detail: [
            ["Event", event.name],
            ["Venue", game.venue],
            ["Mulai", formatTime(game.starts_at) + " WIB"],
            ["Selesai", formatTime(game.ends_at) + " WIB"],
            ["Status", status],
          ],
          href: open(event.id, game.id),
          date: game.starts_at,
          status,
        });
      }
      return {
        id: event.id,
        title: event.name,
        cells: [event.region, dates, status, `${completed} / ${games.length}`],
        detail: [
          ["Daerah", event.region],
          ["Periode", dates],
          ["Status", status],
          ["Wasit", String(referees.length)],
          ["Penugasan", String(assignments.length)],
          ["Honor dibayar", formatMoney(payment.paid)],
          ["Sisa honor", formatMoney(payment.remaining)],
        ],
        href: open(event.id),
        date: event.starts_on,
        status,
      };
    },
  );
  const refereeRows: Row[] = state.referees.flatMap((referee) => {
    const totals = refs.get(referee.id);
    if (!totals) return [];
    const access = referee.event_only ? "Tamu event" : "Pengcab";
    return [
      {
        id: referee.id,
        title: referee.name,
        cells: [
          referee.region,
          access,
          String(totals.events.length),
          String(totals.assignments),
        ],
        detail: [
          ["Daerah asal", referee.region],
          ["Akses", access],
          ["Status profil", referee.active ? "Aktif" : "Nonaktif"],
          ["Event yang diikuti", totals.events.join("\n") || "Belum terdaftar"],
          ["Jumlah penugasan", String(totals.assignments)],
        ],
        status: referee.active ? "Aktif" : "Nonaktif",
      },
    ];
  });
  return {
    events: eventRows,
    games: gameRows,
    referees: refereeRows,
    assignments: dutyRows,
    payments: payRows,
  };
}

export function OperationsInsights({
  state,
  records,
  today,
  open,
  initialView,
}: {
  state: Workspace;
  records: EventData[];
  today: string;
  open: Open;
  initialView?: string | null;
}) {
  const [view, setView] = useState<View>(
    initialView && Object.hasOwn(views, initialView)
      ? (initialView as View)
      : "events",
  );
  const [event, setEvent] = useState("");
  const [region, setRegion] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState("recent");
  const [selected, setSelected] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const invalidDates = Boolean(from && to && from > to);
  const base = { region, from, to };
  const chart = invalidDates ? [] : filterEvents(records, base);
  const filteredEvents = event
    ? chart.filter((record) => record.event.id === event)
    : chart;
  const scope = Boolean(event || region || from || to);
  const all = reportRows(state, filteredEvents, scope, today, open);
  const payments = paymentTotals(
    filteredEvents.flatMap((record) => record.assignments),
  );
  const options = Array.from(
    new Set(all[view].map((row) => row.status)),
  ).sort();
  const query = search.trim().toLocaleLowerCase("id");
  const rows = all[view]
    .filter(
      (row) =>
        (!status || row.status === status) &&
        [row.title, row.context, ...row.cells]
          .join(" ")
          .toLocaleLowerCase("id")
          .includes(query),
    )
    .sort(
      (a, b) =>
        (order === "recent" ? (b.date ?? "").localeCompare(a.date ?? "") : 0) ||
        a.title.localeCompare(b.title, "id"),
    );
  const active = rows.find((row) => row.id === selected);
  useEffect(() => {
    if (selected && dialog.current && !dialog.current.open)
      dialog.current.showModal();
  }, [selected]);
  const metrics: Record<View, string | number> = {
    events: all.events.length,
    games: all.games.length,
    referees: all.referees.length,
    assignments: all.assignments.length,
    payments: formatMoney(payments.paid),
  };

  function choose(view: View) {
    setView(view);
    setStatus("");
    setSearch("");
  }
  function reset() {
    setEvent("");
    setRegion("");
    setFrom("");
    setTo("");
    setStatus("");
    setSearch("");
  }

  return (
    <>
      <section className="ops-card ops-report-filters" aria-label="Filter data">
        <div className="ops-card-head">
          <h2>Filter data</h2>
          <button className="ops-text" onClick={reset}>
            Reset filter
          </button>
        </div>
        <div className="ops-report-fields">
          <label>
            Daerah event
            <select
              value={region}
              onChange={(e) => {
                setRegion(e.target.value);
                setEvent("");
                setStatus("");
              }}
            >
              <option value="">Semua daerah</option>
              {Array.from(new Set(records.map((r) => r.event.region)))
                .sort()
                .map((r) => (
                  <option key={r}>{r}</option>
                ))}
            </select>
          </label>
          <label>
            Dari tanggal
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setEvent("");
                setStatus("");
              }}
            />
          </label>
          <label>
            Sampai tanggal
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setEvent("");
                setStatus("");
              }}
            />
          </label>
          <label>
            Event
            <select
              value={event}
              onChange={(e) => {
                setEvent(e.target.value);
                setStatus("");
              }}
            >
              <option value="">Semua event</option>
              {chart.map(({ event }) => (
                <option value={event.id} key={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="ops-hint">
          {invalidDates
            ? "Tanggal akhir harus sama dengan atau setelah tanggal awal."
            : "Filter tanggal mencakup event yang beririsan dengan periode terpilih, beserta data pertandingannya."}
        </p>
      </section>
      <div className="ops-report-metrics" aria-label="Total data sesuai filter">
        {(Object.keys(views) as View[]).map((key) => {
          const { title, icon: Icon } = views[key];
          return (
            <button
              key={key}
              type="button"
              className="ops-card ops-metric-button"
              aria-pressed={view === key}
              onClick={() => choose(key)}
            >
              <span className="tile blue">
                <Icon size={18} />
              </span>
              <small>{key === "payments" ? "Honor dibayar" : title}</small>
              <strong>{metrics[key]}</strong>
            </button>
          );
        })}
      </div>

      <div className="ops-insights-grid">
        <section className="ops-card ops-chart">
          <div className="ops-card-head">
            <h2>
              <BarChart3 size={18} /> Progres laga per event
            </h2>
            <span>Selesai / total</span>
          </div>
          <p className="ops-hint">
            Pilih baris event untuk memfilter data di bawah.
          </p>
          {!chart.length ? (
            <p className="ops-empty">Belum ada event dalam filter ini.</p>
          ) : (
            <div className="ops-chart-events">
              {chart.map(({ event: e, completed, games }) => (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={event === e.id}
                  onClick={() => {
                    setEvent(event === e.id ? "" : e.id);
                    setStatus("");
                  }}
                >
                  <span className="ops-chart-label">
                    <strong>{e.name}</strong>
                    <small>
                      {completed} / {games.length} laga
                    </small>
                  </span>
                  <span className="ops-bar" aria-hidden="true">
                    <i
                      style={{
                        width: `${games.length ? (completed * 100) / games.length : 0}%`,
                      }}
                    />
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
        <section className="ops-card ops-totals">
          <div className="ops-card-head">
            <h2>Ringkasan honor</h2>
          </div>
          <dl>
            <div>
              <dt>Honor laga selesai</dt>
              <dd>{formatMoney(payments.due)}</dd>
            </div>
            <div>
              <dt>Sudah dibayar</dt>
              <dd>{formatMoney(payments.paid)}</dd>
            </div>
            <div>
              <dt>Sisa pembayaran</dt>
              <dd>{formatMoney(payments.remaining)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="ops-card ops-report-table">
        <div className="ops-card-head">
          <h2>Detail {views[view].title.toLowerCase()}</h2>
          <span aria-live="polite">{rows.length} entri</span>
        </div>
        <div className="ops-report-fields table">
          <label>
            Cari data
            <div className="ops-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari dalam tabel ini"
              />
            </div>
          </label>
          <label>
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">Semua status</option>
              {options.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Urutan
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="recent">Terbaru</option>
              <option value="name">Nama A–Z</option>
            </select>
          </label>
        </div>
        {!rows.length ? (
          <p className="ops-empty ops-table-empty">
            Belum ada data yang cocok dengan filter ini.
          </p>
        ) : (
          <div
            className="ops-scroll-table"
            tabIndex={0}
            aria-label={"Tabel " + views[view].title.toLowerCase()}
          >
            <table>
              <thead>
                <tr>
                  <th scope="col">Nama</th>
                  {views[view].columns.map((column) => (
                    <th scope="col" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(row.id);
                        }}
                      >
                        {row.title}
                        <ArrowRight size={14} />
                      </button>
                      {row.context && <small>{row.context}</small>}
                    </th>
                    {row.cells.map((cell, index) => (
                      <td key={index}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <dialog
        className="ops-record-dialog"
        ref={dialog}
        onClose={() => setSelected("")}
        aria-labelledby="ops-data-detail-title"
      >
        {active && (
          <>
            <div className="ops-card-head">
              <h2 id="ops-data-detail-title">{active.title}</h2>
              <button
                aria-label="Tutup detail"
                className="ops-text"
                onClick={() => dialog.current?.close()}
              >
                <X size={20} />
              </button>
            </div>
            <dl className="ops-record-details">
              {active.detail.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            {active.href && (
              <Link className="primary" href={active.href}>
                Buka ruang event <ArrowRight size={16} />
              </Link>
            )}
          </>
        )}
      </dialog>
    </>
  );
}
