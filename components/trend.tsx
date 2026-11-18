"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Dashboard } from "@/lib/dashboard";
import { formatDate } from "@/lib/dates";

export function Trend({ data }: { data: Dashboard["trend"] }) {
  const points = data.map((point) => ({
    ...point,
    label: formatDate(point.month, { month: "short" }),
  }));
  return (
    <div className="chart-area" aria-label="Grafik tren penugasan enam bulan">
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 560, height: 205 }}
      >
        <AreaChart
          data={points}
          margin={{ top: 12, right: 11, left: -16, bottom: 0 }}
        >
          <defs>
            <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#4165f5" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#4165f5" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--line)"
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickMargin={9}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickMargin={11}
          />
          <Tooltip
            contentStyle={{
              background: "var(--paper)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: 9,
              fontSize: 12,
            }}
          />
          <Area
            name="Selesai"
            dataKey="completed"
            type="monotone"
            stroke="#18ae90"
            strokeWidth={2.5}
            fill="none"
          />
          <Area
            name="Total penugasan"
            dataKey="assigned"
            type="monotone"
            stroke="#4165f5"
            strokeWidth={2.7}
            fill="url(#trend-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
