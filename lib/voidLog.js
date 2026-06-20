// lib/voidLog.js — catatan void/cancel/koreksi transaksi kasir

import { OUTLETS } from "./sdmHarian.js";

export const VOID_TYPES = {
  cancel: { label: "Void / Cancel", short: "Cancel" },
  replacement: { label: "Transaksi Baru", short: "Koreksi" },
};

/** Kasir submit void atau koreksi transaksi. */
export function submitVoidLog(state, payload, user) {
  const outlet = user?.outlet;
  if (!outlet || !OUTLETS.includes(outlet)) {
    throw new Error("Hanya kasir outlet yang bisa input void.");
  }

  const type = payload.type === "replacement" ? "replacement" : "cancel";
  const date = payload.date;
  if (!date) throw new Error("Tanggal wajib diisi.");

  const txnNo = String(payload.txnNo || "").trim();
  if (!txnNo) throw new Error("Nomor transaksi wajib diisi.");

  const reason = String(payload.reason || "").trim();
  if (!reason) throw new Error(type === "cancel" ? "Alasan cancel wajib diisi." : "Perubahan yang dilakukan wajib diisi.");

  const amount = Math.max(0, +payload.amount || 0);
  if (amount <= 0) throw new Error("Nominal transaksi wajib diisi.");

  const voidedBy = String(payload.voidedBy || user.name || "").trim();
  if (!voidedBy) throw new Error("Orang yang ngevoid wajib diisi.");

  if (type === "replacement") {
    const txnNoNew = String(payload.txnNoNew || "").trim();
    if (!txnNoNew) throw new Error("Nomor transaksi baru wajib diisi.");
  }

  const entry = {
    id: "vl" + Date.now(),
    type,
    date,
    outlet,
    txnNo,
    txnNoNew: type === "replacement" ? String(payload.txnNoNew || "").trim() : null,
    kasirId: user.id,
    kasirName: user.name || "",
    customerName: String(payload.customerName || "").trim() || null,
    reason,
    amount,
    amountNew: type === "replacement" ? amount : null,
    voidedBy,
    status: "submitted",
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    reviewedBy: null,
  };

  return { entry };
}

export function pendingVoidLogs(logs, outlet = null) {
  return (logs || [])
    .filter((v) => v.status === "submitted" && (!outlet || v.outlet === outlet))
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
}

export function reviewVoidLog(state, voidId, reviewer) {
  const logs = state.voidLogs || [];
  const i = logs.findIndex((v) => v.id === voidId);
  if (i < 0) throw new Error("Catatan void tidak ditemukan.");
  if (logs[i].status === "reviewed") throw new Error("Sudah ditandai reviewed.");

  const updated = {
    ...logs[i],
    status: "reviewed",
    reviewedAt: new Date().toISOString(),
    reviewedBy: reviewer?.id,
    reviewedByName: reviewer?.name,
  };
  return { entry: updated, index: i };
}

/** Scope visibilitas void log per role. */
export function visibleVoidLogs(logs, user) {
  const role = user?.role || "kasir";
  const list = logs || [];
  if (role === "kasir") return list.filter((v) => v.outlet === user.outlet);
  if (role === "admin") return list;
  return [];
}

export function voidLogSummary(entry) {
  if (!entry) return "";
  if (entry.type === "replacement") {
    return `${entry.txnNo} → ${entry.txnNoNew} · ${entry.reason}`;
  }
  return `${entry.txnNo} cancel · ${entry.reason}`;
}
