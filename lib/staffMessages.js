// lib/staffMessages.js — pengumuman admin/owner ke staf (via app_state)

function shortDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function isRevisionRequestMessage(msg) {
  if (msg?.kind === "revision_request") return true;
  return /^⚠\s*Revisi laporan omset/i.test(String(msg?.title || ""));
}

export function revisionMessageReportDate(msg) {
  if (msg?.meta?.reportDate) return msg.meta.reportDate;
  const t = String(msg?.title || "");
  const m = t.match(/·\s*(\d{1,2})\s+(\w+)/);
  if (!m) return null;
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6, jul: 7, agu: 8, sep: 9, okt: 10, nov: 11, des: 12 };
  const mon = months[m[2].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  const year = new Date().getFullYear();
  const day = String(m[1]).padStart(2, "0");
  const month = String(mon).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Notifikasi ke kasir outlet saat admin minta revisi laporan omset. */
export function createRevisionRequestMessage({ report, note, author }) {
  const outlet = report?.outlet || "";
  const date = report?.date || "";
  const n = String(note || report?.revisionNote || "").trim();
  if (!outlet || !date || !n) throw new Error("Data revisi tidak lengkap.");

  const roleLabel = author?.role === "owner" ? "Owner" : "Admin Keuangan";
  return {
    id: "msg" + Date.now() + Math.random().toString(36).slice(2, 5),
    kind: "revision_request",
    title: `⚠ Revisi laporan omset ${outlet} · ${shortDate(date)}`,
    body: `${roleLabel} (${author?.name || "Admin"}) minta perbaikan:\n\n${n}\n\nBuka Laporan Omset → perbaiki data → tap Kirim revisi.`,
    createdAt: new Date().toISOString(),
    createdBy: author?.name || "Admin",
    createdById: author?.id || null,
    target: { type: "outlet", value: outlet },
    readBy: [],
    meta: { dailyReportId: report?.id || null, reportDate: date, outlet, revisionNote: n },
  };
}

/** Sinkronkan status laporan dari notif revisi — cegah status submitted menimpa permintaan admin. */
export function applyRevisionNoticesFromMessages(reports, staffMessages) {
  const msgs = (staffMessages || []).filter(isRevisionRequestMessage);
  if (!msgs.length) return reports || [];

  return (reports || []).map((r) => {
    if (!r || r.status === "settled" || r.status === "revision_requested") return r;
    const msg = msgs.find(
      (m) =>
        m.meta?.dailyReportId === r.id
        || (m.meta?.reportDate === r.date && m.meta?.outlet === r.outlet)
    );
    if (!msg || !["submitted", "admin_verified"].includes(r.status)) return r;
    const note = msg.meta?.revisionNote || r.revisionNote || "Perbaiki sesuai catatan admin";
    return {
      ...r,
      status: "revision_requested",
      revisionNote: note,
      revisionRequestedAt: r.revisionRequestedAt || msg.createdAt,
      revisionRequestedByRole: r.revisionRequestedByRole || "admin",
      adminVerifiedAt: null,
      adminVerifiedBy: null,
      adminVerifyNote: null,
    };
  });
}

export function markRevisionMessagesRead(messages, dailyReportId, userId) {
  if (!dailyReportId || !userId) return messages;
  return (messages || []).map((m) => {
    if (!isRevisionRequestMessage(m) || m.meta?.dailyReportId !== dailyReportId) return m;
    const readBy = new Set(m.readBy || []);
    readBy.add(userId);
    return { ...m, readBy: [...readBy] };
  });
}

export function createStaffMessage({ title, body, targetType = "all", targetValue = null, author }) {
  const t = String(title || "").trim();
  const b = String(body || "").trim();
  if (!t || !b) throw new Error("Judul dan isi pengumuman wajib diisi.");

  return {
    id: "msg" + Date.now() + Math.random().toString(36).slice(2, 5),
    title: t,
    body: b,
    createdAt: new Date().toISOString(),
    createdBy: author?.name || "Admin",
    createdById: author?.id || null,
    target: { type: targetType, value: targetValue || null },
    readBy: [],
  };
}

/** Apakah pesan ditujukan ke user ini? */
export function messageForUser(msg, user) {
  if (!msg?.target) return true;
  const { type, value } = msg.target;
  if (type === "all" || !type) return true;
  if (type === "role") return (user?.role || "") === value;
  if (type === "outlet") return (user?.outlet || "") === value;
  return false;
}

export function visibleStaffMessages(messages, user) {
  return (messages || [])
    .filter(m => messageForUser(m, user))
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export function unreadStaffCount(messages, user) {
  const uid = user?.id;
  if (!uid) return 0;
  return visibleStaffMessages(messages, user).filter(m => !(m.readBy || []).includes(uid)).length;
}

export function markStaffMessageRead(messages, messageId, userId) {
  const list = [...(messages || [])];
  const i = list.findIndex(m => m.id === messageId);
  if (i < 0) return list;
  const readBy = new Set(list[i].readBy || []);
  if (userId) readBy.add(userId);
  list[i] = { ...list[i], readBy: [...readBy] };
  return list;
}

export function formatMessageTime(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
