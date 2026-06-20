// lib/reportChannels.js — channel laporan omset per outlet (disimpan di app_state, editable admin)

import { OUTLETS } from "./sdmHarian.js";

/** Dompet tujuan settle Admin NF3 (non-tunai). */
export const SETTLE_WALLET_OPTIONS = [
  { id: "w_bca", label: "Rekening BCA" },
  { id: "w_bri", label: "Rekening BRI" },
  { id: "w_bni", label: "Rekening BNI" },
  { id: "w_mandiri", label: "Rekening Mandiri" },
  { id: "w_owner", label: "Rekening Owner" },
  { id: "w_pm", label: "Shopee Food" },
  { id: "w_nf", label: "Grab Food" },
  { id: "w_gofood", label: "Go Food" },
];

/** Template awal — hanya dipakai saat bisnis baru / reset manual admin. */
export const FACTORY_REPORT_CHANNELS = {
  KSM: [
    { id: "tunai", label: "Tunai", icon: "💵", role: "cash", group: "Omset", order: 1, active: true, categoryHint: "tunai" },
    { id: "ojek_online", label: "Ojek Online", icon: "🛵", role: "channel", settleWallet: "w_gofood", group: "Omset", order: 2, active: true, categoryHint: "gojek" },
    { id: "qris_bca", label: "QRIS BCA", icon: "📱", role: "channel", settleWallet: "w_bca", group: "Omset", order: 3, active: true, categoryHint: "qris bca" },
    { id: "grab", label: "Grab", icon: "🛵", role: "channel", settleWallet: "w_nf", group: "Omset", order: 4, active: true, categoryHint: "grab" },
  ],
  SMT: [
    { id: "tunai", label: "Tunai", icon: "💵", role: "cash", order: 1, active: true, categoryHint: "tunai" },
    { id: "online", label: "Online", icon: "🌐", role: "channel", settleWallet: "w_nf", order: 2, active: true, categoryHint: "online" },
    { id: "qris", label: "QRIS", icon: "📱", role: "channel", settleWallet: "w_bca", order: 3, active: true, categoryHint: "qris" },
    { id: "debit", label: "Debit", icon: "💳", role: "channel", settleWallet: "w_bri", order: 4, active: true, categoryHint: "debit" },
    { id: "shopee", label: "Shopee", icon: "🛒", role: "channel", settleWallet: "w_pm", order: 5, active: true, categoryHint: "shopee" },
  ],
  KBU: [
    { id: "tunai", label: "Pembayaran Tunai", icon: "💵", role: "cash", group: "Kontrol Cash", order: 90, active: true, categoryHint: "tunai" },
    { id: "gofood", label: "Gofood", icon: "🍔", role: "channel", settleWallet: "w_gofood", group: "Online", order: 10, active: true, categoryHint: "gojek" },
    { id: "grabfood", label: "Grabfood", icon: "🛵", role: "channel", settleWallet: "w_nf", group: "Online", order: 11, active: true, categoryHint: "grab" },
    { id: "shopefood", label: "Shopefood", icon: "🛒", role: "channel", settleWallet: "w_pm", group: "Online", order: 12, active: true, categoryHint: "shopee" },
    { id: "edc_bri", label: "EDC BRI", icon: "💳", role: "channel", settleWallet: "w_bri", group: "EDC", order: 20, active: true, categoryHint: "qris bri" },
    { id: "edc_bca", label: "EDC BCA", icon: "💳", role: "channel", settleWallet: "w_bca", group: "EDC", order: 21, active: true, categoryHint: "qris bca" },
    { id: "qris_esb", label: "QRIS ESB", icon: "📱", role: "channel", settleWallet: "w_bca", group: "QRIS & Debit", order: 30, active: true, categoryHint: "qris" },
    { id: "debit_bri", label: "Debit BRI", icon: "💳", role: "channel", settleWallet: "w_bri", group: "QRIS & Debit", order: 31, active: true, categoryHint: "debit" },
    { id: "qris_pa_bos", label: "Qris pa bos", icon: "📱", role: "channel", settleWallet: "w_bca", group: "QRIS & Debit", order: 32, active: true, categoryHint: "qris" },
    { id: "tf_bri", label: "Transfer BRI", icon: "🏦", role: "channel", settleWallet: "w_bri", group: "Transfer Bank", order: 40, active: true, categoryHint: "transfer" },
    { id: "tf_bca", label: "Transfer BCA", icon: "🏦", role: "channel", settleWallet: "w_bca", group: "Transfer Bank", order: 41, active: true, categoryHint: "transfer" },
    { id: "tf_mandiri", label: "Transfer Mandiri", icon: "🏦", role: "channel", settleWallet: "w_mandiri", group: "Transfer Bank", order: 42, active: true, categoryHint: "transfer" },
    { id: "tf_bni", label: "Transfer BNI", icon: "🏦", role: "channel", settleWallet: "w_bni", group: "Transfer Bank", order: 43, active: true, categoryHint: "transfer" },
    { id: "tf_bjb", label: "Transfer BJB", icon: "🏦", role: "channel", settleWallet: "w_owner", group: "Transfer Bank", order: 44, active: false, categoryHint: "transfer" },
    { id: "tf_seabank", label: "Transfer SeaBank", icon: "🏦", role: "channel", settleWallet: "w_owner", group: "Transfer Bank", order: 45, active: false, categoryHint: "transfer" },
    { id: "dp_bri", label: "DP BRI (Bukber)", icon: "📋", role: "channel", settleWallet: "w_bri", group: "DP Bukber", order: 50, active: false, categoryHint: "dp" },
    { id: "dp_bca", label: "DP BCA (Bukber)", icon: "📋", role: "channel", settleWallet: "w_bca", group: "DP Bukber", order: 51, active: false, categoryHint: "dp" },
    { id: "dp_bni", label: "DP BNI (Bukber)", icon: "📋", role: "channel", settleWallet: "w_bni", group: "DP Bukber", order: 52, active: false, categoryHint: "dp" },
    { id: "dp_mandiri", label: "DP Mandiri (Bukber)", icon: "📋", role: "channel", settleWallet: "w_mandiri", group: "DP Bukber", order: 53, active: false, categoryHint: "dp" },
  ],
};

