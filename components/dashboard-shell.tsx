"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronsUpDown,
  CircleAlert,
  ClipboardList,
  Clock3,
  Command,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Moon,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Trophy,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "./brand";
import { Trend } from "./trend";
import { signOut } from "@/app/actions";
import { roles, type Membership } from "@/lib/access";
import {
  idr,
  number,
  type Dashboard,
  type Viewer,
  type Assignment,
} from "@/lib/dashboard";
import { dateRange, formatDate, periods } from "@/lib/dates";

const sections = [
  {
    id: "dasbor",
    label: "Dasbor",
    icon: LayoutDashboard,
    group: "RUANG KERJA",
  },
  {
    id: "jadwal",
    label: "Jadwal Penugasan",
    icon: CalendarDays,
    group: "RUANG KERJA",
  },
  {
    id: "event",
    label: "Event Berlangsung",
    icon: Trophy,
    group: "RUANG KERJA",
  },
  { id: "analitik", label: "Analitik", icon: Activity, group: "RUANG KERJA" },
  { id: "keuangan", label: "Keuangan", icon: Wallet, group: "MANAJEMEN" },
  { id: "notifikasi", label: "Notifikasi", icon: Bell, group: "MANAJEMEN" },
  { id: "pengaturan", label: "Pengaturan", icon: Settings, group: "MANAJEMEN" },
] as const;

const statusLabels = {
  draft: "Draf",
  pending: "Menunggu",
  accepted: "Dikonfirmasi",
  declined: "Ditolak",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};
const colors = ["blue", "violet", "green", "amber"];

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function dateLabel(value: string) {
  return formatDate(value, { day: "numeric", month: "short", year: "numeric" });
}

function Metric({
  icon: Icon,
  tone,
  label,
  value,
  caption,
}: {
  icon: LucideIcon;
  tone: string;
  label: string;
  value: number | string;
  caption: string;
}) {
  return (
    <article className="metric">
      <span className={`tile ${tone}`}>
        <Icon size={19} />
      </span>
      <span className="metric-label">{label}</span>
      <strong>
        {typeof value === "number" ? number.format(value) : value}
      </strong>
      <span className="metric-note">{caption}</span>
    </article>
  );
}

