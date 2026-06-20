"use client";
// components/AsistenPurchasing.jsx — Q&A purchasing dari data transaksi belanja (scope sempit)

import { useCallback, useMemo, useState } from "react";
import { Sparkles, Send, Loader2, ArrowLeft } from "lucide-react";
import { buildPurchasingAiContext, PURCHASING_QUICK_PROMPTS } from "../lib/purchasingAiContext";
import { fetchPurchasingAdvice } from "../lib/appState";
import { readStoredSession } from "../lib/authBootstrap";
import { useApp } from "./layout/BusinessProvider";
import { PURCHASING_OUTLETS, formatRupiah } from "../lib/purchasingExpense";

function Card({ children, style }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, ...style }}>
      {children}
    </div>
  );
}

export default function AsistenPurchasing({ s, bizId, onClose }) {
  const { session } = useApp();
  const [days, setDays] = useState(90);
  const [outlet, setOutlet] = useState("all");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [history, setHistory] = useState([]);

  const context = useMemo(
    () =>
      buildPurchasingAiContext({
        transactions: s.transactions,
        categories: s.categories,
        days,
        outlet,
      }),
    [s.transactions, s.categories, days, outlet]
  );

  const ask = useCallback(
    async (q) => {
      const text = (q || question).trim();
      if (!text || loading) return;
      setLoading(true);
      setErr("");
      setQuestion("");
      try {
        const token = session?.access_token || readStoredSession()?.access_token;
        if (!token) throw new Error("Sesi login tidak ditemukan. Silakan login ulang.");
        const result = await fetchPurchasingAdvice(
          { businessId: bizId, question: text, context },
          token
        );
        setHistory((prev) => [
          { q: text, ...result, at: new Date().toISOString() },
          ...prev,
        ].slice(0, 12));
      } catch (e) {
        setErr(e.message || "Gagal mendapat jawaban");
      } finally {
        setLoading(false);
      }
    },
    [question, loading, bizId, context, session]
  );

  const content = (
    <div style={{ padding: onClose ? "0 0 24px" : "0 0 90px" }}>
      {!onClose && (
        <div style={{ padding: "16px 20px 4px" }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Asisten Purchasing</div>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>
            Tanya kendala belanja — data dari transaksi purchasing saja
          </div>
        </div>
      )}

      <div style={{ padding: "8px 16px 12px" }}>
        <div
          style={{
            padding: "12px 14px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            borderLeft: "4px solid #F59E0B",
            borderRadius: 10,
            fontSize: 12,
            lineHeight: 1.55,
            color: "#92400E",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>🔒 Informasi ini bersifat rahasia perusahaan.</div>
          <p style={{ margin: "0 0 8px" }}>
            Asisten Purchasing membaca riwayat transaksi internal untuk membantu staf mencari informasi barang dan supplier. Jawaban AI dapat mengandung kesalahan — jangan jadikan satu-satunya acuan keputusan pembelian.
          </p>
          <p style={{ margin: 0 }}>
            Keputusan harga, pilihan supplier, dan jumlah pembelian tetap sepenuhnya menjadi wewenang owner atau PIC Purchasing. Jangan bagikan informasi ini ke pihak luar perusahaan.
          </p>
        </div>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <Card style={{ padding: "12px 14px", background: "#EEF2FF", border: "1px solid #C7D2FE" }}>
          <div style={{ fontSize: 12, color: "#4338CA", fontWeight: 600 }}>
            Scope: {context.summary.transactionCount} transaksi · {context.summary.totalSpendLabel}
          </div>
          <div style={{ fontSize: 11, color: "#6366F1", marginTop: 4 }}>
            {context.period.from} → {context.period.to} · {context.outletFilter}
            {context.summary.transactionCount === 0 && (
              <span style={{ color: "#B91C1C", fontWeight: 700 }}> · Data kosong — muat ulang dari awan</span>
            )}
          </div>
        </Card>
      </div>

      <div style={{ padding: "0 16px 10px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            style={{
              padding: "7px 12px",
              borderRadius: 99,
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 12,
              background: days === d ? "var(--brand)" : "var(--surface2)",
              color: days === d ? "#fff" : "var(--ink2)",
            }}
          >
            {d} hari
          </button>
        ))}
        <select
          value={outlet}
          onChange={(e) => setOutlet(e.target.value)}
          style={{
            padding: "7px 10px",
            borderRadius: 99,
            border: "1px solid var(--line)",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--surface)",
            color: "var(--ink2)",
          }}
        >
          <option value="all">Semua outlet</option>
          {PURCHASING_OUTLETS.map((o) => (
            <option key={o.code} value={o.code}>{o.label}</option>
          ))}
        </select>
      </div>

      <div style={{ padding: "0 16px 12px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", marginBottom: 8 }}>Pertanyaan cepat</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {PURCHASING_QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => ask(p)}
              disabled={loading}
              style={{
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                fontSize: 13,
                color: "var(--ink2)",
                cursor: loading ? "wait" : "pointer",
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ padding: "0 16px 16px", display: "flex", gap: 8 }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder="Tanya kendala purchasing…"
          disabled={loading}
          style={{
            flex: 1,
            padding: "12px 14px",
            borderRadius: 12,
            border: "1px solid var(--line)",
            background: "var(--surface)",
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={() => ask()}
          disabled={loading || !question.trim()}
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            border: "none",
            background: "var(--brand)",
            color: "#fff",
            cursor: loading ? "wait" : "pointer",
            display: "grid",
            placeItems: "center",
            opacity: loading || !question.trim() ? 0.6 : 1,
          }}
        >
          {loading ? <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={20} />}
        </button>
      </div>

      {err && (
        <div style={{ margin: "0 16px 12px", padding: 12, borderRadius: 12, background: "#FEE2E2", color: "#B91C1C", fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {history.map((h, i) => (
          <Card key={i} style={{ padding: 0, overflow: "hidden", border: "1px solid #C7D2FE" }}>
            <div style={{ padding: "10px 14px", background: "#F5F3FF", fontSize: 13, fontWeight: 600, color: "#4338CA" }}>
              {h.q}
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <Sparkles size={18} color="#6366F1" style={{ flexShrink: 0, marginTop: 2 }} />
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: "var(--ink)" }}>{h.answer}</p>
              </div>
              {h.highlights?.length > 0 && (
                <ul style={{ margin: "0 0 8px", paddingLeft: 18, fontSize: 13, color: "var(--ink2)" }}>
                  {h.highlights.map((x, j) => <li key={j}>{x}</li>)}
                </ul>
              )}
              {h.actionHint && (
                <div style={{ fontSize: 12, color: "#15803D", fontWeight: 600, marginTop: 8 }}>
                  → {h.actionHint}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      {context.byCategory.length > 0 && (
        <div style={{ padding: "16px 16px 0" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink3)", marginBottom: 8 }}>Ringkas kategori ({days} hari)</div>
          {context.byCategory.slice(0, 5).map((c) => (
            <div key={c.name} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
              <span style={{ color: "var(--ink2)" }}>{c.name}</span>
              <span style={{ fontWeight: 700, color: "var(--ink)" }}>{formatRupiah(c.total)}</span>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (onClose) {
    return (
      <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", background: "var(--surface)", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
          <button type="button" onClick={onClose} style={{ width: 36, height: 36, borderRadius: 99, background: "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink)" }}>
            <ArrowLeft size={18} />
          </button>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Asisten Purchasing</span>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }} className="scroll-hide">{content}</div>
      </div>
    );
  }

  return content;
}