/** @deprecated — gunakan FACTORY_REPORT_CHANNELS */
export const DEFAULT_REPORT_CHANNELS = FACTORY_REPORT_CHANNELS;

export const FACTORY_REPORT_UI = {
  KSM: { physicalCashControl: true, showKasAwal: true },
  SMT: { physicalCashControl: true, showKasAwal: true },
  KBU: { physicalCashControl: true, showKasAwal: true },
};

export const DEFAULT_REPORT_UI = FACTORY_REPORT_UI;

function cloneChannels(list) {
  return (list || []).map((c) => ({ ...c }));
}

/** Isi config dari template jika belum pernah disimpan. */
export function hydrateReportChannels(saved) {
  const out = {};
  OUTLETS.forEach((o) => {
    out[o] = saved?.[o]?.length
      ? cloneChannels(saved[o])
      : cloneChannels(FACTORY_REPORT_CHANNELS[o] || []);
  });
  return out;
}

export function hydrateReportUi(saved) {
  const out = {};
  OUTLETS.forEach((o) => {
    out[o] = { ...FACTORY_REPORT_UI[o], ...(saved?.[o] || {}) };
  });
  return out;
}

function outletChannels(state, outlet) {
  const list = state?.reportChannels?.[outlet];
  if (list?.length) return cloneChannels(list);
  return cloneChannels(FACTORY_REPORT_CHANNELS[outlet] || []);
}

