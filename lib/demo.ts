import type { Assignment, Dashboard } from "./dashboard";
import { dateRange, dateShift, todayInJakarta } from "./dates";

const fixtures = [
  [
    "Rizky Pratama",
    "Liga Basket Nusantara",
    "Garuda vs. Rajawali",
    "GOR Patriot",
    "14:00",
    "Wasit Utama",
    "accepted",
  ],
  [
    "Andi Saputra",
    "Piala Pelajar Jakarta",
    "SMP 12 vs. SMP 48",
    "Lapangan Senayan",
    "15:30",
    "Asisten Wasit 1",
    "pending",
  ],
  [
    "Dewi Lestari",
    "Liga Basket Nusantara",
    "Elang Muda vs. Bintang Basket",
    "GOR Soemantri",
    "16:00",
    "Wasit Utama",
    "accepted",
  ],
  [
    "Fajar Hidayat",
    "Kejuaraan KU-14",
    "Merah Putih vs. Tunas Muda",
    "Lapangan ABC",
    "09:00",
    "Wasit Keempat",
    "pending",
  ],
  [
    "Bagus Ramadhan",
    "Piala Pelajar Jakarta",
    "SMA 9 vs. SMA 6",
    "Lapangan Senayan",
    "13:00",
    "Asisten Wasit 2",
    "accepted",
  ],
] as const;

export function demoDashboard(
  range: ReturnType<typeof dateRange>,
  today = todayInJakarta(),
): Dashboard {
  const upcoming: Assignment[] = fixtures
    .map(([name, event, match, venue, time, position, status], index) => ({
      id: "00000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
      name,
      event,
      match,
      venue,
      startsAt:
        dateShift(today, Math.floor(index / 2)) + "T" + time + ":00+07:00",
      position,
      status,
    }))
    .filter(
      ({ startsAt }) =>
        startsAt.slice(0, 10) >= range.from &&
        startsAt.slice(0, 10) <= range.to,
    );
  const months = [0, 1, 2, 3, 4, 5].map((offset) => {
    const month = new Date(range.to + "T00:00:00Z");
    month.setUTCDate(1);
    month.setUTCMonth(month.getUTCMonth() - 5 + offset);
    return month.toISOString().slice(0, 10);
  });
  const monthScale = {
    today: 0.05,
    week: 0.31,
    month: 1,
    "last-month": 0.85,
    year: 8,
    custom: Math.min(
      12,
      (1 + (Date.parse(range.to) - Date.parse(range.from)) / 86400000) / 30,
    ),
  }[range.period];
  const scale = (value: number) => Math.round(value * monthScale);
  const earned = scale(24500000),
    approved = scale(21750000),
    paid = scale(18250000);
  return {
    referees: 128,
    activeReferees: 112,
    events: scale(18),
    upcomingEvents: scale(6),
    ongoingEvents: scale(3),
    completedEvents: scale(8),
    matches: scale(86),
    upcomingMatches: scale(24),
    completedMatches: scale(62),
    assignments: scale(246),
    pending: scale(12),
    completedAssignments: scale(198),
    money: { earned, approved, paid, outstanding: approved - paid },
    trend: months.map((month, i) => ({
      month,
      assigned: [82, 128, 111, 169, 155, 212][i],
      completed: [62, 105, 89, 136, 127, 178][i],
    })),
    upcoming,
    ongoing: [
      { name: "Liga Basket Nusantara", total: 32, completed: 24, assigned: 18 },
      { name: "Piala Pelajar Jakarta", total: 24, completed: 13, assigned: 14 },
      { name: "Kejuaraan KU-14", total: 16, completed: 6, assigned: 10 },
    ].slice(0, scale(3)),
  };
}
