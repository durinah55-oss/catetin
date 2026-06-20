"use client";
// Halaman PC — input kode dari HP → masuk dashboard web (tanpa password).

import { useState } from "react";
import { Monitor, Smartphone, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";

export default function PairPage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const connect = async (e) => {
    e?.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return;
    setLoading(true);
    setErr("");

    try {
      // 1. Approve kode (PC side)
      const approveRes = await fetch(`/api/pair?code=${encodeURIComponent(c)}`);
      const approveJson = await approveRes.json();
      if (!approveRes.ok) throw new Error(approveJson.error || "Kode tidak valid");

      // 2. Tukar jadi sesi login
      const claimRes = await fetch("/api/pair/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: c }),
      });
      const claimJson = await claimRes.json();
      if (!claimRes.ok) throw new Error(claimJson.error || "Gagal masuk");

      await supabase.auth.setSession({
        access_token: claimJson.access_token,
        refresh_token: claimJson.refresh_token,
      });

      localStorage.setItem("nf3:lastBiz", claimJson.businessId);
      window.location.href = `/dashboard?biz=${claimJson.businessId}&view=web`;
    } catch (e2) {
      setErr(e2.message || "Gagal hubungkan");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg,#EEF2FF 0%,#F0F0F8 50%,#F0FDF4 100%)", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: "#4F46E5" }}>NF3 Web</div>
          <div style={{ fontSize: 15, color: "#6B7280", marginTop: 6 }}>Dashboard PC — laporan & export</div>
        </div>

        <div style={{ background: "#fff", borderRadius: 24, padding: 32, border: "1px solid #E8E8F0", boxShadow: "0 8px 32px rgba(99,102,241,.08)" }}>
          {/* ilustrasi alur */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 28 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#EEF2FF", display: "grid", placeItems: "center", margin: "0 auto 6px" }}>
                <Smartphone size={28} color="#6366F1" />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>HP</div>
            </div>
            <ArrowRight size={20} color="#9CA3AF" />
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: "#DCFCE7", display: "grid", placeItems: "center", margin: "0 auto 6px" }}>
                <Monitor size={28} color="#16A34A" />
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>PC (kamu)</div>
            </div>
          </div>

          <div style={{ fontSize: 16, fontWeight: 700, color: "#1A1A2E", marginBottom: 8 }}>
            Masukkan kode dari HP
          </div>
          <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 20, lineHeight: 1.5 }}>
            Di HP: <b>Pengaturan → Hubungkan ke Web</b>. Salin kode <b>WARUNG-XXXXXX</b>, lalu tempel di sini.
          </div>

          <form onSubmit={connect}>
            <input
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setErr(""); }}
              placeholder="WARUNG-XXXXXX"
              disabled={loading}
              style={{
                width: "100%", padding: "16px 18px", borderRadius: 14, border: "2px solid #E8E8F0",
                fontSize: 20, fontWeight: 800, letterSpacing: "0.08em", textAlign: "center",
                outline: "none", boxSizing: "border-box", fontFamily: "monospace",
              }}
              autoFocus
            />

            {err && (
              <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#FEE2E2", color: "#B91C1C", fontSize: 13 }}>
                {err}
              </div>
            )}

            <button type="submit" disabled={loading || !code.trim()} style={{
              width: "100%", marginTop: 16, padding: 16, borderRadius: 14, border: "none",
              background: loading ? "#9CA3AF" : "#6366F1", color: "#fff", fontWeight: 700, fontSize: 16,
              cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loading ? <><Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} /> Menghubungkan…</> : "Hubungkan & Buka Dashboard →"}
            </button>
          </form>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #F3F4F6", fontSize: 12, color: "#9CA3AF", textAlign: "center" }}>
            Kode aktif 10 menit · Atau{" "}
            <a href="/login" style={{ color: "#6366F1", fontWeight: 600 }}>login manual</a>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