export function getReportChannels(state, outlet) {
  return outletChannels(state, outlet)
    .filter((c) => c.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
}

export function getAllReportChannels(state, outlet) {
  return outletChannels(state, outlet).sort((a, b) => (a.order || 0) - (b.order || 0));
}

/** Definisi channel saat laporan dikirim — dipakai settle meski config sudah diubah. */
export function snapshotChannelDefs(channels) {
  return (channels || []).map((c) => ({
    id: c.id,
    label: c.label,
    role: c.role,
    settleWallet: c.settleWallet,
    categoryHint: c.categoryHint,
    group: c.group,
    icon: c.icon,
  }));
}

/** Channel untuk settle: snapshot laporan dulu, lalu config saat ini. */
export function getSettleChannels(state, report) {
  if (report?.channelDefs?.length) return report.channelDefs;
  return getAllReportChannels(state, report.outlet);
}

export function getReportUi(state, outlet) {
  const saved = state?.reportUi?.[outlet];
  if (saved) return { ...FACTORY_REPORT_UI[outlet], ...saved };
  return { ...(FACTORY_REPORT_UI[outlet] || { physicalCashControl: true, showKasAwal: true }) };
}

export function factoryChannelsForOutlet(outlet) {
  return cloneChannels(FACTORY_REPORT_CHANNELS[outlet] || []);
}

export function factoryUiForOutlet(outlet) {
  return { ...(FACTORY_REPORT_UI[outlet] || { physicalCashControl: true, showKasAwal: true }) };
}

export function createChannelId(label, existingIds = []) {
  const base = String(label || "channel")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 24) || "channel";
  let id = base;
  let n = 2;
  const set = new Set(existingIds);
  while (set.has(id)) {
    id = `${base}_${n++}`;
  }
  return id;
}

export function groupChannels(channels) {
  const groups = [];
  const map = new Map();
  channels.forEach((ch) => {
    const g = ch.group || "";
    if (!map.has(g)) {
      const entry = { group: g, items: [] };
      map.set(g, entry);
      groups.push(entry);
    }
    map.get(g).items.push(ch);
  });
  return groups;
}

export function cashChannel(channels) {
  return (channels || []).find((c) => c.role === "cash");
}

export function channelAmounts(raw = {}) {
  const out = {};
  Object.entries(raw).forEach(([k, v]) => {
    const n = Math.max(0, +v || 0);
    if (n > 0) out[k] = n;
  });
  return out;
}

export function reportCashAmount(report, channels) {
  const chs = report?.channelDefs?.length ? report.channelDefs : channels;
  if (report.channels && cashChannel(chs)) {
    const id = cashChannel(chs).id;
    if (report.channels[id] != null) return Math.max(0, +report.channels[id] || 0);
  }
  return Math.max(0, +report.cash || 0);
}

export function reportChannelTotal(report, channels) {
  const ch = channels || [];
  if (report.channels) {
    const ids = new Set(ch.map((c) => c.id));
    const extra = Object.keys(report.channels).filter((k) => !ids.has(k));
    const fromConfig = ch.reduce((sum, c) => sum + Math.max(0, +(report.channels[c.id] || 0)), 0);
    const fromExtra = extra.reduce((sum, k) => sum + Math.max(0, +(report.channels[k] || 0)), 0);
    return fromConfig + fromExtra;
  }
  return Math.max(0, (+report.cash || 0) + (+report.qrisBca || 0) + (+report.qrisBri || 0) + (+report.gojek || 0));
}

export function legacyFieldsFromChannels(amounts, channels) {
  const pick = (ids) => ids.reduce((s, id) => s + Math.max(0, +(amounts[id] || 0)), 0);
  const cashCh = cashChannel(channels);
  return {
    cash: cashCh ? Math.max(0, +(amounts[cashCh.id] || 0)) : 0,
    qrisBca: pick(["qris_bca", "edc_bca", "tf_bca", "qris", "qris_esb", "qris_pa_bos"]),
    qrisBri: pick(["qris_bri", "edc_bri", "debit_bri", "debit", "tf_bri"]),
    gojek: pick(["gojek", "ojek_online", "online", "gofood", "grabfood", "shopefood", "grab", "shopee"]),
  };
}

/** @deprecated */
export function mergeReportChannelsState(_base, saved) {
  return hydrateReportChannels(saved);
}
