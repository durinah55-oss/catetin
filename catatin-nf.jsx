import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Home, BarChart3, Sparkles, User, Mic, Settings, Bell, Inbox, Cloud, Eye, EyeOff, Plus, Wallet, ChevronRight, ChevronLeft, Pencil, Trash2, ShoppingCart, Users, Zap, Store, PiggyBank, MoreHorizontal, Check, X, ArrowLeft, ScanLine, Keyboard, Fingerprint, Star, ShieldCheck, Monitor, RefreshCw, Sun, Moon, Smartphone, Copy, AlertTriangle, ClipboardList, TrendingUp, TrendingDown, Loader2, Banknote, Filter, Share2 } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

/* ============================================================
   NF3 — self-hosted, tampilan mengikuti asli (violet theme)
   ============================================================ */

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#F0F0F8;--surface:#FFFFFF;--surface2:#F0F0F8;--line:#E8E8F0;
  --brand:#6366F1;--brand-dark:#4F46E5;--brand-soft:#EEF2FF;--brand-text:#4338CA;
  --ink:#1A1A2E;--ink2:#6B7280;--ink3:#9CA3AF;
  --in:#22C55E;--in-soft:#DCFCE7;--in-text:#15803D;
  --out:#EF4444;--out-soft:#FEE2E2;--out-text:#B91C1C;
  --amber:#F59E0B;--amber-soft:#FEF3C7;
}
[data-theme=dark]{
  --bg:#0F0F1A;--surface:#1A1A2E;--surface2:#252540;--line:#2D2D50;
  --brand:#818CF8;--brand-dark:#6366F1;--brand-soft:#1E1B4B;--brand-text:#A5B4FC;
  --ink:#F1F5F9;--ink2:#94A3B8;--ink3:#64748B;
  --in:#4ADE80;--in-soft:#14532D;--in-text:#86EFAC;
  --out:#F87171;--out-soft:#7F1D1D;--out-text:#FCA5A5;
  --amber:#FCD34D;--amber-soft:#78350F;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);}
.scroll-hide::-webkit-scrollbar{display:none}
.scroll-hide{-ms-overflow-style:none;scrollbar-width:none}
.money{font-variant-numeric:tabular-nums;letter-spacing:-0.02em;}
@keyframes pulse-ring{0%{transform:scale(1);opacity:.6}70%{transform:scale(2.2);opacity:0}100%{opacity:0}}
.pulse-ring{animation:pulse-ring 1.4s cubic-bezier(.4,0,.6,1) infinite}
`;

const fmtMoney = (n, cur = "IDR", sign = false) => {
  const syms = { IDR: "Rp", USD: "$", MYR: "RM" };
  const locales = { IDR: "id-ID", USD: "en-US", MYR: "ms-MY" };
  const abs = Math.abs(Math.round(n));
  const s = new Intl.NumberFormat(locales[cur] || "id-ID").format(abs);
  const pre = n < 0 ? "−" : sign ? "+" : "";
  return `${syms[cur] || "Rp"} ${pre}${s}`;
};
const today = () => new Date().toISOString().slice(0, 10);
const dayLabel = (d) => new Date(d).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (d) => new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
const isoOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// ─── Storage ───────────────────────────────────────────────
const KEY = "nf3:v1";

// helper saldo dompet
const walletBalance = (walletId, wallets, transactions) => {
  const w = wallets.find(x => x.id === walletId);
  if (!w) return 0;
  const txs = transactions.filter(t => {
    if (t.type === "transfer") return t.fromWalletId === walletId || t.toWalletId === walletId;
    return t.walletId === walletId;
  });
  return (w.opening || 0) + txs.reduce((a, t) => {
    if (t.type === "transfer") return a + (t.toWalletId === walletId ? t.amount : -t.amount);
    return a + (t.type === "in" ? t.amount : -t.amount);
  }, 0);
};

const defaultState = () => ({
  // user aktif (demo: owner)
  currentUser: { id: "u1", name: "Sam", role: "owner", outlet: null },
  // semua user yang bisa login
  users: [
    { id: "u1", name: "Sam", role: "owner", outlet: null },
    { id: "u2", name: "Admin NF", role: "admin", outlet: null },
    { id: "u3", name: "Kasir KBU", role: "kasir", outlet: "KBU" },
    { id: "u4", name: "Kasir KSM", role: "kasir", outlet: "KSM" },
    { id: "u5", name: "Kasir SMT", role: "kasir", outlet: "SMT" },
    { id: "u6", name: "Purchasing", role: "purchasing", outlet: null },
  ],
  profile: { name: "Nf3", type: "Usaha", currency: "IDR", theme: "light", email: "sampriatna@gmail.com", pin: "aktif", biometric: true },
  automation: { autoImport: true, replyNotif: true },
  wallets: [
    // Kas Laci per outlet — floor 250rb
    { id: "w_laci_kbu", name: "Laci KBU", type: "kas_fisik", outlet: "KBU", color: "#6366F1", opening: 0, floor: 250000, active: true },
    { id: "w_laci_ksm", name: "Laci Kisamen", type: "kas_fisik", outlet: "KSM", color: "#16A34A", opening: 0, floor: 250000, active: true },
    { id: "w_laci_smt", name: "Laci Samtaro", type: "kas_fisik", outlet: "SMT", color: "#D97706", opening: 0, floor: 250000, active: true },
    // Kas internal
    { id: "w_kas_besar", name: "Kas Besar", type: "kas_fisik", outlet: null, color: "#0EA5E9", opening: 0, floor: 0, active: true },
    { id: "w_kas_kecil", name: "Kas Kecil Purchasing", type: "kas_fisik", outlet: null, color: "#8B5CF6", opening: 0, floor: 0, active: true },
    { id: "w_ops_kar", name: "Operasional Karyawan", type: "kas_fisik", outlet: null, color: "#EC4899", opening: 0, floor: 0, active: true },
    // Dompet owner
    { id: "w_pm", name: "Dompet PM", type: "digital", outlet: null, color: "#14B8A6", opening: 0, floor: 0, active: true },
    { id: "w_nf", name: "Dompet NF", type: "digital", outlet: null, color: "#F97316", opening: 0, floor: 0, active: true },
    // Rekening bank (owner only)
    { id: "w_bca", name: "BCA", type: "rekening", outlet: null, color: "#1D4ED8", opening: 0, floor: 0, active: true, ownerOnly: true },
    { id: "w_bri", name: "BRI", type: "rekening", outlet: null, color: "#DC2626", opening: 0, floor: 0, active: true, ownerOnly: true },
    { id: "w_mandiri", name: "Mandiri", type: "rekening", outlet: null, color: "#CA8A04", opening: 0, floor: 0, active: true, ownerOnly: true },
    { id: "w_bni", name: "BNI", type: "rekening", outlet: null, color: "#1E40AF", opening: 0, floor: 0, active: true, ownerOnly: true },
    { id: "w_owner", name: "Owner", type: "rekening", outlet: null, color: "#7C3AED", opening: 0, floor: 0, active: true, ownerOnly: true },
  ],
  categories: [
    { id: "ci1", name: "Penjualan Makanan", type: "in", active: true },
    { id: "ci2", name: "Penjualan Minuman", type: "in", active: true },
    { id: "ci3", name: "Takeaway / Grab", type: "in", active: true },
    { id: "ci4", name: "Modal Masuk", type: "in", active: true },
    { id: "ci5", name: "Lain-lain", type: "in", active: true },
    { id: "co1", name: "Bahan Baku", type: "out", active: true },
    { id: "co2", name: "Gaji & Upah", type: "out", active: true },
    { id: "co3", name: "Listrik & Air", type: "out", active: true },
    { id: "co4", name: "Gas LPG", type: "out", active: true },
    { id: "co5", name: "Kemasan & Alat", type: "out", active: true },
    { id: "co6", name: "Sewa Tempat", type: "out", active: true },
    { id: "co7", name: "Operasional", type: "out", active: true },
    { id: "co8", name: "Lain-lain", type: "out", active: true },
  ],
  transactions: [],
  hiddenInsights: [],
  pairCode: "WARUNG-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  rawInbox: [
    { id: "n1", src: "ShopeePay", title: "Siap-Siap Raih Koin Setiap Jam!", body: "joranmeledak, kumpulkan Rp 160.000" },
    { id: "n2", src: "ShopeePay", title: "Kamu Tercatat Bisa Dapat Bonus s.d. joranmeledak", body: "Rp 600.000" },
    { id: "n3", src: "ShopeePay", title: "Canva Pro Gratis Roti'O joranmeledak bisa dapatkan", body: "Rp 1" },
    { id: "n4", src: "ShopeePay", title: "Saldo Penjual diperbarui Pesanan 260610NVKPB36W telah selesai", body: "Rp 41.562" },
  ],
});

// ─── RBAC helpers ──────────────────────────────────────────
const ROLES = { owner: 4, admin: 3, kasir: 2, purchasing: 1 };
const canDo = (role, action) => {
  const lvl = ROLES[role] || 0;
  const perms = {
    transfer: lvl >= 3,       // admin + owner
    kelolaDompet: lvl >= 3,
    kelolaKategori: lvl >= 3,
    lihatRekening: lvl >= 4,  // owner only
    inputIncome: lvl >= 2,    // kasir+
    inputExpense: lvl >= 1,   // semua
  };
  return perms[action] ?? false;
};

// Dompet yang boleh dilihat/dipakai oleh user
const visibleWallets = (wallets, user) => {
  return wallets.filter(w => {
    if (!w.active) return false;
    if (w.ownerOnly && user.role !== "owner") return false;
    if (user.role === "kasir") return w.outlet === user.outlet;
    if (user.role === "purchasing") return w.id === "w_kas_kecil";
    return true; // admin + owner lihat semua (kecuali ownerOnly sudah dihandle)
  });
};

// Validasi floor sebelum simpan transaksi keluar
const checkFloor = (walletId, amount, wallets, transactions) => {
  const w = wallets.find(x => x.id === walletId);
  if (!w || !w.floor) return null;
  const bal = walletBalance(walletId, wallets, transactions);
  if (bal - amount < w.floor) {
    return `Saldo tidak cukup. Minimum saldo: ${new Intl.NumberFormat("id-ID").format(w.floor)} · Saldo saat ini: ${new Intl.NumberFormat("id-ID").format(bal)}`;
  }
  return null;
};

async function loadState() {
  try {
    const r = await window.storage.get(KEY);
    if (r?.value) {
      const saved = JSON.parse(r.value);
      const base = defaultState();
      // merge dalam, pastikan field baru ada di data lama
      return {
        ...base, ...saved,
        profile: { ...base.profile, ...saved.profile },
        automation: { ...base.automation, ...saved.automation },
        currentUser: saved.currentUser || base.currentUser,
      };
    }
  } catch (_) {}
  return defaultState();
}
async function saveState(s) { try { await window.storage.set(KEY, JSON.stringify(s)); } catch (_) {} }

// ─── Classifier ────────────────────────────────────────────
const SPAM = ["raih koin","kumpulkan","bonus s.d","gratis","voucher","diskon","promo","flash sale","klaim","hadiah","s.d.","kupon","berhadiah"];
const REAL = ["saldo penjual diperbarui","pesanan","telah selesai","pembayaran berhasil","transfer berhasil","dana masuk","pencairan","withdraw","topup berhasil","settlement","diterima dari"];
function classifyNotif(n) {
  const t = (n.title + " " + n.body).toLowerCase();
  const amt = Math.max(0, ...[...t.matchAll(/rp\s*([0-9][0-9.,]*)/gi)].map(m => parseInt(m[1].replace(/[.,]/g, ""), 10)).filter(Boolean));
  let score = 0;
  SPAM.forEach(h => { if (t.includes(h)) score -= 2; });
  REAL.forEach(h => { if (t.includes(h)) score += 3; });
  if (/pesanan\s+[a-z0-9]{8,}/i.test(t)) score += 2;
  if (amt > 0 && amt < 5) score -= 3;
  return { amount: amt, score, verdict: score >= 3 ? "legit" : "promo" };
}

// ─── AI helpers ────────────────────────────────────────────
async function aiParseText(text, cats) {
  const cl = cats.map(c => `${c.name}(${c.type === "in" ? "pemasukan" : "pengeluaran"})`).join(", ");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: `Kamu mesin pencatat keuangan UMKM. Ubah kalimat jadi transaksi. Kategori: ${cl}. Aturan: ribu/rb=x1000,juta/sejuta=x1000000,setengah juta=500000. Jual/laku/terima=pemasukan,beli/bayar/kulakan/gaji=pengeluaran. Balas HANYA JSON: {"type":"in"|"out","category":"<nama persis>","amount":<bulat>,"desc":"<ringkas>"}. Kalimat: "${text}"` }] }) });
  const d = await res.json();
  const raw = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("").replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}
async function aiParseReceipt(b64, mime, cats) {
  const cl = cats.map(c => c.name).join(", ");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: mime, data: b64 } }, { type: "text", text: `Baca nota ini. Kategori: ${cl}. Balas HANYA JSON: {"type":"out","category":"<cocok>","amount":<total>,"desc":"<merchant>","date":"YYYY-MM-DD atau kosong"}` }] }] }) });
  const d = await res.json();
  const raw = (d.content || []).filter(b => b.type === "text").map(b => b.text).join("").replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

// ─── Primitives ────────────────────────────────────────────
const Card = ({ children, style, className = "", onClick }) => (
  <div onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, ...style }} className={className}>{children}</div>
);
const Pill = ({ children, active, onClick, color }) => (
  <button onClick={onClick} style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: active ? "none" : "1px solid var(--line)", background: active ? "var(--brand)" : "var(--surface)", color: active ? "#fff" : "var(--ink2)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer" }}>
    {color && <span style={{ width: 8, height: 8, borderRadius: 99, background: color, display: "inline-block" }} />}{children}
  </button>
);
const Tog = ({ on, onToggle }) => (
  <button onClick={onToggle} style={{ width: 48, height: 28, borderRadius: 999, background: on ? "var(--brand)" : "var(--line)", padding: 3, display: "flex", alignItems: "center", justifyContent: on ? "flex-end" : "flex-start", border: "none", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
    <span style={{ width: 22, height: 22, borderRadius: 999, background: "#fff", display: "block" }} />
  </button>
);
const Lbl = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand)", marginBottom: 10 }}>{children}</div>;

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 20, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", background: "var(--surface)", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 99, background: "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink)" }}><ArrowLeft size={18} /></button>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{title}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }} className="scroll-hide">{children}</div>
    </div>
  );
}

const catIconMap = { "Bahan Baku": ShoppingCart, "Gaji & Upah": Users, "Operasional": Zap, "Penjualan": Store, "Modal Masuk": PiggyBank, "Listrik & Internet": Zap };
const getCatIcon = (cat) => catIconMap[cat?.name] || MoreHorizontal;

// ─── Beranda ───────────────────────────────────────────────
function Beranda({ s, setTab, setOverlay, hide, setHide }) {
  const cur = s.profile.currency;
  const prefix = today().slice(0, 7);
  const myWallets = visibleWallets(s.wallets, s.currentUser || { role: "owner" });
  const monthIn = s.transactions.filter(t => t.type === "in" && t.date.startsWith(prefix)).reduce((a, b) => a + b.amount, 0);
  const monthOut = s.transactions.filter(t => t.type === "out" && t.date.startsWith(prefix)).reduce((a, b) => a + b.amount, 0);
  const totalSaldo = myWallets.reduce((a, w) => a + walletBalance(w.id, s.wallets, s.transactions), 0);
  const inboxCount = (s.rawInbox || []).length;

  return (
    <div style={{ padding: "0 0 90px" }}>
      {/* header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>{s.profile.name}</div>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>{dayLabel(today())}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconBtn title="Cloud sync"><Cloud size={20} /></IconBtn>
          <IconBtn title="Inbox" onClick={() => setOverlay("inbox")} badge={inboxCount}><Inbox size={20} /></IconBtn>
          <IconBtn title="Notifikasi" onClick={() => setOverlay("notif")}><Bell size={20} /></IconBtn>
          <IconBtn title="Pengaturan" onClick={() => setOverlay("settings")}><Settings size={20} /></IconBtn>
        </div>
      </div>

      {/* saldo card */}
      <div style={{ margin: "0 16px 20px" }}>
        <div style={{ background: "linear-gradient(135deg,#5B5BD6,#7C7CF8)", borderRadius: 24, padding: "24px 24px 20px", position: "relative", overflow: "hidden", color: "#fff" }}>
          <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.08)", top: -60, right: -40 }} />
          <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.05)", bottom: -30, right: 60 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", opacity: .8 }}>TOTAL SALDO</span>
            <button onClick={() => setHide(v => !v)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.85)", cursor: "pointer" }}>{hide ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>
          <div className="money" style={{ fontSize: 38, fontWeight: 800, marginTop: 8, position: "relative" }}>{hide ? "••••••••" : fmtMoney(totalSaldo, cur)}</div>
          <div style={{ fontSize: 13, opacity: .7, marginTop: 4, position: "relative" }}>Seluruh dompet · {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</div>
          <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "16px 0", position: "relative" }} />
          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
            <div><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: .8 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "#4ADE80", display: "inline-block" }} />Pemasukan</div><div className="money" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{hide ? "••••" : `+${fmtMoney(monthIn, cur).replace(/^[^ ]+ /, "+Rp ")}`}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: .8, justifyContent: "flex-end" }}>Pengeluaran<span style={{ width: 8, height: 8, borderRadius: 99, background: "#F87171", display: "inline-block" }} /></div><div className="money" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "#FCA5A5" }}>{hide ? "••••" : `-${fmtMoney(monthOut, cur).replace(/^[^ ]+ /, "Rp ")}`}</div></div>
          </div>
        </div>
      </div>

      {/* dompet */}
      <div style={{ padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Dompet saya</span>
        <button onClick={() => setOverlay("wallets")} style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", background: "none", border: "none", cursor: "pointer" }}>Lihat semua</button>
      </div>
      <div style={{ paddingLeft: 16, display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4, paddingRight: 16 }} className="scroll-hide">
        {myWallets.map(w => {
          const bal = walletBalance(w.id, s.wallets, s.transactions);
          const nearFloor = w.floor > 0 && bal <= w.floor * 1.2;
          return (
            <Card key={w.id} style={{ minWidth: 150, padding: 16, position: "relative", overflow: "hidden", flexShrink: 0 }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: w.color }} />
              <div style={{ width: 40, height: 40, borderRadius: 12, background: w.color + "22", display: "grid", placeItems: "center", color: w.color, marginBottom: 12 }}><Wallet size={18} /></div>
              <div style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 4 }}>
                {w.name}
                {w.outlet && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)", fontWeight: 700 }}>{w.outlet}</span>}
              </div>
              <div className="money" style={{ fontSize: 17, fontWeight: 700, color: nearFloor ? "var(--out-text)" : "var(--ink)", marginTop: 2 }}>{hide ? "•••" : fmtMoney(bal, cur)}</div>
              {nearFloor && <div style={{ fontSize: 10, color: "var(--out-text)", fontWeight: 700, marginTop: 3 }}>⚠ Mendekati minimum</div>}
            </Card>
          );
        })}
        {canDo(s.currentUser?.role, "kelolaDompet") && (
          <button onClick={() => setOverlay("wallets")} style={{ minWidth: 100, borderRadius: 16, border: "2px dashed var(--line)", background: "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, color: "var(--brand)", cursor: "pointer", flexShrink: 0, padding: 16 }}>
            <Plus size={22} /><span style={{ fontSize: 12, fontWeight: 600 }}>Kelola</span>
          </button>
        )}
      </div>

      {/* shortcut */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: "20px 16px 0" }}>
        <button onClick={() => setTab("laporan")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--line)", cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)" }}><BarChart3 size={18} /></div>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>Laporan</span>
        </button>
        <button onClick={() => setTab("analisis")} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 16, background: "var(--surface)", border: "1px solid var(--line)", cursor: "pointer" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "var(--amber-soft)", display: "grid", placeItems: "center", color: "var(--amber)" }}><Sparkles size={18} /></div>
          <span style={{ fontWeight: 700, color: "var(--ink)" }}>Analisis Usaha</span>
        </button>
      </div>

      {/* transaksi terbaru */}
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Transaksi Terbaru</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)" }}>Lihat Semua</span>
      </div>
      {(() => {
        const recent = [...s.transactions].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 10);
        if (recent.length === 0) return (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--surface2)", display: "grid", placeItems: "center", margin: "0 auto 16px", color: "var(--ink3)" }}><ClipboardList size={30} /></div>
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16 }}>Belum ada transaksi</div>
            <div style={{ color: "var(--ink3)", fontSize: 13, marginTop: 4 }}>Mulai catat transaksi pertama Anda</div>
          </div>
        );
        return (
          <Card style={{ margin: "12px 16px 0", overflow: "hidden" }}>
            {recent.map((t, i) => {
              const isTrf = t.type === "transfer";
              const cat = s.categories.find(c => c.id === t.categoryId);
              const w = s.wallets.find(x => x.id === (isTrf ? t.fromWalletId : t.walletId));
              const Ic = isTrf ? RefreshCw : getCatIcon(cat);
              const col = isTrf ? "var(--brand)" : t.type === "in" ? "var(--in-text)" : "var(--out-text)";
              const bg = isTrf ? "var(--brand-soft)" : t.type === "in" ? "var(--in-soft)" : "var(--out-soft)";
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: bg, display: "grid", placeItems: "center", color: col, flexShrink: 0 }}><Ic size={16} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isTrf ? `${s.wallets.find(x => x.id === t.fromWalletId)?.name} → ${s.wallets.find(x => x.id === t.toWalletId)?.name}` : (t.desc || cat?.name)}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{isTrf ? "Transfer" : cat?.name} · {w?.name} · {shortDate(t.date)}</div>
                  </div>
                  <div className="money" style={{ fontSize: 14, fontWeight: 700, color: col, flexShrink: 0 }}>
                    {hide ? "•••" : (isTrf ? "⇄ " : (t.type === "in" ? "+" : "−")) + fmtMoney(t.amount, cur).replace(/^[^ ]+ /, "")}
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })()}
    </div>
  );
}

function IconBtn({ children, onClick, badge, title }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 38, height: 38, borderRadius: 99, background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink2)", position: "relative" }}>
      {children}
      {badge > 0 && <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 99, background: "var(--out)", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 3px" }}>{badge}</span>}
    </button>
  );
}

// ─── Laporan ───────────────────────────────────────────────
function Laporan({ s }) {
  const cur = s.profile.currency;
  const [range, setRange] = useState("Harian");
  const [walletId, setWalletId] = useState("all");
  const [catIn, setCatIn] = useState("all");
  const [catOut, setCatOut] = useState("all");

  const days = range === "Mingguan" ? 7 : range === "Bulanan" ? 30 : 1;
  const startDate = isoOffset(-(days - 1));

  const tx = s.transactions.filter(t => {
    if (t.type === "transfer") return false;           // transfer bukan P&L
    if (t.date < startDate) return false;
    if (walletId !== "all" && t.walletId !== walletId) return false;
    if (t.type === "in" && catIn !== "all" && t.categoryId !== catIn) return false;
    if (t.type === "out" && catOut !== "all" && t.categoryId !== catOut) return false;
    return true;
  });
  const inSum = tx.filter(t => t.type === "in").reduce((a, b) => a + b.amount, 0);
  const outSum = tx.filter(t => t.type === "out").reduce((a, b) => a + b.amount, 0);

  const chart = useMemo(() => {
    const pts = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = isoOffset(-i);
      const day = tx.filter(t => t.date === d);
      pts.push({ day: shortDate(d), in: day.filter(t => t.type === "in").reduce((a, b) => a + b.amount, 0), out: day.filter(t => t.type === "out").reduce((a, b) => a + b.amount, 0) });
    }
    return pts;
  }, [tx, days]);

  const inCats = s.categories.filter(c => c.type === "in");
  const outCats = s.categories.filter(c => c.type === "out");

  return (
    <div style={{ padding: "0 0 90px" }}>
      {/* header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Laporan Keuangan</span>
        <Share2 size={20} color="var(--ink2)" />
      </div>

      {/* export banner */}
      <div style={{ margin: "0 16px 16px" }}>
        <Card style={{ padding: "12px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 10 }}>
          <Monitor size={20} color="#16A34A" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>Export PDF & Excel lengkap via PC</div>
            <div style={{ fontSize: 12, color: "#4B5563" }}>Hubungkan HP ke Web Dashboard NF3</div>
          </div>
          <ChevronRight size={16} color="var(--ink3)" />
        </Card>
      </div>

      {/* range tabs */}
      <div style={{ margin: "0 16px 12px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, background: "var(--surface2)", borderRadius: 12, padding: 4 }}>
        {["Harian", "Mingguan", "Bulanan", "Custom"].map(r => (
          <button key={r} onClick={() => setRange(r)} style={{ padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: range === r ? "var(--brand)" : "transparent", color: range === r ? "#fff" : "var(--ink2)" }}>{r}</button>
        ))}
      </div>

      {/* date nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, padding: "8px 20px", fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
        <ChevronLeft size={20} color="var(--ink3)" />
        <span>Hari ini — {new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" })}</span>
        <ChevronRight size={20} color="var(--ink3)" />
      </div>

      {/* filters */}
      <div style={{ padding: "6px 16px", display: "flex", gap: 8, overflowX: "auto" }} className="scroll-hide">
        <Pill active={walletId === "all"} onClick={() => setWalletId("all")}>Semua</Pill>
        {s.wallets.map(w => <Pill key={w.id} active={walletId === w.id} onClick={() => setWalletId(w.id)} color={w.color}>{w.name}</Pill>)}
      </div>
      <div style={{ padding: "6px 16px", display: "flex", gap: 8, overflowX: "auto" }} className="scroll-hide">
        <Pill active={catIn === "all"} onClick={() => setCatIn("all")}>Semua</Pill>
        {inCats.map(c => <Pill key={c.id} active={catIn === c.id} onClick={() => setCatIn(c.id)}>{c.name}</Pill>)}
      </div>
      <div style={{ padding: "6px 16px 12px", display: "flex", gap: 8, overflowX: "auto" }} className="scroll-hide">
        <Pill active={catOut === "all"} onClick={() => setCatOut("all")}>Semua</Pill>
        {outCats.map(c => <Pill key={c.id} active={catOut === c.id} onClick={() => setCatOut(c.id)}>{c.name}</Pill>)}
      </div>

      {/* chart */}
      <div style={{ padding: "0 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", marginBottom: 8 }}>Tren Alur Kas (Pemasukan vs Pengeluaran)</div>
        <Card style={{ padding: "12px 8px 4px" }}>
          <div style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity={.35} /><stop offset="100%" stopColor="#22C55E" stopOpacity={0} /></linearGradient>
                  <linearGradient id="go" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity={.3} /><stop offset="100%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--ink3)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--ink3)" }} axisLine={false} tickLine={false} width={38} tickFormatter={v => v >= 1000 ? v / 1000 + "k" : v} />
                <Tooltip formatter={(v, n) => [fmtMoney(v, cur), n === "in" ? "Masuk" : "Keluar"]} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12, background: "var(--surface)" }} />
                <Area type="monotone" dataKey="in" stroke="#22C55E" strokeWidth={2} fill="url(#gi)" />
                <Area type="monotone" dataKey="out" stroke="#EF4444" strokeWidth={2} fill="url(#go)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* summary */}
      <div style={{ margin: "12px 16px 0" }}>
        <Card style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={13} color="var(--in)" /> Pemasukan</div>
              <div className="money" style={{ fontSize: 20, fontWeight: 800, color: "var(--in-text)", marginTop: 4 }}>{fmtMoney(inSum, cur)}</div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 4 }}><TrendingDown size={13} color="var(--out)" /> Pengeluaran</div>
              <div className="money" style={{ fontSize: 20, fontWeight: 800, color: "var(--out-text)", marginTop: 4 }}>{fmtMoney(outSum, cur)}</div>
            </div>
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", background: "var(--surface2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>Laba Bersih</span>
            <span className="money" style={{ fontSize: 20, fontWeight: 800, color: inSum - outSum >= 0 ? "var(--in-text)" : "var(--out-text)" }}>
              {inSum - outSum >= 0 ? "▲ " : "▼ "}{fmtMoney(Math.abs(inSum - outSum), cur)}
            </span>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Analisis ──────────────────────────────────────────────
function Analisis({ s, hideInsight }) {
  const cur = s.profile.currency;
  const insights = useMemo(() => {
    const tx = s.transactions.filter(t => t.type !== "transfer"); // transfer bukan P&L
    const list = [];
    const last3 = [today(), isoOffset(-1), isoOffset(-2)];
    if (tx.filter(t => t.type === "in" && last3.includes(t.date)).length === 0)
      list.push({ id: "no_inc", tone: "warn", title: "Perhatian", body: "📋 Belum ada pencatatan pemasukan 3 hari ini. Jangan sampai ada transaksi yang terlewat ya!" });
    const wNow = tx.filter(t => t.type === "out" && t.date >= isoOffset(-6)).reduce((a, b) => a + b.amount, 0);
    const wPrev = tx.filter(t => t.type === "out" && t.date >= isoOffset(-13) && t.date < isoOffset(-6)).reduce((a, b) => a + b.amount, 0);
    if (wPrev > 0 && wNow > wPrev * 1.25)
      list.push({ id: "spike", tone: "warn", title: "Pengeluaran naik", body: `🔺 Pengeluaran minggu ini naik ${Math.round((wNow / wPrev - 1) * 100)}% dibanding minggu lalu.` });
    const m = today().slice(0, 7);
    const mIn = tx.filter(t => t.type === "in" && t.date.startsWith(m)).reduce((a, b) => a + b.amount, 0);
    const mOut = tx.filter(t => t.type === "out" && t.date.startsWith(m)).reduce((a, b) => a + b.amount, 0);
    if (mIn > 0 && mOut > mIn) list.push({ id: "neg", tone: "danger", title: "Arus kas negatif", body: `⚠️ Pengeluaran bulan ini melebihi pemasukan ${fmtMoney(mOut - mIn, cur)}.` });
    if (list.length === 0) list.push({ id: "ok", tone: "ok", title: "Semua aman", body: "✅ Pencatatan rutin dan arus kas sehat. Pertahankan!" });
    return list.filter(x => !s.hiddenInsights.includes(x.id));
  }, [s]);

  return (
    <div style={{ padding: "0 0 90px" }}>
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Analisis Usaha</div>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>Pantau kesehatan keuanganmu</div>
      </div>

      <div style={{ margin: "12px 16px 16px", background: "linear-gradient(135deg,#5B5BD6,#7C7CF8)", borderRadius: 20, padding: "18px 20px", display: "flex", alignItems: "center", gap: 16, color: "#fff" }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "rgba(255,255,255,.18)", display: "grid", placeItems: "center", flexShrink: 0 }}><Sparkles size={24} /></div>
        <div><div style={{ fontWeight: 700, fontSize: 17 }}>Analisis Usaha Kamu</div><div style={{ fontSize: 13, opacity: .8, marginTop: 2 }}>Insight personal berdasarkan pola keuangan usahamu.</div></div>
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 10 }}>{insights.length} dari {insights.length} insight</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {insights.map(it => {
            const colors = it.tone === "danger" ? { bg: "#FEF9C3", border: "#FDE047", ic: "#CA8A04" } : it.tone === "ok" ? { bg: "#F0FDF4", border: "#BBF7D0", ic: "#16A34A" } : { bg: "#FFF7ED", border: "#FED7AA", ic: "#D97706" };
            return (
              <div key={it.id} style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <div style={{ width: 38, height: 38, borderRadius: 99, background: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}><AlertTriangle size={18} color={colors.ic} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: colors.ic }}>{it.title}</div>
                  <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 4, lineHeight: 1.5 }}>{it.body}</div>
                </div>
                <button onClick={() => hideInsight(it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)" }}><X size={16} /></button>
              </div>
            );
          })}
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink3)", marginTop: 32 }}>Powered by NF3</div>
      </div>
    </div>
  );
}

// ─── Catat Transaksi ───────────────────────────────────────
function CatatTransaksi({ s, onSave, onClose }) {
  const [mode, setMode] = useState("voice");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);

  const runText = async (text) => { setErr(""); setBusy(true); try { const r = await aiParseText(text, s.categories); const cat = s.categories.find(c => c.name.toLowerCase() === (r.category || "").toLowerCase() && c.type === r.type) || s.categories.find(c => c.type === r.type); setDraft({ type: r.type, categoryId: cat?.id, amount: r.amount, desc: r.desc, walletId: s.wallets[0].id, date: today(), source: text }); } catch { setErr("Gagal memahami. Coba lagi."); } setBusy(false); };
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr("Browser ini belum support voice. Ketik manual."); return; }
    const rec = new SR(); recRef.current = rec; rec.lang = "id-ID"; rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onerror = () => { setListening(false); setErr("Suara tidak terdengar. Coba ketik."); };
    rec.onend = () => setListening(false);
    rec.onresult = (e) => { setListening(false); runText(e.results[0][0].transcript); };
    rec.start();
  };
  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    setBusy(true); setErr("");
    try { const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f); }); const r = await aiParseReceipt(b64, f.type, s.categories); const cat = s.categories.find(c => c.name.toLowerCase() === (r.category || "").toLowerCase()) || s.categories.find(c => c.type === "out"); setDraft({ type: r.type || "out", categoryId: cat?.id, amount: r.amount, desc: r.desc, walletId: s.wallets[0].id, date: r.date || today(), source: "Scan nota" }); } catch { setErr("Nota tidak terbaca. Coba foto ulang."); }
    setBusy(false);
  };

  if (draft) return (
    <Sheet title="Tinjau & Simpan" onClose={() => setDraft(null)}>
      <div style={{ padding: "20px 16px" }}>
        <Card style={{ padding: 20, textAlign: "center" }}>
          {draft.type === "transfer" ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--brand)", textTransform: "uppercase" }}>Transfer</div>
              <div className="money" style={{ fontSize: 36, fontWeight: 800, color: "var(--brand)", margin: "8px 0" }}>{fmtMoney(draft.amount, s.profile.currency)}</div>
              <div style={{ fontSize: 14, color: "var(--ink2)" }}>
                {s.wallets.find(w => w.id === draft.fromWalletId)?.name}
                {" → "}
                {s.wallets.find(w => w.id === draft.toWalletId)?.name}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: draft.type === "in" ? "var(--in-text)" : "var(--out-text)", textTransform: "uppercase" }}>{draft.type === "in" ? "Pemasukan" : "Pengeluaran"}</div>
              <div className="money" style={{ fontSize: 36, fontWeight: 800, color: draft.type === "in" ? "var(--in-text)" : "var(--out-text)", margin: "8px 0" }}>{fmtMoney(draft.amount, s.profile.currency)}</div>
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{draft.desc}</div>
              <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 4 }}>{s.categories.find(c => c.id === draft.categoryId)?.name} · {s.wallets.find(w => w.id === draft.walletId)?.name}</div>
            </>
          )}
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <button onClick={() => setDraft(null)} style={{ padding: 14, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>← Edit lagi</button>
          <button onClick={() => { onSave(draft); onClose(); }} style={{ padding: 14, borderRadius: 14, border: "none", background: "var(--brand)", fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Check size={18} />Simpan</button>
        </div>
      </div>
    </Sheet>
  );

  return (
    <Sheet title="Catat Transaksi" onClose={onClose}>
      <div style={{ padding: "20px 16px 120px" }}>
        {mode === "voice" && (
          <Card style={{ padding: 20, background: "var(--surface2)", border: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)" }}><Sparkles size={20} /></div>
              <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Coba ucapkan…</span>
            </div>
            {[["Jual nasi bungkus 15 ribu", Store], ["Kulakan bahan setengah juta", ShoppingCart], ["Token listrik 50 ribu", Zap], ["Gaji karyawan sejuta", Users]].map(([ex, Ic], i) => (
              <button key={i} onClick={() => runText(ex)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0", borderBottom: i < 3 ? "1px solid var(--line)" : "none", background: "none", border: "none", borderBottom: i < 3 ? `1px solid var(--line)` : "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--ink2)" }}><Ic size={16} /></div>
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>"{ex}"</span>
              </button>
            ))}
            <div style={{ fontSize: 13, color: "var(--brand)", fontWeight: 600, marginTop: 14 }}>Tips: Sebutkan barang + nominal uangnya.</div>
          </Card>
        )}
        {mode === "manual" && <ManualForm s={s} onReady={setDraft} />}
        {mode === "scan" && (
          <Card style={{ padding: 40, textAlign: "center", background: "var(--surface2)", border: "none" }}>
            <ScanLine size={44} color="var(--brand)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16, marginBottom: 6 }}>Foto / pilih nota</div>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 20 }}>Claude akan baca total, merchant, dan tanggal.</div>
            <label style={{ display: "inline-block", padding: "11px 24px", borderRadius: 99, background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>
              Pilih gambar<input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={onPhoto} />
            </label>
          </Card>
        )}
        {mode === "voice" && (
          <div style={{ marginTop: 16 }}>
            <input placeholder="…atau ketik di sini lalu Enter"
              onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) runText(e.target.value.trim()); }}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
          </div>
        )}
        {busy && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--brand)", marginTop: 20, fontWeight: 600 }}><Loader2 size={18} className="animate-spin" />Membaca…</div>}
        {err && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13, fontWeight: 500 }}>{err}</div>}
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink3)", marginTop: 20 }}>Powered by NF3</div>
      </div>

      {/* mode bar */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "1px solid var(--line)", padding: "12px 32px 24px", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
        <ModeBtn active={mode === "manual"} onClick={() => { setMode("manual"); setErr(""); }} Icon={Keyboard} label="Manual" />
        <button onClick={() => { setMode("voice"); startVoice(); }} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", marginBottom: -6 }}>
          {listening && <span className="pulse-ring" style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--brand)", width: 60, height: 60, top: -6 }} />}
          <span style={{ width: 60, height: 60, borderRadius: 99, background: "linear-gradient(135deg,var(--brand),var(--brand-dark))", display: "grid", placeItems: "center", color: "#fff", position: "relative", boxShadow: "0 4px 16px rgba(99,102,241,.4)" }}><Mic size={26} /></span>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)" }}>Bicara</span>
        </button>
        <ModeBtn active={mode === "scan"} onClick={() => { setMode("scan"); setErr(""); }} Icon={ScanLine} label={`Scan Nota (2/2)`} />
      </div>
    </Sheet>
  );
}

const ModeBtn = ({ active, onClick, Icon, label }) => (
  <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer" }}>
    <span style={{ width: 46, height: 46, borderRadius: 99, background: active ? "var(--brand-soft)" : "var(--surface2)", display: "grid", placeItems: "center", color: active ? "var(--brand)" : "var(--ink3)" }}><Icon size={20} /></span>
    <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? "var(--brand)" : "var(--ink3)" }}>{label}</span>
  </button>
);

function ManualForm({ s, onReady }) {
  const role = s.currentUser?.role || "owner";
  const myWallets = visibleWallets(s.wallets, s.currentUser);

  // tipe yang boleh diakses per role
  const allowedTypes = [];
  if (canDo(role, "inputIncome")) allowedTypes.push(["in", "Pemasukan"]);
  allowedTypes.push(["out", "Pengeluaran"]);
  if (canDo(role, "transfer")) allowedTypes.push(["transfer", "Transfer"]);

  const [type, setType] = useState(allowedTypes[0][0]);
  const [amt, setAmt] = useState("");
  const [catId, setCatId] = useState("");
  const [walletId, setWalletId] = useState(myWallets[0]?.id || "");
  const [toWalletId, setToWalletId] = useState(myWallets[1]?.id || "");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(today());
  const [floorErr, setFloorErr] = useState("");

  const cats = s.categories.filter(c => c.active !== false && c.type === (type === "transfer" ? "out" : type));
  useEffect(() => { setCatId(cats[0]?.id || ""); }, [type]);

  const checkAndReady = () => {
    if (type === "transfer") {
      const err = checkFloor(walletId, +amt, s.wallets, s.transactions);
      if (err) { setFloorErr(err); return; }
      onReady({ type: "transfer", amount: +amt, fromWalletId: walletId, toWalletId, desc, date, source: "Manual" });
    } else {
      if (type === "out") {
        const err = checkFloor(walletId, +amt, s.wallets, s.transactions);
        if (err) { setFloorErr(err); return; }
      }
      onReady({ type, amount: +amt, categoryId: catId, walletId, desc, date, source: "Manual" });
    }
    setFloorErr("");
  };

  const typeColors = { in: "var(--in)", out: "var(--out)", transfer: "var(--brand)" };
  const ready = amt && (type === "transfer" ? (walletId && toWalletId && walletId !== toWalletId) : catId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* tipe selector */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${allowedTypes.length},1fr)`, gap: 2, background: "var(--surface2)", borderRadius: 12, padding: 4 }}>
        {allowedTypes.map(([v, l]) => (
          <button key={v} onClick={() => { setType(v); setFloorErr(""); }} style={{ padding: 11, borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: type === v ? typeColors[v] : "transparent", color: type === v ? "#fff" : "var(--ink2)" }}>{l}</button>
        ))}
      </div>

      {/* nominal */}
      <Fld label="Nominal">
        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${floorErr ? "var(--out)" : "var(--line)"}`, borderRadius: 12, background: "var(--surface)" }}>
          <span style={{ padding: "0 12px", color: "var(--ink3)", fontWeight: 700 }}>Rp</span>
          <input inputMode="numeric" value={amt ? new Intl.NumberFormat("id-ID").format(amt) : ""} onChange={e => { setAmt(e.target.value.replace(/\D/g, "")); setFloorErr(""); }} placeholder="0"
            style={{ flex: 1, padding: "13px 0 13px 4px", background: "none", border: "none", fontSize: 16, fontWeight: 700, color: "var(--ink)", outline: "none" }} />
        </div>
        {floorErr && (
          <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 12, fontWeight: 600 }}>
            ⚠ {floorErr}
          </div>
        )}
      </Fld>

      {/* transfer: pilih from & to */}
      {type === "transfer" ? (
        <>
          <Fld label="Dari dompet">
            <select value={walletId} onChange={e => { setWalletId(e.target.value); setFloorErr(""); }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }}>
              {myWallets.map(w => {
                const bal = walletBalance(w.id, s.wallets, s.transactions);
                return <option key={w.id} value={w.id}>{w.name} — Rp {new Intl.NumberFormat("id-ID").format(bal)}</option>;
              })}
            </select>
          </Fld>
          <Fld label="Ke dompet">
            <select value={toWalletId} onChange={e => setToWalletId(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }}>
              {myWallets.filter(w => w.id !== walletId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Fld>
          {walletId && amt && (() => {
            const w = s.wallets.find(x => x.id === walletId);
            const bal = walletBalance(walletId, s.wallets, s.transactions);
            const after = bal - +amt;
            if (w?.floor && after < w.floor) return null; // sudah tampil di floorErr
            return (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--surface2)", fontSize: 12, color: "var(--ink2)" }}>
                Saldo setelah transfer: <b>Rp {new Intl.NumberFormat("id-ID").format(bal - +amt)}</b>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          <Fld label="Kategori">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cats.map(c => <Pill key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>{c.name}</Pill>)}
            </div>
          </Fld>
          <Fld label="Dompet">
            <select value={walletId} onChange={e => { setWalletId(e.target.value); setFloorErr(""); }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }}>
              {myWallets.map(w => {
                const bal = walletBalance(w.id, s.wallets, s.transactions);
                return <option key={w.id} value={w.id}>{w.name} — Rp {new Intl.NumberFormat("id-ID").format(bal)}</option>;
              })}
            </select>
          </Fld>
        </>
      )}

      {/* tanggal & catatan */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Fld label="Tanggal"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} /></Fld>
        <Fld label="Catatan"><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="opsional" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} /></Fld>
      </div>

      <button disabled={!ready} onClick={checkAndReady}
        style={{ padding: 14, borderRadius: 14, border: "none", background: ready ? typeColors[type] : "var(--ink3)", opacity: ready ? 1 : .5, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        Lanjut tinjau →
      </button>
    </div>
  );
}
const Fld = ({ label, children }) => <div><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 6 }}>{label}</div>{children}</div>;

// ─── Inbox ─────────────────────────────────────────────────
function InboxScreen({ s, onClose, onAccept, onDismiss }) {
  const items = (s.rawInbox || []).map(n => ({ ...n, ...classifyNotif(n) }));
  return (
    <Sheet title="Inbox" onClose={onClose}>
      <div style={{ padding: 16 }}>
        <div style={{ background: "var(--amber-soft)", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
          <ShieldCheck size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: "var(--ink)" }}><b>Penyaring iklan aktif.</b> Notif promo ditandai <b>spam</b> otomatis — hanya transaksi nyata yang masuk draf.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(n => {
            const legit = n.verdict === "legit";
            return (
              <Card key={n.id} style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: legit ? "var(--in-soft)" : "var(--surface2)", color: legit ? "var(--in-text)" : "var(--ink3)" }}>{legit ? "Transaksi nyata" : "Spam / promo"}</span>
                  <span className="money" style={{ fontSize: 17, fontWeight: 800, color: legit ? "var(--ink)" : "var(--ink3)", textDecoration: legit ? "none" : "line-through" }}>{fmtMoney(n.amount, s.profile.currency)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: legit ? 600 : 400, color: legit ? "var(--ink)" : "var(--ink3)" }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3 }}>{n.body} · Notifikasi {n.src}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {legit ? (
                    <>
                      <button onClick={() => onAccept(n)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Check size={15} />Bukukan</button>
                      <button onClick={() => onDismiss(n.id)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, fontSize: 13, color: "var(--ink2)", cursor: "pointer" }}>Abaikan</button>
                    </>
                  ) : (
                    <button onClick={() => onDismiss(n.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, fontSize: 13, color: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Trash2 size={14} />Buang spam</button>
                  )}
                </div>
              </Card>
            );
          })}
          {items.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink3)" }}>Inbox bersih. Tidak ada draf menunggu.</div>}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Settings & Profil ─────────────────────────────────────
function PengaturanScreen({ s, mutate, onClose, setOverlay }) {
  const setP = (k, v) => mutate(d => { d.profile[k] = v; });
  const setA = (k, v) => mutate(d => { d.automation[k] = v; });
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(s.profile.name);
  return (
    <Sheet title="Pengaturan" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <Lbl>Profil</Lbl>
        <Card style={{ overflow: "hidden", marginBottom: 20 }}>
          <SRow icon={User} label="Nama Profil" val={s.profile.name} onClick={() => setEditName(v => !v)} />
          <SRow icon={Store} label="Tipe Akun" val={s.profile.type} onClick={() => setP("type", s.profile.type === "Usaha" ? "Pribadi" : "Usaha")} />
          <SRow icon={Wallet} label="Sesuaikan Saldo" val={`Saldo: Rp 0`} onClick={() => {}} />
          {canDo(s.currentUser?.role, "kelolaDompet") && <SRow icon={Wallet} label="Kelola Dompet" sub="Atur dompet dan pembagian uang Anda" onClick={() => setOverlay("wallets")} chev />}
          {canDo(s.currentUser?.role, "kelolaKategori") && <SRow icon={Filter} label="Kelola Kategori" sub="Tambah, edit, atau hapus kategori transaksi" onClick={() => setOverlay("categories")} chev />}
        </Card>

        {/* Role switcher — demo only */}
        <Lbl>Ganti Role (Demo)</Lbl>
        <Card style={{ overflow: "hidden", marginBottom: 20 }}>
          {(s.users || []).map(u => (
            <button key={u.id} onClick={() => mutate(d => { d.currentUser = u; })}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--line)", background: s.currentUser?.id === u.id ? "var(--brand-soft)" : "none", border: "none", borderBottom: "1px solid var(--line)", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 32, height: 32, borderRadius: 99, background: s.currentUser?.id === u.id ? "var(--brand)" : "var(--surface2)", display: "grid", placeItems: "center", color: s.currentUser?.id === u.id ? "#fff" : "var(--ink3)" }}><User size={15} /></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14 }}>{u.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)" }}>{u.role}{u.outlet ? ` · ${u.outlet}` : ""}</div>
              </div>
              {s.currentUser?.id === u.id && <Check size={16} color="var(--brand)" />}
            </button>
          ))}
        </Card>
        {editName && (
          <div style={{ display: "flex", gap: 8, marginTop: -10, marginBottom: 20 }}>
            <input value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
            <button onClick={() => { setP("name", name); setEditName(false); }} style={{ padding: "0 16px", borderRadius: 12, background: "var(--brand)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}>Simpan</button>
          </div>
        )}

        <Lbl>Tampilan & Format</Lbl>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          {[["sistem", "Sistem", Smartphone], ["terang", "Terang", Sun], ["gelap", "Gelap", Moon]].map(([v, l, Ic]) => (
            <button key={v} onClick={() => setP("theme", v)} style={{ padding: "12px 0", borderRadius: 12, border: `1px solid ${s.profile.theme === v ? "var(--brand)" : "var(--line)"}`, background: s.profile.theme === v ? "var(--brand-soft)" : "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: s.profile.theme === v ? "var(--brand)" : "var(--ink2)" }}>
              <Ic size={18} /><span style={{ fontSize: 12, fontWeight: 600 }}>{l}</span>
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ padding: "13px 16px", borderRadius: 12, border: "1px solid var(--brand)", background: "var(--brand-soft)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: "var(--brand)" }}>Rp</span>
            <span style={{ fontWeight: 700, color: "var(--brand)" }}>Rupiah</span>
            <Check size={16} color="var(--brand)" style={{ marginLeft: "auto" }} />
          </div>
        </div>

        <Lbl>Keamanan</Lbl>
        <Card style={{ overflow: "hidden", marginBottom: 24 }}>
          <SRow icon={ShieldCheck} label="Ubah PIN Keamanan" sub="PIN aktif untuk melindungi data Anda" val="Aktif" valColor="var(--in-text)" chev />
          <SRow icon={ShieldCheck} label="Hapus PIN Keamanan" sub="Matikan kunci aplikasi" chev />
          <STog icon={Fingerprint} label="Sidik Jari / Wajah" sub="Gunakan biometrik untuk membuka kunci" on={s.profile.biometric} onToggle={() => setP("biometric", !s.profile.biometric)} />
        </Card>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <Lbl>Otomatisasi</Lbl>
          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--out-soft)", color: "var(--out-text)", marginBottom: 10 }}>BETA</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: -6, marginBottom: 10 }}>Fitur masih disempurnakan. Beberapa notifikasi mungkin belum tepat dibaca — selalu cek draf sebelum simpan.</div>
        <Card style={{ overflow: "hidden", marginBottom: 24 }}>
          <STog icon={Bell} label="Aktifkan auto-import dari notifikasi" sub="NF3 baca notifikasi bank/e-wallet untuk buat draf transaksi otomatis" on={s.automation.autoImport} onToggle={() => setA("autoImport", !s.automation.autoImport)} />
          <STog icon={Zap} label="Tampilkan notifikasi balasan saat transaksi terdeteksi" sub="NF3 akan munculkan notifikasi singkat dengan tombol Simpan" on={s.automation.replyNotif} onToggle={() => setA("replyNotif", !s.automation.replyNotif)} />
        </Card>

        <Lbl>Web Dashboard</Lbl>
        <Card style={{ marginBottom: 24 }}><SRow icon={Monitor} label="Hubungkan ke Web" sub="Buka dashboard & laporan di PC" onClick={() => setOverlay("pair")} chev /></Card>

        <Lbl>Lainnya</Lbl>
        <Card style={{ marginBottom: 24 }}><SRow icon={ShieldCheck} label="Kebijakan Privasi" sub="Data Anda sepenuhnya milik Anda" chev /></Card>

        <Lbl>Akun & Sync</Lbl>
        <Card style={{ overflow: "hidden", marginBottom: 24 }}>
          <SRow icon={User} label="Sinkronisasi Awan" sub={s.profile.email} chev />
          <SRow icon={RefreshCw} label="Sinkronisasi Manual" sub="Paksa simpan data ke awan sekarang" chev />
        </Card>
      </div>
    </Sheet>
  );
}
function SRow({ icon: Ic, label, sub, val, valColor, onClick, chev }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: "1px solid var(--line)", background: "none", border: "none", borderBottom: "1px solid var(--line)", cursor: onClick ? "pointer" : "default", textAlign: "left" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)", flexShrink: 0 }}><Ic size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 1 }}>{sub}</div>}
      </div>
      {val && <span style={{ fontSize: 13, fontWeight: 700, color: valColor || "var(--ink2)", marginRight: 4 }}>{val}</span>}
      {chev && <ChevronRight size={16} color="var(--ink3)" />}
    </button>
  );
}
function STog({ icon: Ic, label, sub, on, onToggle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)", flexShrink: 0 }}><Ic size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 1 }}>{sub}</div>}
      </div>
      <Tog on={on} onToggle={onToggle} />
    </div>
  );
}

// ─── Kelola Dompet (admin/owner only) ─────────────────────
function WalletScreen({ s, mutate, onClose }) {
  const [edit, setEdit] = useState(null);

  const save = (w) => {
    mutate(d => {
      const i = d.wallets.findIndex(x => x.id === w.id);
      if (i >= 0) d.wallets[i] = w;
      else d.wallets.push({ ...w, id: "w" + Date.now() });
    });
    setEdit(null);
  };

  const toggleActive = (id) => mutate(d => {
    const w = d.wallets.find(x => x.id === id);
    if (w) w.active = !w.active;
  });

  const tryDelete = (w) => {
    const bal = walletBalance(w.id, s.wallets, s.transactions);
    if (bal !== (w.floor || 0)) {
      alert(`Tidak bisa dihapus. Saldo harus sama dengan floor (Rp ${new Intl.NumberFormat("id-ID").format(w.floor || 0)}) sebelum dihapus.`);
      return;
    }
    mutate(d => { d.wallets = d.wallets.filter(x => x.id !== w.id); });
  };

  const typeLabels = { kas_fisik: "Kas Fisik", rekening: "Rekening", digital: "Digital" };
  const typeColors = { kas_fisik: "#D97706", rekening: "#1D4ED8", digital: "#7C3AED" };

  return (
    <Sheet title="Kelola Dompet" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        {s.wallets.map(w => {
          const bal = walletBalance(w.id, s.wallets, s.transactions);
          const nearFloor = w.floor && bal <= w.floor * 1.2;
          return (
            <Card key={w.id} style={{ padding: "14px 16px", position: "relative", overflow: "hidden", opacity: w.active === false ? .5 : 1 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: w.color }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: w.color + "22", display: "grid", placeItems: "center", color: w.color, flexShrink: 0 }}>
                  <Wallet size={18} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink)" }}>{w.name}</span>
                    {w.outlet && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)" }}>{w.outlet}</span>}
                    {w.ownerOnly && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "var(--amber-soft)", color: "var(--amber)" }}>Owner</span>}
                    {w.type && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: typeColors[w.type] + "22", color: typeColors[w.type] }}>{typeLabels[w.type]}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
                    Saldo: <b style={{ color: nearFloor ? "var(--out-text)" : "var(--ink)" }}>Rp {new Intl.NumberFormat("id-ID").format(bal)}</b>
                    {w.floor > 0 && <span style={{ color: "var(--ink3)" }}> · Floor: Rp {new Intl.NumberFormat("id-ID").format(w.floor)}</span>}
                    {nearFloor && <span style={{ color: "var(--out-text)", fontWeight: 600 }}> ⚠ Mendekati minimum</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => toggleActive(w.id)} style={{ width: 32, height: 32, borderRadius: 99, background: w.active === false ? "var(--in-soft)" : "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: w.active === false ? "var(--in)" : "var(--ink3)" }}>
                    {w.active === false ? <Check size={14} /> : <X size={14} />}
                  </button>
                  <button onClick={() => setEdit({ ...w })} style={{ width: 32, height: 32, borderRadius: 99, background: "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink2)" }}><Pencil size={14} /></button>
                  <button onClick={() => tryDelete(w)} style={{ width: 32, height: 32, borderRadius: 99, background: "var(--out-soft)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--out)" }}><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          );
        })}

        <button onClick={() => setEdit({ id: "w" + Date.now(), name: "", type: "kas_fisik", outlet: null, color: "#6366F1", opening: 0, floor: 0, active: true, ownerOnly: false })}
          style={{ padding: 14, borderRadius: 16, border: "2px dashed var(--line)", background: "none", color: "var(--brand)", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plus size={18} />Tambah dompet baru
        </button>
      </div>

      {edit && (
        <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end" }} onClick={() => setEdit(null)}>
          <div style={{ width: "100%", background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "80vh", overflowY: "auto" }} className="scroll-hide" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)", marginBottom: 16 }}>{edit.name ? `Edit: ${edit.name}` : "Dompet baru"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Fld label="Nama">
                <input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="cth: Laci KBU" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
              </Fld>
              <Fld label="Tipe">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {Object.entries(typeLabels).map(([v, l]) => (
                    <button key={v} onClick={() => setEdit({ ...edit, type: v })} style={{ padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${edit.type === v ? typeColors[v] : "var(--line)"}`, background: edit.type === v ? typeColors[v] + "22" : "var(--surface)", color: edit.type === v ? typeColors[v] : "var(--ink2)", cursor: "pointer" }}>{l}</button>
                  ))}
                </div>
              </Fld>
              <Fld label="Outlet (opsional)">
                <div style={{ display: "flex", gap: 6 }}>
                  {[null, "KBU", "KSM", "SMT"].map(o => (
                    <button key={o ?? "semua"} onClick={() => setEdit({ ...edit, outlet: o })} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${edit.outlet === o ? "var(--brand)" : "var(--line)"}`, background: edit.outlet === o ? "var(--brand-soft)" : "var(--surface)", color: edit.outlet === o ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>{o ?? "Semua"}</button>
                  ))}
                </div>
              </Fld>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Fld label="Saldo awal (Rp)">
                  <input inputMode="numeric" value={edit.opening ? new Intl.NumberFormat("id-ID").format(edit.opening) : ""} onChange={e => setEdit({ ...edit, opening: +e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
                </Fld>
                <Fld label="Floor minimum (Rp)">
                  <input inputMode="numeric" value={edit.floor ? new Intl.NumberFormat("id-ID").format(edit.floor) : ""} onChange={e => setEdit({ ...edit, floor: +e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
                </Fld>
              </div>
              <Fld label="Owner only (rekening bank)">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Tog on={!!edit.ownerOnly} onToggle={() => setEdit({ ...edit, ownerOnly: !edit.ownerOnly })} />
                  <span style={{ fontSize: 13, color: "var(--ink2)" }}>Hanya Owner yang bisa lihat</span>
                </div>
              </Fld>
              <Fld label="Warna">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["#6366F1","#16A34A","#D97706","#0EA5E9","#8B5CF6","#EC4899","#14B8A6","#F97316","#1D4ED8","#DC2626","#CA8A04","#7C3AED"].map(c => (
                    <button key={c} onClick={() => setEdit({ ...edit, color: c })} style={{ width: 30, height: 30, borderRadius: 99, background: c, border: edit.color === c ? "3px solid var(--ink)" : "3px solid transparent", cursor: "pointer" }} />
                  ))}
                </div>
              </Fld>
            </div>
            <button disabled={!edit.name} onClick={() => save(edit)}
              style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 14, border: "none", background: edit.name ? "var(--brand)" : "var(--ink3)", opacity: edit.name ? 1 : .5, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Simpan dompet
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ─── Kelola Kategori (admin/owner only) ───────────────────
function CatScreen({ s, mutate, onClose }) {
  const [tab, setTab] = useState("out");
  const [name, setName] = useState("");
  const cats = s.categories.filter(c => c.type === tab);

  const addCat = () => {
    if (!name.trim()) return;
    mutate(d => d.categories.push({ id: "c" + Date.now(), name: name.trim(), type: tab, active: true }));
    setName("");
  };
  const toggleCat = (id) => mutate(d => { const c = d.categories.find(x => x.id === id); if (c) c.active = !c.active; });
  const deleteCat = (id) => mutate(d => { d.categories = d.categories.filter(x => x.id !== id); });

  return (
    <Sheet title="Kelola Kategori" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "var(--surface2)", borderRadius: 12, padding: 4, marginBottom: 16 }}>
          {[["out", "Pengeluaran"], ["in", "Pemasukan"]].map(([v, l]) => (
            <button key={v} onClick={() => setTab(v)} style={{ padding: 10, borderRadius: 9, border: "none", cursor: "pointer", background: tab === v ? "var(--brand)" : "transparent", color: tab === v ? "#fff" : "var(--ink2)", fontWeight: 700, fontSize: 13 }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()} placeholder="Nama kategori baru" style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
          <button onClick={addCat} style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand)", border: "none", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><Plus size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cats.map(c => {
            const Ic = getCatIcon(c);
            return (
              <Card key={c.id} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, opacity: c.active === false ? .5 : 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tab === "in" ? "var(--in-soft)" : "var(--out-soft)", display: "grid", placeItems: "center", color: tab === "in" ? "var(--in)" : "var(--out)" }}><Ic size={16} /></div>
                <span style={{ flex: 1, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                {c.active === false && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "var(--surface2)", color: "var(--ink3)" }}>nonaktif</span>}
                <button onClick={() => toggleCat(c.id)} title={c.active === false ? "Aktifkan" : "Nonaktifkan"} style={{ width: 30, height: 30, borderRadius: 99, background: c.active === false ? "var(--in-soft)" : "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: c.active === false ? "var(--in)" : "var(--ink3)" }}>
                  {c.active === false ? <Check size={13} /> : <X size={13} />}
                </button>
                <button onClick={() => deleteCat(c.id)} style={{ width: 30, height: 30, borderRadius: 99, background: "var(--out-soft)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--out)" }}><Trash2 size={13} /></button>
              </Card>
            );
          })}
          {cats.length === 0 && <div style={{ textAlign: "center", color: "var(--ink3)", padding: "20px 0", fontSize: 13 }}>Belum ada kategori {tab === "in" ? "pemasukan" : "pengeluaran"}.</div>}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Web Pairing ───────────────────────────────────────────
function PairScreen({ s, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <Sheet title="Hubungkan ke Web" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <Card style={{ padding: 24, textAlign: "center", marginBottom: 16, background: "var(--brand-soft)" }}>
          <Monitor size={48} color="var(--brand)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--brand-text)" }}>Pantau Laporan di PC</div>
          <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6 }}>Buka <b>nf3.nusafishing.com</b> di browser PC/Tablet Anda, lalu scan QR atau input kode untuk masuk.</div>
          <button style={{ marginTop: 16, padding: "12px 24px", borderRadius: 12, background: "var(--brand)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}><ScanLine size={18} />Scan QR Code</button>
        </Card>
        <Card style={{ padding: 20, background: "#F0FDF4", border: "1px solid #BBF7D0", marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 6 }}>Kode Undangan (untuk input di Web)</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.12em", color: "#16A34A" }}>{s.pairCode}</span>
            <button onClick={() => { navigator.clipboard?.writeText(s.pairCode); setCopied(true); setTimeout(() => setCopied(false), 1500); }} style={{ width: 36, height: 36, borderRadius: 99, background: "none", border: "none", cursor: "pointer", color: "#16A34A" }}>{copied ? <Check size={20} /> : <Copy size={20} />}</button>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 8 }}>Buka nf3.nusafishing.com/pair → pilih "Input Kode Manual" → ketik kode ini</div>
        </Card>
        <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>Permintaan Akses</div>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 20 }}>Jika Anda mengetik kode di web, permintaannya akan muncul di bawah ini.</div>
        <div style={{ textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>Tidak ada permintaan aktif</div>
      </div>
    </Sheet>
  );
}

// ─── Notif ─────────────────────────────────────────────────
function NotifScreen({ onClose }) {
  const items = [
    { t: "Kasir-in Release 🔥", b: "Halo guys, yg punya usaha UMKM mau app kasir Gratis, kita baru aja rilis app 'Kasir-in' Gratis di Playstore ya. klik aja notif ini 😉", time: "07 Jun 2026, 13:19" },
    { t: "5.000 user dalam 2 Bulan 🔥", b: "Big thanks buat kalian semua yang sudah percaya NF3. 5000 user bukan angka kecil bagi kami. Jangan lupa kasih rating di Playstore ya.", time: "05 Jun 2026, 00:12" },
    { t: "Bocor tanpa sadar", b: "☕ Kopi & boba kamu sehari = berapa juta setahun? Cek sekarang →", time: "05 Mei 2026, 18:05" },
    { t: "Catat Hutang Pelanggan/Teman kamu", b: "Kamu bisa Tagih dan Ingatkan hutang teman atau pelanggan dengan semi Automatis dari aplikasi ke whatsapp target.", time: "28 Apr 2026, 11:42" },
  ];
  return (
    <Sheet title="Pemberitahuan" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((n, i) => (
          <Card key={i} style={{ padding: 16 }}>
            <div style={{ fontWeight: 700, color: "var(--brand)", fontSize: 14, marginBottom: 6 }}>{n.t}</div>
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>{n.b}</div>
            <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8 }}>{n.time}</div>
            <button style={{ marginTop: 6, fontSize: 12, color: "var(--brand)", fontWeight: 600, background: "none", border: "none", cursor: "pointer", padding: 0 }}>🔗 Buka Tautan</button>
          </Card>
        ))}
      </div>
    </Sheet>
  );
}

// ─── NavBar ────────────────────────────────────────────────
function NavBar({ tab, setTab, onMic }) {
  const tabs = [["beranda", Home, "Beranda"], ["laporan", BarChart3, "Laporan"], ["analisis", Sparkles, "Analisis"], ["profil", User, "Profil"]];
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "1px solid var(--line)" }}>
      <div style={{ display: "flex", alignItems: "center", height: 70, position: "relative" }}>
        {tabs.slice(0, 2).map(([id, Ic, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "8px 0" }}>
            <Ic size={22} color={tab === id ? "var(--brand)" : "var(--ink3)"} />
            <span style={{ fontSize: 11, fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--brand)" : "var(--ink3)" }}>{label}</span>
          </button>
        ))}
        <div style={{ width: 72, flexShrink: 0 }} />
        {tabs.slice(2).map(([id, Ic, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "8px 0" }}>
            <Ic size={22} color={tab === id ? "var(--brand)" : "var(--ink3)"} />
            <span style={{ fontSize: 11, fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--brand)" : "var(--ink3)" }}>{label}</span>
          </button>
        ))}
        <button onClick={onMic} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: -20, width: 60, height: 60, borderRadius: 99, background: "linear-gradient(135deg,#6366F1,#4F46E5)", border: "4px solid var(--surface)", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,.45)" }}>
          <Mic size={24} color="#fff" />
        </button>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────
export default function App() {
  const [s, setS] = useState(null);
  const [tab, setTab] = useState("beranda");
  const [overlay, setOverlay] = useState(null);
  const [catat, setCatat] = useState(false);
  const [hide, setHide] = useState(false);

  useEffect(() => { loadState().then(setS); }, []);
  useEffect(() => { if (s) saveState(s); }, [s]);

  const mutate = useCallback((fn) => setS(prev => {
    const copy = JSON.parse(JSON.stringify(prev));
    fn(copy);
    return copy;
  }), []);

  // Subscribe ke system dark mode jika tema = sistem
  useEffect(() => {
    if (!s || (s.profile.theme !== "sistem" && s.profile.theme !== "system")) return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = () => setS(prev => prev ? { ...prev, _systemThemeTick: Date.now() } : prev);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [s?.profile?.theme]);

  const addTx = (d) => mutate(st => st.transactions.push({
    ...d,
    id: "t" + Date.now() + Math.random().toString(36).slice(2, 5),
  }));
  const acceptDraft = (n) => {
    const c = classifyNotif(n);
    // cari kategori penjualan aktif
    const cat = s.categories.find(x => x.type === "in" && x.active !== false && x.name.toLowerCase().includes("penjual"))
      || s.categories.find(x => x.type === "in" && x.active !== false);
    // pakai dompet pertama yang visible untuk user aktif
    const myW = visibleWallets(s.wallets, s.currentUser || { role: "owner" });
    const wallet = myW[0];
    if (!wallet) return;
    addTx({ type: "in", amount: c.amount, categoryId: cat?.id, walletId: wallet.id, desc: n.title, date: today(), source: "Auto-import " + n.src });
    mutate(st => { st.rawInbox = (st.rawInbox || []).filter(x => x.id !== n.id); });
  };
  const dismiss = (id) => mutate(st => { st.rawInbox = (st.rawInbox || []).filter(x => x.id !== id); });

  const theme = !s ? "light" : (() => {
    const t = s.profile.theme;
    if (t === "dark" || t === "gelap") return "dark";
    if (t === "light" || t === "terang") return "light";
    // sistem: ikuti preferensi HP
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  })();

  if (!s) return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#F0F0F8" }}>
      <Loader2 size={28} color="#6366F1" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div data-theme={theme} style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", justifyContent: "center" }}>
      <style>{CSS}</style>
      <div style={{ position: "relative", width: "100%", maxWidth: 440, minHeight: "100vh", background: "var(--bg)", overflow: "hidden" }}>
        <div style={{ height: "100vh", overflowY: "auto", paddingBottom: 70 }} className="scroll-hide">
          {tab === "beranda"  && <Beranda s={s} setTab={setTab} setOverlay={setOverlay} hide={hide} setHide={setHide} />}
          {tab === "laporan"  && <Laporan s={s} />}
          {tab === "analisis" && <Analisis s={s} hideInsight={(id) => mutate(d => d.hiddenInsights.push(id))} />}
          {tab === "profil"   && <PengaturanScreen s={s} mutate={mutate} onClose={() => setTab("beranda")} setOverlay={setOverlay} />}
        </div>
        <NavBar tab={tab} setTab={setTab} onMic={() => setCatat(true)} />

        {catat          && <CatatTransaksi s={s} onSave={addTx} onClose={() => setCatat(false)} />}
        {overlay === "inbox"      && <InboxScreen s={s} onClose={() => setOverlay(null)} onAccept={acceptDraft} onDismiss={dismiss} />}
        {overlay === "notif"      && <NotifScreen onClose={() => setOverlay(null)} />}
        {overlay === "settings"   && <PengaturanScreen s={s} mutate={mutate} onClose={() => setOverlay(null)} setOverlay={setOverlay} />}
        {overlay === "wallets"    && <WalletScreen s={s} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "categories" && <CatScreen s={s} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "pair"       && <PairScreen s={s} onClose={() => setOverlay(null)} />}
      </div>
    </div>
  );
}
