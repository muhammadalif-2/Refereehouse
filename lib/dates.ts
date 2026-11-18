import { z } from "zod";

export const jakarta = "Asia/Jakarta";
const localDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: jakarta,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function todayInJakarta(now = new Date()) {
  return localDate.format(now);
}

export const periods = [
  ["today", "Hari ini"],
  ["week", "Minggu ini"],
  ["month", "Bulan ini"],
  ["last-month", "Bulan lalu"],
  ["year", "Tahun ini"],
  ["custom", "Rentang khusus"],
] as const;

export function dateShift(day: string, amount: number) {
  const date = new Date(day + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function dateRange(
  params: Record<string, string | string[] | undefined>,
  today = todayInJakarta(),
) {
  const period = periods.find(([key]) => params.period === key)?.[0] ?? "month";
  const month = today.slice(0, 7) + "-01";
  if (period === "today") return { from: today, to: today, period };
  if (period === "week") {
    const weekday = new Date(today + "T00:00:00Z").getUTCDay();
    const from = dateShift(today, -(weekday + 6) % 7);
    return { from, to: dateShift(from, 6), period };
  }
  if (period === "year")
    return {
      from: today.slice(0, 4) + "-01-01",
      to: today.slice(0, 4) + "-12-31",
      period,
    };
  if (period === "last-month") {
    const to = dateShift(month, -1);
    return { from: to.slice(0, 7) + "-01", to, period };
  }
  if (period === "custom") {
    const start = z.iso.date().safeParse(params.from);
    const end = z.iso.date().safeParse(params.to);
    if (
      start.success &&
      end.success &&
      start.data >= "1900-01-01" &&
      end.data <= "2200-12-31" &&
      start.data <= end.data &&
      Date.parse(end.data) - Date.parse(start.data) <= 366 * 86_400_000
    ) {
      return { from: start.data, to: end.data, period };
    }
  }
  return {
    from: month,
    to: dateShift(dateShift(month, 32).slice(0, 7) + "-01", -1),
    period: "month" as const,
  };
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", {
    ...options,
    timeZone: jakarta,
  }).format(new Date(value));
}