function Schedule({
  items,
  onOpen,
  onMore,
}: {
  items: Assignment[];
  onOpen: (item: Assignment) => void;
  onMore?: () => void;
}) {
  return (
    <section className="panel schedule" id="schedule">
      <div className="panel-heading">
        <div>
          <h2>Penugasan Mendatang</h2>
          <p>Jadwal pertandingan dan konfirmasi wasit</p>
        </div>
        {onMore && (
          <button className="text-button" onClick={onMore}>
            Semua jadwal <ArrowRight size={15} />
          </button>
        )}
      </div>
      {items.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Wasit</th>
                <th>Pertandingan</th>
                <th>Jadwal</th>
                <th>Posisi</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={item.id}>
                  <td>
                    <button className="person" onClick={() => onOpen(item)}>
                      <span className={`avatar ${colors[i % colors.length]}`}>
                        {initials(item.name)}
                      </span>
                      {item.name}
                    </button>
                  </td>
                  <td>
                    <strong>{item.match}</strong>
                    <small>{item.event}</small>
                  </td>
                  <td>
                    <strong>{dateLabel(item.startsAt)}</strong>
                    <small>
                      {formatDate(item.startsAt, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      WIB · {item.venue}
                    </small>
                  </td>
                  <td>{item.position}</td>
                  <td>
                    <span className={`status ${item.status}`}>
                      {statusLabels[item.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">
          <CalendarDays size={21} />
          Belum ada penugasan mendatang pada periode ini.
        </p>
      )}
    </section>
  );
}

function Events({ data, onMore }: { data: Dashboard; onMore?: () => void }) {
  return (
    <section className="panel events">
      <div className="panel-heading">
        <div>
          <h2>Event Berlangsung</h2>
          <p>Progres pertandingan per event</p>
        </div>
        <span className="count-pill">
          {number.format(data.ongoingEvents)} aktif
        </span>
      </div>
      {data.ongoing.length ? (
        <div className="event-list">
          {data.ongoing.map((event, i) => {
            const progress = event.total
              ? Math.round((event.completed * 100) / event.total)
              : 0;
            return (
              <article key={event.name + i}>
                <div className="event-label">
                  <span className={`event-icon ${colors[i % colors.length]}`}>
                    <Trophy size={15} />
                  </span>
                  <strong>{event.name}</strong>
                  <b>{progress}%</b>
                </div>
                <div
                  className="progress"
                  role="progressbar"
                  aria-label={event.name}
                  aria-valuenow={progress}
                >
                  <span
                    className={colors[i % colors.length]}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p>
                  {event.completed} dari {event.total} pertandingan ·{" "}
                  {event.assigned} wasit
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty">
          <Trophy size={21} />
          Belum ada event berlangsung pada periode ini.
        </p>
      )}
      {onMore && (
        <button className="text-button event-more" onClick={onMore}>
          Lihat event berlangsung <ArrowRight size={15} />
        </button>
      )}
    </section>
  );
}

function Chart({ data }: { data: Dashboard }) {
  return (
    <section className="panel trend">
      <div className="panel-heading">
        <div>
          <h2>Tren Penugasan</h2>
          <p>Aktivitas wasit dalam 6 bulan terakhir</p>
        </div>
        <div className="legend">
          <span>Total</span>
          <span>Selesai</span>
        </div>
      </div>
      <Trend data={data.trend} />
    </section>
  );
}

export function DashboardShell({
  data,
  organization,
  memberships,
  viewer,
  range,
  today,
  demo = false,
}: {
  data: Dashboard;
  organization: Membership;
  memberships: Membership[];
  viewer: Viewer;
  range: ReturnType<typeof dateRange>;
  today: string;
  demo?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const query = useSearchParams();
  const visible = sections.filter(
    (section) => section.id !== "keuangan" || data.money,
  );
  const active =
    visible.find((section) => section.id === query.get("view"))?.id ?? "dasbor";
  const [sidebar, setSidebar] = useState(false);
  const [compact, setCompact] = useState(false);
  const [popup, setPopup] = useState<"date" | "profile" | "org" | null>(null);
  const [period, setPeriod] = useState(range.period);
  const [search, setSearch] = useState("");
  const [dateError, setDateError] = useState(false);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const searchDialog = useRef<HTMLDialogElement>(null);
  const detailDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const shortcuts = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchDialog.current?.showModal();
      }
    };
    window.addEventListener("keydown", shortcuts);
    return () => window.removeEventListener("keydown", shortcuts);
  }, []);

  function go(values: Record<string, string>) {
    const next = new URLSearchParams(query.toString());
    Object.entries(values).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    router.push(next.size ? pathname + "?" + next : pathname);
    setPopup(null);
    setSidebar(false);
  }

  function openAssignment(item: Assignment) {
    setSelected(item);
    searchDialog.current?.close();
    detailDialog.current?.showModal();
  }

  function toggleTheme() {
    const html = document.documentElement;
    const theme = html.dataset.theme === "dark" ? "light" : "dark";
    html.dataset.theme = theme;
    document.cookie = `rh-theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  }

  function togglePopup(name: NonNullable<typeof popup>) {
    setPopup(popup === name ? null : name);
  }

  const term = search.trim().toLocaleLowerCase("id");
  const searchItems = data.upcoming.filter((item) =>
    [item.name, item.match, item.event, item.venue].some((t) =>
      t.toLocaleLowerCase("id").includes(term),
    ),
  );
  const searchSections = visible.filter((section) =>
    section.label.toLocaleLowerCase("id").includes(term),
  );
  const schedule = (
    <Schedule
      items={data.upcoming}
      onOpen={openAssignment}
      onMore={active === "dasbor" ? () => go({ view: "jadwal" }) : undefined}
    />
  );
  const events = (
    <Events
      data={data}
      onMore={active === "dasbor" ? () => go({ view: "event" }) : undefined}
    />
  );
  const periodLabel = periods.find(([key]) => key === range.period)?.[1];

  return (
    <div className={`shell ${compact ? "compact" : ""}`}>
      <button
        aria-label="Tutup navigasi"
        className={`backdrop ${sidebar ? "visible" : ""}`}
        onClick={() => setSidebar(false)}
      />
      <aside
        id="main-sidebar"
        className={`sidebar ${sidebar ? "open" : ""}`}
        aria-label="Navigasi utama"
      >
        <button
          className="brand-button"
          onClick={() => go({ view: "" })}
          aria-label="Referee House — Dasbor"
        >
          <Brand />
        </button>
        <div className="org-wrap">
          <button
            className="organization"
            title={organization.name}
            onClick={() => togglePopup("org")}
            aria-expanded={popup === "org"}
          >
            <span className="org-icon">
              <ShieldCheck size={17} />
            </span>
            <span className="org-text">
              <strong>{organization.name}</strong>
              <small>{demo ? "Ruang kerja demo" : "Organisasi"}</small>
            </span>
            <ChevronsUpDown size={14} className="org-chevron" />
          </button>
          {popup === "org" && (
            <div className="popup org-popup">
              {memberships.map((item) => (
                <button
                  key={item.id}
                  onClick={() => go({ org: item.id, view: "" })}
                >
                  {item.name}
                  {item.id === organization.id && (
                    <span aria-label="Terpilih">✓</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <nav>
          {["RUANG KERJA", "MANAJEMEN"].map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-caption">{group}</div>
              {visible
                .filter((section) => section.group === group)
                .map(({ id, label, icon: Icon }) => (
                  <button
                    className={active === id ? "current" : ""}
                    key={id}
                    title={label}
                    onClick={() => go({ view: id === "dasbor" ? "" : id })}
                    aria-current={active === id ? "page" : undefined}
                  >
                    <Icon size={18} />
                    <span>{label}</span>
                    {id === "notifikasi" && data.pending > 0 && (
                      <b>{data.pending}</b>
                    )}
                  </button>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="sidebar-footer">
            <span />
            {demo ? "Mode demo" : "Ruang kerja aktif"}
          </span>
          <button
            className="collapse"
            onClick={() => setCompact(!compact)}
            aria-label={compact ? "Perluas sidebar" : "Ringkas sidebar"}
          >
            <ChevronLeft size={17} />
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Buka navigasi"
            aria-controls="main-sidebar"
            aria-expanded={sidebar}
            onClick={() => setSidebar(true)}
          >
            <Menu size={21} />
          </button>
          <div className="breadcrumb">
            Ruang kerja <ChevronLeft size={13} />{" "}
            <strong>
              {visible.find((section) => section.id === active)?.label}
            </strong>
          </div>
          <div className="top-actions">
            <button
              className="search-button"
              aria-label="Buka pencarian"
              onClick={() => searchDialog.current?.showModal()}
            >
              <Search size={17} />
              <span>Cari di ruang kerja...</span>
              <kbd>
                <Command size={10} /> K
              </kbd>
            </button>
            <button
              className="icon-button theme-button"
              aria-label="Ganti tema"
              onClick={toggleTheme}
            >
              <Moon size={17} className="moon" />
              <Sun size={17} className="sun" />
            </button>
            <button
              className="icon-button bell-button"
              aria-label="Buka notifikasi"
              onClick={() => go({ view: "notifikasi" })}
            >
              <Bell size={19} />
              {data.pending > 0 && <i />}
            </button>
            <div className="profile-wrap">
              <button
                className="profile"
                aria-label="Menu akun"
                aria-expanded={popup === "profile"}
                onClick={() => togglePopup("profile")}
              >
                <span className="avatar blue">{initials(viewer.name)}</span>
                <span className="profile-text">
                  <strong>{viewer.name}</strong>
                  <small>{roles[viewer.role]}</small>
                </span>
                <ChevronDown size={13} />
              </button>
              {popup === "profile" && (
                <div className="popup profile-popup">
                  <button onClick={() => go({ view: "pengaturan" })}>
                    <Settings size={15} /> Pengaturan
                  </button>
                  {demo ? (
                    <button onClick={() => router.push("/masuk")}>
                      <LogOut size={15} /> Halaman masuk
                    </button>
                  ) : (
                    <form action={signOut}>
                      <button>
                        <LogOut size={15} /> Keluar
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">
          <div className="page-heading">
            <div>
              <h1>
                {active === "dasbor"
                  ? "Dasbor Operasional"
                  : visible.find((section) => section.id === active)?.label}
              </h1>
              <p>
                {active === "dasbor"
                  ? "Pantau aktivitas wasit, pertandingan, dan keuangan dalam satu tempat."
                  : organization.name}
              </p>
            </div>
            {active !== "pengaturan" && (
              <div className="date-wrap">
                <button
                  className="date-button"
                  aria-expanded={popup === "date"}
                  onClick={() => {
                    setPeriod(range.period);
                    setDateError(false);
                    togglePopup("date");
                  }}
                >
                  <CalendarRange size={16} />
                  {periodLabel}
                  <ChevronDown size={14} />
                </button>
                {popup === "date" && (
                  <form
                    className="popup date-popup"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      const from =
                        period === "custom" ? String(form.get("from")) : "";
                      const to =
                        period === "custom" ? String(form.get("to")) : "";
                      if (
                        period === "custom" &&
                        dateRange({ period, from, to }, today).period !==
                          "custom"
                      ) {
                        setDateError(true);
                        return;
                      }
                      go({ period, from, to });
                    }}
                  >
                    <label>
                      Periode
                      <select
                        value={period}
                        onChange={(event) =>
                          setPeriod(event.target.value as typeof period)
                        }
                      >
                        {periods.map(([key, label]) => (
                          <option value={key} key={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {period === "custom" && (
                      <>
                        <label>
                          Mulai
                          <input
                            required
                            name="from"
                            type="date"
                            defaultValue={range.from}
                            min="1900-01-01"
                            max="2200-12-31"
                          />
                        </label>
                        <label>
                          Selesai
                          <input
                            required
                            name="to"
                            type="date"
                            defaultValue={range.to}
                            min="1900-01-01"
                            max="2200-12-31"
                          />
                        </label>
                      </>
                    )}
                    {dateError && (
                      <small role="alert">
                        Pilih rentang dari tanggal mulai hingga tanggal selesai,
                        maksimal selisih 366 hari.
                      </small>
                    )}
                    <button className="primary" type="submit">
                      Terapkan
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {active === "dasbor" && (
            <>
              <section className="hero">
                <div>
                  <span className="hero-date">
                    <CalendarDays size={13} />
                    {formatDate(today, {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {demo && <span className="demo-chip">DATA DEMO</span>}
                  </span>
                  <h2>Selamat datang, {viewer.name.split(" ")[0]}!</h2>
                  <p>
                    Anda memiliki <strong>{data.pending} penugasan</strong> yang
                    menunggu konfirmasi.
                  </p>
                  <button onClick={() => go({ view: "jadwal" })}>
                    Lihat penugasan <ArrowRight size={15} />
                  </button>
                </div>
              </section>
              <div className="section-heading">
                <h2>Ringkasan Operasional</h2>
                <span>
                  {dateLabel(range.from)} – {dateLabel(range.to)}
                </span>
              </div>
              <div className="metrics">
                <Metric
                  icon={UsersRound}
                  tone="blue"
                  label="Total Wasit"
                  value={data.referees}
                  caption={`${number.format(data.activeReferees)} wasit aktif`}
                />
                <Metric
                  icon={Trophy}
                  tone="violet"
                  label="Total Event"
                  value={data.events}
                  caption={`${data.ongoingEvents} berlangsung · ${data.upcomingEvents} mendatang`}
                />
                <Metric
                  icon={ClipboardList}
                  tone="green"
                  label="Total Pertandingan"
                  value={data.matches}
                  caption={`${data.completedMatches} selesai · ${data.upcomingMatches} mendatang`}
                />
                <Metric
                  icon={Wallet}
                  tone="amber"
                  label={data.money ? "Honor Dibayarkan" : "Total Penugasan"}
                  value={
                    data.money ? idr.format(data.money.paid) : data.assignments
                  }
                  caption={
                    data.money
                      ? `${idr.format(data.money.outstanding)} belum dibayar`
                      : `${data.completedAssignments} penugasan selesai`
                  }
                />
              </div>
              <div className="panels">
                <Chart data={data} />
                {events}
              </div>
              {schedule}
            </>
          )}

          {active === "jadwal" && schedule}
          {active === "event" && events}
          {active === "analitik" && (
            <>
              <div className="metrics metrics-secondary">
                <Metric
                  icon={ClipboardList}
                  tone="blue"
                  label="Total Penugasan"
                  value={data.assignments}
                  caption={`${data.completedAssignments} selesai`}
                />
                <Metric
                  icon={Clock3}
                  tone="amber"
                  label="Menunggu Konfirmasi"
                  value={data.pending}
                  caption="Penugasan yang perlu dikonfirmasi"
                />
                <Metric
                  icon={Trophy}
                  tone="violet"
                  label="Event Selesai"
                  value={data.completedEvents}
                  caption="Sesuai periode terpilih"
                />
              </div>
              <Chart data={data} />
            </>
          )}
          {active === "keuangan" && data.money && (
            <div className="metrics">
              <Metric
                icon={Wallet}
                tone="blue"
                label="Honor Diperoleh"
                value={idr.format(data.money.earned)}
                caption="Kompensasi tercatat"
              />
              <Metric
                icon={ShieldCheck}
                tone="violet"
                label="Disetujui"
                value={idr.format(data.money.approved)}
                caption="Kompensasi yang telah disetujui"
              />
              <Metric
                icon={Wallet}
                tone="green"
                label="Dibayarkan"
                value={idr.format(data.money.paid)}
                caption="Pembayaran teralokasi"
              />
              <Metric
                icon={ArrowDownRight}
                tone="amber"
                label="Belum Dibayar"
                value={idr.format(data.money.outstanding)}
                caption="Saldo honor yang telah disetujui"
              />
            </div>
          )}
          {active === "notifikasi" && (
            <section className="panel view-panel">
              <h2>Perlu perhatian</h2>
              {data.pending > 0 ? (
                <button
                  className="alert-row"
                  onClick={() => go({ view: "jadwal" })}
                >
                  <span className="tile amber">
                    <CircleAlert size={19} />
                  </span>
                  <div>
                    <strong>
                      {data.pending} penugasan menunggu konfirmasi
                    </strong>
                    <small>Buka jadwal penugasan</small>
                  </div>
                  <ArrowRight size={17} />
                </button>
              ) : (
                <p className="empty">
                  <Bell size={21} />
                  Belum ada peringatan pada periode ini.
                </p>
              )}
            </section>
          )}
          {active === "pengaturan" && (
            <section className="panel view-panel">
              <h2>Ruang kerja</h2>
              <dl className="facts">
                <dt>Organisasi</dt>
                <dd>{organization.name}</dd>
                <dt>Akun</dt>
                <dd>{viewer.name}</dd>
                <dt>Peran</dt>
                <dd>{roles[viewer.role]}</dd>
                <dt>Zona waktu</dt>
                <dd>Asia/Jakarta (WIB)</dd>
                <dt>Mata uang</dt>
                <dd>IDR</dd>
              </dl>
              <button className="date-button" onClick={toggleTheme}>
                <Moon size={16} /> Ganti tema
              </button>
            </section>
          )}
          <footer className="workspace-footer">
            Referee House
            <span>
              Waktu Indonesia Barat <b>·</b> IDR
            </span>
          </footer>
        </main>
      </div>

      <dialog
        ref={searchDialog}
        className="dialog"
        aria-labelledby="search-title"
      >
        <div className="dialog-heading">
          <h2 id="search-title">Pencarian ruang kerja</h2>
          <button
            className="icon-button"
            aria-label="Tutup pencarian"
            onClick={() => searchDialog.current?.close()}
          >
            <X size={19} />
          </button>
        </div>
        <input
          className="search-input"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Cari tampilan atau penugasan mendatang"
          aria-label="Kata kunci pencarian"
        />
        <div className="search-results">
          {searchSections.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                go({ view: section.id });
                searchDialog.current?.close();
              }}
            >
              <section.icon size={17} />
              <span>{section.label}</span>
              <ArrowRight size={15} />
            </button>
          ))}
          {searchItems.map((item) => (
            <button key={item.id} onClick={() => openAssignment(item)}>
              <ClipboardList size={17} />
              <span>
                {item.match}
                <small>
                  {item.name} · {item.event}
                </small>
              </span>
              <ArrowRight size={15} />
            </button>
          ))}
          {!searchSections.length && !searchItems.length && (
            <p className="empty">Tidak ada hasil pencarian.</p>
          )}
        </div>
      </dialog>
      <dialog
        ref={detailDialog}
        className="dialog"
        aria-labelledby="assignment-title"
      >
        <div className="dialog-heading">
          <h2 id="assignment-title">Detail Penugasan</h2>
          <button
            className="icon-button"
            aria-label="Tutup detail"
            onClick={() => detailDialog.current?.close()}
          >
            <X size={19} />
          </button>
        </div>
        {selected && (
          <>
            <h3>{selected.match}</h3>
            <p className="detail-venue">
              <MapPin size={15} />
              {selected.venue}
            </p>
            <dl className="facts">
              <dt>Event</dt>
              <dd>{selected.event}</dd>
              <dt>Wasit</dt>
              <dd>{selected.name}</dd>
              <dt>Posisi</dt>
              <dd>{selected.position}</dd>
              <dt>Jadwal</dt>
              <dd>
                {dateLabel(selected.startsAt)} ·{" "}
                {formatDate(selected.startsAt, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                WIB
              </dd>
              <dt>Status</dt>
              <dd>
                <span className={`status ${selected.status}`}>
                  {statusLabels[selected.status]}
                </span>
              </dd>
            </dl>
          </>
        )}
      </dialog>
    </div>
  );
}
