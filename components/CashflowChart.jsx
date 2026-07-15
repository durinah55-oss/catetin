"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/** Grafik alur kas — dipisah agar recharts tidak ikut bundle beranda. */
export default function CashflowChart({ chart, cur, fmtMoney, dayLabel }) {
  if (!chart?.length || chart.every((p) => p.in === 0 && p.out === 0)) {
    return (
      <div style={{ height: 180, display: "grid", placeItems: "center", color: "var(--ink3)", fontSize: 13, textAlign: "center", padding: 16 }}>
        Tidak ada transaksi pada periode ini.
      </div>
    );
  }

  return (
    <div style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="go" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10, fill: "var(--ink3)" }}
            axisLine={false}
            tickLine={false}
            interval={chart.length > 14 ? Math.floor(chart.length / 7) : 0}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "var(--ink3)" }}
            axisLine={false}
            tickLine={false}
            width={38}
            tickFormatter={(v) => (v >= 1000000 ? `${v / 1000000}jt` : v >= 1000 ? `${v / 1000}k` : v)}
          />
          <Tooltip
            formatter={(v, n) => [fmtMoney(v, cur), n === "in" ? "Masuk" : "Keluar"]}
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.iso ? dayLabel(payload[0].payload.iso) : "")}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12, background: "var(--surface)" }}
          />
          <Area type="monotone" dataKey="in" stroke="#22C55E" strokeWidth={2} fill="url(#gi)" />
          <Area type="monotone" dataKey="out" stroke="#EF4444" strokeWidth={2} fill="url(#go)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
