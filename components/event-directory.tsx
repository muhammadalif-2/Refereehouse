"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  MapPin,
  Search,
  Trophy,
  UsersRound,
} from "lucide-react";
import { formatDate } from "@/lib/dates";
import {
  eventStatus,
  eventStatuses,
  type EventData,
} from "@/lib/operations/insights";

export function eventDates(start: string, end: string) {
  const options = { day: "numeric", month: "short", year: "numeric" } as const;
  return start === end
    ? formatDate(start, options)
    : formatDate(start, options) + " – " + formatDate(end, options);
}

export function EventStatus({
  record,
  today,
}: {
  record: EventData;
  today: string;
}) {
  const status = eventStatus(record.event, today);
  return <span className={"ops-pill " + status}>{eventStatuses[status]}</span>;
}

export function EventDirectory({
  records,
  today,
  open,
  create,
}: {
  records: EventData[];
  today: string;
  open: (id: string) => string;
  create?: string;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const query = search.trim().toLocaleLowerCase("id");
  const filtered = records.filter(
    ({ event }) =>
      (!status || eventStatus(event, today) === status) &&
      (event.name + " " + event.region).toLocaleLowerCase("id").includes(query),
  );

  return (
    <>
      <div className="ops-directory-tools">
        <label>
          Cari event
          <div className="ops-search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nama event atau daerah"
            />
          </div>
        </label>
        <label>
          Status event
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Semua status</option>
            {Object.entries(eventStatuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {create && (
          <Link className="primary" href={create}>
            Buat event <ArrowRight size={16} />
          </Link>
        )}
      </div>
      {!filtered.length ? (
        <section className="ops-card ops-empty-state">
          <span className="tile blue">
            <Trophy size={19} />
          </span>
          <h2>
            {records.length ? "Event tidak ditemukan" : "Belum ada event"}
          </h2>
          <p>
            {records.length
              ? "Ubah pencarian atau filter status."
              : "Jadwal pertandingan akan muncul saat kamu membuka sebuah event."}
          </p>
        </section>
      ) : (
        <div className="ops-event-grid">
          {filtered.map((record) => (
            <article className="ops-card ops-event-card" key={record.event.id}>
              <div className="ops-event-top">
                <span className="tile blue">
                  <Trophy size={18} />
                </span>
                <EventStatus record={record} today={today} />
              </div>
              <h2>
                <Link href={open(record.event.id)}>{record.event.name}</Link>
              </h2>
              <p>
                <MapPin size={14} /> {record.event.region}
              </p>
              <p>
                <CalendarDays size={14} />{" "}
                {eventDates(record.event.starts_on, record.event.ends_on)}
              </p>
              <div className="ops-event-foot">
                <span>
                  <CalendarDays size={14} /> {record.games.length} laga
                </span>
                <span>
                  <UsersRound size={14} /> {record.referees.length} wasit
                </span>
                <Link
                  className="ops-text"
                  aria-label={"Buka event " + record.event.name}
                  href={open(record.event.id)}
                >
                  Buka event <ArrowRight size={15} />
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
