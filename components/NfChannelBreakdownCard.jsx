"use client";

import { findMpStore } from "../lib/nfSalesChannels.js";

/**
 * Kartu ringkasan omzet per channel NF — compact (Beranda) atau full (Laporan).
 */
export default function NfChannelBreakdownCard({
  breakdown,
  mpStores = [],
  cur = "IDR",
  fmtMoney,
  variant = "compact",
  onDetailClick,
}) {
  if (!breakdown || breakdown.totalRevenue <= 0) return null;

  const isCompact = variant === "compact";
  const topRows = isCompact
    ? breakdown.categoryRows.slice(0, 5)
    : breakdown.categoryRows;

  return (
    <div style={{ margin: isCompact ? "0 16px 20px" : "0 16px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)" }}>
          {isCompact ? "Omzet per Channel" : "Omzet per Channel"}
        </div>
        {isCompact && onDetailClick && (
          <button
            type="button"
            onClick={onDetailClick}
            style={{ fontSize: 12, fontWeight: 600, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            Detail →
          </button>
        )}
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--line)", overflow: "hidden" }}>
        {isCompact && (
          <div style={{ padding: "14px 16px", background: "var(--surface2)", borderBottom: "1px solid var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontSize: 12, color: "var(--ink3)" }}>Total omzet</span>
              <span className="money" style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>
                {fmtMoney(breakdown.totalRevenue, cur)}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
              <div style={{ padding: "8px 10px", borderRadius: 10, background: "var(--surface)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Marketplace</div>
                <div className="money" style={{ fontSize: 14, fontWeight: 700, color: breakdown.mpDependencyPct >= 70 ? "var(--out-text)" : "var(--in-text)", marginTop: 2 }}>
                  {breakdown.mpDependencyPct.toFixed(0)}%
                </div>
              </div>
              <div style={{ padding: "8px 10px", borderRadius: 10, background: "var(--surface)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Kelola sendiri</div>
                <div className="money" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginTop: 2 }}>
                  {breakdown.selfManagedPct.toFixed(0)}%
                </div>
              </div>
            </div>
          </div>
        )}

        {!isCompact && breakdown.mpPlatformRows.map((row) => (
          <div key={row.categoryId} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--ink2)" }}>{row.label}</span>
            <span className="money" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {fmtMoney(row.amount, cur)}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink3)", marginLeft: 6 }}>{row.pct.toFixed(0)}%</span>
            </span>
          </div>
        ))}

        {!isCompact && breakdown.groupRows.filter((g) => g.id !== "marketplace" && g.amount > 0).map((row) => (
          <div key={row.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--ink2)" }}>{row.label}</span>
            <span className="money" style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
              {fmtMoney(row.amount, cur)}
              <span style={{ fontSize: 11, fontWeight: 500, color: "var(--ink3)", marginLeft: 6 }}>{row.pct.toFixed(0)}%</span>
            </span>
          </div>
        ))}

        {(isCompact ? topRows : []).map((row) => (
          <div key={row.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: "var(--ink2)" }}>{row.name}</span>
            <span className="money" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{fmtMoney(row.amount, cur)}</span>
          </div>
        ))}

        {!isCompact && (
          <div style={{ padding: "12px 16px", background: "var(--surface2)", display: "grid", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>Total omzet</span>
              <span className="money" style={{ fontWeight: 800 }}>{fmtMoney(breakdown.totalRevenue, cur)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink2)" }}>
              <span>Ketergantungan marketplace</span>
              <span style={{ fontWeight: 700, color: breakdown.mpDependencyPct >= 70 ? "var(--out-text)" : "var(--in-text)" }}>
                {breakdown.mpDependencyPct.toFixed(1)}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink2)" }}>
              <span>Settlement MP vs kelola sendiri</span>
              <span style={{ fontWeight: 600 }}>
                {fmtMoney(breakdown.mpTotal, cur)} / {fmtMoney(breakdown.selfManagedTotal, cur)}
              </span>
            </div>
          </div>
        )}

        {!isCompact && Object.keys(breakdown.byStore).length > 0 && (
          <div style={{ padding: "10px 16px 12px", borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Per toko MP</div>
            {Object.entries(breakdown.byStore).sort((a, b) => b[1] - a[1]).map(([storeId, amount]) => {
              const store = findMpStore(mpStores, storeId);
              const label = store ? `${store.name} (${store.code})` : storeId;
              return (
                <div key={storeId} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink2)", marginBottom: 4 }}>
                  <span>{label}</span>
                  <span className="money">{fmtMoney(amount, cur)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
