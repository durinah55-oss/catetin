"use client";
// Review & approve cluster alias barang purchasing (owner/admin).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { canDo } from "../lib/rbac";
import { readStoredSession } from "../lib/authBootstrap";
import { supabase } from "../lib/supabaseClient";

const FILTERS = [
  { id: "all", label: "Semua" },
  { id: "pending", label: "Belum direview" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Ditolak" },
];

function authHeaders(session) {
  const token = session?.access_token || readStoredSession()?.access_token;
  return token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : {};
}

function fmtSuppliers(list) {
  if (!list?.length) return "—";
  return list.slice(0, 3).join(", ");
}

export default function PurchasingAliasesReview({ bizId, session, role, embedded = false, onClose }) {
  const router = useRouter();
  const canManage = canDo(role, "kelolaKategoriSemua");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [scanMeta, setScanMeta] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [reviews, setReviews] = useState({});
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState({});
  const [busyId, setBusyId] = useState(null);

  const loadScan = useCallback(async () => {
    if (!bizId) return;
    setLoading(true);
    setErr("");
    try {
      const headers = authHeaders(session);
      if (!headers.Authorization) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }
      const res = await fetch(`/api/purchasing/aliases-scan?businessId=${encodeURIComponent(bizId)}`, {
        headers,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat scan");
      setScanMeta({
        scanFile: data.scanFile,
        generatedAt: data.generatedAt,
        summary: data.summary,
      });
      setClusters(data.clusters || []);
      setReviews(data.reviews || {});
    } catch (e) {
      setErr(e.message || "Gagal memuat");
    } finally {
      setLoading(false);
    }
  }, [bizId, session]);

  useEffect(() => {
    if (!canManage) {
      setLoading(false);
      return;
    }
    if (bizId) loadScan();
  }, [canManage, bizId, loadScan]);

  const canonicalFor = (cluster) => {
    const cid = cluster.cluster_id;
    if (editing[cid] != null) return editing[cid];
    return reviews[cid]?.canonical_name || cluster.canonical_suggestion;
  };

  const reviewStatus = (clusterId) => reviews[clusterId]?.status || null;

  const stats = useMemo(() => {
    const total = clusters.length;
    let approved = 0;
    let rejected = 0;
    for (const c of clusters) {
      const st = reviewStatus(c.cluster_id);
      if (st === "approved") approved++;
      else if (st === "rejected") rejected++;
    }
    const reviewed = approved + rejected;
    return { total, approved, rejected, reviewed, pending: total - reviewed };
  }, [clusters, reviews]);

  const filtered = useMemo(() => {
    return clusters.filter((c) => {
      const st = reviewStatus(c.cluster_id);
      if (filter === "pending") return !st;
      if (filter === "approved") return st === "approved";
      if (filter === "rejected") return st === "rejected";
      return true;
    });
  }, [clusters, filter, reviews]);

  const submitReview = async (cluster, action) => {
    if (!scanMeta?.scanFile) return;
    setBusyId(cluster.cluster_id);
    setErr("");
    try {
      const headers = authHeaders(session);
      if (!headers.Authorization) {
        throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
      }
      const res = await fetch("/api/purchasing/aliases-review", {
        method: "POST",
        headers,
        body: JSON.stringify({
          businessId: bizId,
          scanFile: scanMeta.scanFile,
          clusterId: cluster.cluster_id,
          action,
          canonicalName: action === "approve" ? canonicalFor(cluster) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      setReviews((prev) => ({
        ...prev,
        [cluster.cluster_id]: {
          status: data.status,
          canonical_name: data.canonical_name,
          reviewed_at: new Date().toISOString(),
        },
      }));
      if (action === "approve") {
        setEditing((prev) => {
          const next = { ...prev };
          delete next[cluster.cluster_id];
          return next;
        });
      }
    } catch (e) {
      setErr(e.message || "Gagal menyimpan");
    } finally {
      setBusyId(null);
    }
  };

  const exportApproved = async () => {
    setErr("");
    try {
      const { data, error } = await supabase
        .from("purchasing_item_aliases")
        .select("canonical_name, alias_name, category_hint, verified_at")
        .eq("business_id", bizId)
        .order("canonical_name")
        .order("alias_name");

      if (error) {
        if (/does not exist/i.test(error.message || "")) {
          throw new Error("Tabel alias belum ada. Jalankan migration SQL dulu.");
        }
        throw error;
      }

      const header = "canonical_name,alias_name,category_hint,verified_at";
      const rows = (data || []).map((r) =>
        [r.canonical_name, r.alias_name, r.category_hint || "", r.verified_at || ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      );
      const csv = [header, ...rows].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchasing-aliases-${bizId?.slice(0, 8) || "export"}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e.message || "Gagal export");
    }
  };

  const goBack = () => {
    if (onClose) onClose();
    else router.push("/dashboard");
  };

  if (!canManage) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>
        Hanya owner/admin yang bisa review alias barang.
      </div>
    );
  }

  const progressPct = stats.total ? Math.round((stats.reviewed / stats.total) * 100) : 0;

  return (
    <div style={{ padding: embedded ? "12px 16px 24px" : "20px 16px 80px", maxWidth: 640, margin: "0 auto" }}>
      {!embedded && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button
            type="button"
            onClick={goBack}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #E8E8F0",
              background: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#4338CA",
            }}
          >
            ← Kembali
          </button>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: "#1A1A2E", margin: 0 }}>
              Alias Barang Purchasing
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0" }}>
              Review cluster dari scan terbaru
            </p>
          </div>
        </div>
      )}

      {embedded && (
        <p style={{ fontSize: 13, color: "var(--ink3)", margin: "0 0 12px", lineHeight: 1.45 }}>
          Setelah di-approve, AI bisa kenali nama barang yang sama — misal &quot;ayam paha fillet&quot; = &quot;paha fillet&quot; = &quot;fillet ayam&quot;.
        </p>
      )}

      {scanMeta && (
        <div
          style={{
            background: "#EEF2FF",
            border: "1px solid #C7D2FE",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: "#4338CA",
          }}
        >
          Scan: <strong>{scanMeta.scanFile}</strong>
          {scanMeta.generatedAt && (
            <span style={{ color: "#6366F1" }}> · {new Date(scanMeta.generatedAt).toLocaleString("id-ID")}</span>
          )}
        </div>
      )}

      <div
        style={{
          background: embedded ? "var(--surface)" : "#fff",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "14px 16px",
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>
          {stats.reviewed} dari {stats.total} cluster sudah direview ({stats.approved} approve, {stats.rejected}{" "}
          tolak)
        </div>
        <div
          style={{
            height: 8,
            borderRadius: 99,
            background: "#F3F4F6",
            overflow: "hidden",
            marginBottom: 12,
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: "linear-gradient(90deg, #6366F1, #818CF8)",
              borderRadius: 99,
              transition: "width 0.3s",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: "6px 12px",
                borderRadius: 99,
                border: `1px solid ${filter === f.id ? "#6366F1" : "var(--line)"}`,
                background: filter === f.id ? "#EEF2FF" : embedded ? "var(--surface2)" : "#fff",
                color: filter === f.id ? "#4338CA" : "var(--ink3)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={exportApproved}
            style={{
              marginLeft: "auto",
              padding: "6px 14px",
              borderRadius: 99,
              border: "1px solid #15803D",
              background: "#DCFCE7",
              color: "#15803D",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Export approved
          </button>
        </div>
      </div>

      {err && (
        <div
          style={{
            background: "#FEE2E2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
            borderRadius: 12,
            padding: "12px 14px",
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>Memuat cluster…</div>
      ) : !filtered.length ? (
        <div style={{ textAlign: "center", padding: 40, color: "#9CA3AF" }}>
          {filter === "all" ? "Tidak ada cluster." : "Tidak ada cluster untuk filter ini."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map((cluster) => {
            const cid = cluster.cluster_id;
            const st = reviewStatus(cid);
            const canonical = canonicalFor(cluster);
            const isBusy = busyId === cid;
            const confColor =
              cluster.confidence === "high"
                ? { bg: "#DCFCE7", text: "#15803D" }
                : cluster.confidence === "medium"
                  ? { bg: "#FEF3C7", text: "#D97706" }
                  : { bg: "#F3F4F6", text: "#6B7280" };

            return (
              <div
                key={cid}
                style={{
                  background: embedded ? "var(--surface)" : "#fff",
                  border: `1px solid ${st === "approved" ? "#BBF7D0" : st === "rejected" ? "#FECACA" : "var(--line)"}`,
                  borderRadius: 16,
                  padding: "16px",
                  opacity: st === "rejected" ? 0.75 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "var(--ink)" }}>
                      Cluster #{cid}
                      {st === "approved" && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#15803D", fontWeight: 700 }}>✓ Approved</span>
                      )}
                      {st === "rejected" && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#B91C1C", fontWeight: 700 }}>✗ Ditolak</span>
                      )}
                    </div>
                    <span
                      style={{
                        display: "inline-block",
                        marginTop: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 99,
                        background: confColor.bg,
                        color: confColor.text,
                      }}
                    >
                      confidence: {cluster.confidence}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600 }}>{cluster.total_freq}x total</span>
                </div>

                <div style={{ marginTop: 12, marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 4 }}>Canonical:</div>
                  {editing[cid] != null ? (
                    <input
                      value={editing[cid]}
                      onChange={(e) => setEditing((prev) => ({ ...prev, [cid]: e.target.value }))}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: 10,
                        border: "1px solid #6366F1",
                        fontSize: 14,
                        fontWeight: 700,
                        color: "var(--ink)",
                        outline: "none",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#4338CA" }}>{canonical}</div>
                  )}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                  {(cluster.members || []).map((m) => (
                    <div
                      key={m.name}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                        fontSize: 13,
                        color: "var(--ink2)",
                        padding: "6px 0",
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      <div>
                        <strong>{m.freq}x</strong> {m.name}
                      </div>
                      <div style={{ textAlign: "right", fontSize: 12, color: "#9CA3AF" }}>
                        {m.last_seen || "—"} · {fmtSuppliers(m.suppliers)}
                      </div>
                    </div>
                  ))}
                </div>

                {cluster.reason && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--ink3)",
                      background: "var(--surface2)",
                      borderRadius: 8,
                      padding: "8px 10px",
                      marginBottom: 12,
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    reason: {cluster.reason}
                  </div>
                )}

                {!st && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => submitReview(cluster, "approve")}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        border: "none",
                        background: "#15803D",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: isBusy ? "wait" : "pointer",
                        opacity: isBusy ? 0.7 : 1,
                      }}
                    >
                      ✓ Approve
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => submitReview(cluster, "reject")}
                      style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        background: "#FEE2E2",
                        color: "#B91C1C",
                        fontWeight: 700,
                        fontSize: 13,
                        border: "1px solid #FECACA",
                        cursor: isBusy ? "wait" : "pointer",
                        opacity: isBusy ? 0.7 : 1,
                      }}
                    >
                      ✗ Tolak
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        setEditing((prev) => ({
                          ...prev,
                          [cid]: prev[cid] ?? canonical,
                        }))
                      }
                      style={{
                        padding: "9px 16px",
                        borderRadius: 10,
                        background: embedded ? "var(--surface2)" : "#fff",
                        color: "#4338CA",
                        fontWeight: 700,
                        fontSize: 13,
                        border: "1px solid #C7D2FE",
                        cursor: "pointer",
                      }}
                    >
                      ✎ Edit canonical
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Ringkas jumlah cluster pending — untuk kartu Beranda owner. */
export async function fetchAliasReviewSummary(bizId, session) {
  const token = session?.access_token || readStoredSession()?.access_token;
  if (!token || !bizId) return null;
  const res = await fetch(`/api/purchasing/aliases-scan?businessId=${encodeURIComponent(bizId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) return null;
  const total = (data.clusters || []).length;
  const reviewed = Object.keys(data.reviews || {}).length;
  return { total, pending: Math.max(0, total - reviewed), reviewed };
}
