"use client";
// Onboarding — hanya untuk owner baru. Staf yang diundang langsung masuk bisnis, tidak buat bisnis baru.

import { useState, useEffect } from "react";
import { readStoredSession } from "../../lib/authBootstrap";
import {
  createBusiness,
  claimPendingInvites,
  listMyBusinesses,
  fetchMyPendingInvites,
  pickDefaultBusinessId,
} from "../../lib/repo";
import { findCanonicalInList } from "../../lib/canonicalBusiness.js";

const PRESETS = [
  { name: "NF F&B", type: "fnb", icon: "🍜" },
  { name: "NF Nusa Fishing", type: "ecommerce", icon: "🎣" },
  { name: "Toko / UMKM", type: "umkm", icon: "🏪" },
];

const ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin Keuangan",
  purchasing: "Purchasing",
  kasir: "Kasir",
};

function toSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return base || "bisnis-" + Date.now().toString(36).slice(-4);
}

export default function OnboardingPage() {
  const [name, setName] = useState("NF F&B");
  const [type, setType] = useState("fnb");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [gate, setGate] = useState("checking"); // checking | no-session | invited | owner
  const [pendingInvites, setPendingInvites] = useState([]);
  const [userEmail, setUserEmail] = useState("");
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    (async () => {
      const sess = readStoredSession();
      if (!sess?.user) {
        setGate("no-session");
        return;
      }
      setUserEmail(sess.user.email || "");

      try {
        const claimed = await claimPendingInvites();
        if (claimed?.length) {
          window.location.href = `/dashboard?biz=${claimed[0].business_id}`;
          return;
        }

        const list = await listMyBusinesses();
        if (list.length) {
          const pick = pickDefaultBusinessId(list);
          window.location.href = `/dashboard?biz=${pick}`;
          return;
        }

        const { count, invites } = await fetchMyPendingInvites();
        if (count > 0) {
          setPendingInvites(invites);
          setGate("invited");
          return;
        }

        setGate("owner");
      } catch (e) {
        setErr(e.message || "Gagal memuat");
        setGate("owner");
      }
    })();
  }, []);

  const retryJoin = async () => {
    setRetrying(true);
    setErr("");
    try {
      const claimed = await claimPendingInvites();
      if (claimed?.length) {
        window.location.href = `/dashboard?biz=${claimed[0].business_id}`;
        return;
      }
      const list = await listMyBusinesses();
      if (list.length) {
        window.location.href = `/dashboard?biz=${pickDefaultBusinessId(list)}`;
        return;
      }
      setErr("Belum bisa bergabung. Pastikan email login sama persis dengan email undangan.");
    } catch (e) {
      setErr(e.message || "Gagal bergabung");
    } finally {
      setRetrying(false);
    }
  };

  const pickPreset = (p) => {
    setName(p.name);
    setType(p.type);
    setErr("");
  };

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    setErr("");

    try {
      const existing = await listMyBusinesses();
      const canonical = findCanonicalInList(existing);
      const hasFnb = existing.some((b) => b.type === "fnb");
      if (type === "fnb" && (canonical || hasFnb)) {
        const pick = canonical?.id || existing.find((b) => b.type === "fnb")?.id;
        setErr(
          "Bisnis F&B sudah ada (Nusa Food). Jangan buat F&B baru — data akan terpisah dan bisa hilang saat sync."
        );
        if (pick) {
          setTimeout(() => {
            window.location.href = `/dashboard?biz=${pick}`;
          }, 2500);
        }
        return;
      }
    } catch (e) {
      setErr(e.message || "Gagal cek bisnis existing");
      return;
    } finally {
      setLoading(false);
    }

    setLoading(true);
    setErr("");

    let slug = toSlug(trimmed);
    try {
      let biz;
      try {
        biz = await createBusiness(slug, trimmed, type);
      } catch (e1) {
        if (String(e1.message).includes("unique") || String(e1.message).includes("duplicate")) {
          slug = toSlug(trimmed) + "-" + Math.random().toString(36).slice(2, 6);
          biz = await createBusiness(slug, trimmed, type);
        } else {
          throw e1;
        }
      }
      window.location.href = `/dashboard?biz=${biz.id}`;
    } catch (e) {
      setErr(e.message || "Gagal membuat bisnis");
      setLoading(false);
    }
  };

  if (gate === "checking") {
    return (
      <Shell subtitle="Memuat…">
        <div style={{ textAlign: "center", color: "#6B7280", fontSize: 14 }}>Memuat…</div>
      </Shell>
    );
  }

  if (gate === "no-session") {
    return (
      <Shell subtitle="Setup bisnis kamu">
        <div style={{ textAlign: "center" }}>
          <p style={{ marginBottom: 16, color: "#6B7280" }}>Login dulu sebelum buat bisnis.</p>
          <button onClick={() => { window.location.href = "/login"; }} style={btnPrimary}>Login / Daftar</button>
        </div>
      </Shell>
    );
  }

  if (gate === "invited") {
    return (
      <Shell subtitle="Undangan staf">
        <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", marginBottom: 12 }}>
          Anda sudah diundang
        </div>
        <div style={{
          padding: "12px 14px", borderRadius: 12, background: "#FFFBEB",
          border: "1px solid #FDE68A", color: "#92400E", fontSize: 13, marginBottom: 16, lineHeight: 1.5,
        }}>
          Anda <strong>tidak perlu</strong> membuat bisnis baru. Owner sudah mengundang Anda ke bisnis mereka — cukup gabung dengan akun ini.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {pendingInvites.map((inv, i) => (
            <div key={i} style={{
              padding: "12px 14px", borderRadius: 12, border: "1px solid #E8E8F0", background: "#F9F9FC",
            }}>
              <div style={{ fontWeight: 700, color: "#1A1A2E" }}>{inv.businessName || "Bisnis"}</div>
              <div style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>
                Peran: {ROLE_LABEL[inv.role] || inv.role}
                {inv.outlet ? ` · Outlet ${inv.outlet}` : ""}
              </div>
            </div>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 16 }}>
          Email login: <strong>{userEmail}</strong>
          <br />
          Harus sama dengan email yang diundang owner.
        </div>

        {err && (
          <div style={{ marginBottom: 12, padding: "10px 14px", borderRadius: 10, background: "#FEE2E2", color: "#B91C1C", fontSize: 13 }}>
            {err}
          </div>
        )}

        <button onClick={retryJoin} disabled={retrying} style={{ ...btnPrimary, width: "100%", opacity: retrying ? 0.6 : 1 }}>
          {retrying ? "Bergabung…" : "Gabung ke Bisnis →"}
        </button>
      </Shell>
    );
  }

  return (
    <Shell subtitle="Setup bisnis kamu">
      <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1A2E", marginBottom: 16 }}>
        Setup bisnis (1 langkah)
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
        Pilih preset
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => pickPreset(p)} disabled={loading}
            style={{
              padding: "12px 14px", borderRadius: 12, cursor: "pointer", textAlign: "left",
              display: "flex", alignItems: "center", gap: 10,
              border: `1.5px solid ${name === p.name ? "#6366F1" : "#E8E8F0"}`,
              background: name === p.name ? "#EEF2FF" : "#fff",
              opacity: loading ? 0.6 : 1,
            }}>
            <span style={{ fontSize: 22 }}>{p.icon}</span>
            <span style={{ fontWeight: 700, color: name === p.name ? "#4338CA" : "#1A1A2E" }}>{p.name}</span>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
        Atau nama custom
      </div>
      <input
        value={name}
        onChange={(e) => { setName(e.target.value); setErr(""); }}
        placeholder="Nama bisnis"
        disabled={loading}
        style={inp}
      />

      {err && (
        <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: "#FEE2E2", color: "#B91C1C", fontSize: 13 }}>
          {err}
        </div>
      )}

      <button onClick={create} disabled={loading || !name.trim()} style={{ ...btnPrimary, width: "100%", marginTop: 16, opacity: loading || !name.trim() ? 0.6 : 1 }}>
        {loading ? "Membuat bisnis…" : "Buat Bisnis & Masuk →"}
      </button>

      {loading && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#6B7280", textAlign: "center" }}>
          Menyimpan ke Supabase… jangan tutup tab.
        </div>
      )}
    </Shell>
  );
}

function Shell({ subtitle, children }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F0F0F8", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#4F46E5" }}>NF3</div>
          <div style={{ fontSize: 14, color: "#6B7280", marginTop: 4 }}>{subtitle || "Setup bisnis kamu"}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: 24, border: "1px solid #E8E8F0" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

const inp = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  border: "1px solid #E8E8F0", background: "#F9F9FC",
  fontSize: 14, color: "#1A1A2E", outline: "none", boxSizing: "border-box",
};
const btnPrimary = {
  padding: "14px 20px", borderRadius: 12, border: "none",
  background: "#6366F1", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
};
