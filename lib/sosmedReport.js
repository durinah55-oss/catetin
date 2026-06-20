// lib/sosmedReport.js — daily report sosial media per outlet

export const SOSMED_OUTLETS = ["KBU", "KSM", "SMT"];

/** Nama tampilan outlet di form sosmed. */
export const SOSMED_OUTLET_DISPLAY = {
  KBU: "BURI UMAH",
  KSM: "Kisamen",
  SMT: "Samtaro",
};

export const DM_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
  { key: "whatsapp", label: "WhatsApp" },
];

export const SOCIAL_PLATFORMS = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "facebook", label: "Facebook" },
];

export const STAR_KEYS = [
  { key: "star5", label: "Bintang 5" },
  { key: "star4", label: "Bintang 4" },
  { key: "star3", label: "Bintang 3" },
  { key: "star2", label: "Bintang 2" },
  { key: "star1", label: "Bintang 1" },
];

export function defaultSosmedConfig() {
  return { enabledOutlets: ["KBU"] };
}

export function hydrateSosmedConfig(saved) {
  const base = defaultSosmedConfig();
  if (!saved || typeof saved !== "object") return base;
  const list = Array.isArray(saved.enabledOutlets) ? saved.enabledOutlets.filter(o => SOSMED_OUTLETS.includes(o)) : base.enabledOutlets;
  return { enabledOutlets: list.length ? list : base.enabledOutlets };
}

export function isSosmedEnabled(config, outlet) {
  return hydrateSosmedConfig(config).enabledOutlets.includes(outlet);
}

export function sosmedDisplayName(outlet) {
  return SOSMED_OUTLET_DISPLAY[outlet] || outlet || "—";
}

export function emptyCounts(keys) {
  return Object.fromEntries(keys.map(k => [k, 0]));
}

export function emptyReport(outlet, date) {
  return {
    id: "sm" + Date.now(),
    outlet,
    date,
    dm: emptyCounts(DM_PLATFORMS.map(p => p.key)),
    comments: emptyCounts(SOCIAL_PLATFORMS.map(p => p.key)),
    googleReviews: emptyCounts(STAR_KEYS.map(s => s.key)),
    replied: Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.key, false])),
    wellDone: false,
    complaints: [],
    topQuestions: [],
    submittedAt: null,
    submittedBy: null,
    submittedByName: null,
  };
}

export function parseNum(v) {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function parseLines(text) {
  return String(text || "")
    .split(/\n/)
    .map(l => l.trim())
    .filter(Boolean);
}

export function linesToText(lines) {
  return (lines || []).join("\n");
}

export function todaySosmedReport(reports, outlet, date) {
  return (reports || []).find(r => r.outlet === outlet && r.date === date) || null;
}

/**
 * Simpan / update laporan sosmed (1 per outlet per hari).
 */
export function submitSosmedReport(state, payload, user) {
  const outlet = payload.outlet || user?.outlet;
  const date = payload.date;
  if (!outlet || !SOSMED_OUTLETS.includes(outlet)) throw new Error("Outlet tidak valid.");
  if (!date) throw new Error("Tanggal wajib diisi.");
  if (!isSosmedEnabled(state.sosmedConfig, outlet)) {
    throw new Error(`Daily Report Sosmed belum aktif untuk ${sosmedDisplayName(outlet)}.`);
  }

  const entry = {
    id: payload.id || "sm" + Date.now(),
    outlet,
    date,
    dm: Object.fromEntries(DM_PLATFORMS.map(p => [p.key, parseNum(payload.dm?.[p.key])])),
    comments: Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.key, parseNum(payload.comments?.[p.key])])),
    googleReviews: Object.fromEntries(STAR_KEYS.map(s => [s.key, parseNum(payload.googleReviews?.[s.key])])),
    replied: Object.fromEntries(SOCIAL_PLATFORMS.map(p => [p.key, !!payload.replied?.[p.key]])),
    wellDone: !!payload.wellDone,
    complaints: Array.isArray(payload.complaints) ? payload.complaints : parseLines(payload.complaintsText),
    topQuestions: Array.isArray(payload.topQuestions) ? payload.topQuestions : parseLines(payload.topQuestionsText),
    submittedAt: new Date().toISOString(),
    submittedBy: user?.id || null,
    submittedByName: user?.name || "Staff",
  };

  const reports = [...(state.sosmedReports || [])];
  const idx = reports.findIndex(r => r.outlet === outlet && r.date === date);
  if (idx >= 0) {
    entry.id = reports[idx].id;
    reports[idx] = entry;
  } else {
    reports.push(entry);
  }

  return { entry, reports };
}

export function canInputSosmed(user, config) {
  const role = user?.role || "kasir";
  if (role === "owner" || role === "admin") return true;
  if (role === "kasir" && user.outlet && isSosmedEnabled(config, user.outlet)) return true;
  return false;
}

export function resolveSosmedOutlet(user, selectedOutlet) {
  const role = user?.role || "kasir";
  if (role === "kasir") return user.outlet;
  return selectedOutlet || "KBU";
}
