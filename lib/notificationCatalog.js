// lib/notificationCatalog.js — jenis notifikasi otomatis NF3 + preferensi bisnis

function legacyRevisionTitle(msg) {
  return /^⚠\s*Revisi laporan omset/i.test(String(msg?.title || ""));
}

function revisionDateFromMsg(msg) {
  if (msg?.meta?.reportDate) return msg.meta.reportDate;
  const t = String(msg?.title || "");
  const m = t.match(/·\s*(\d{1,2})\s+(\w+)/);
  if (!m) return null;
  const months = { jan: 1, feb: 2, mar: 3, apr: 4, mei: 5, jun: 6, jul: 7, agu: 8, sep: 9, okt: 10, nov: 11, des: 12 };
  const mon = months[m[2].slice(0, 3).toLowerCase()];
  if (!mon) return null;
  const year = new Date().getFullYear();
  return `${year}-${String(mon).padStart(2, "0")}-${String(m[1]).padStart(2, "0")}`;
}

/** Daftar notifikasi otomatis yang bisa diaktif/nonaktifkan admin. */
export const NOTIFICATION_CATALOG = [
  {
    id: "revision_request",
    label: "Revisi laporan omset",
    description: "Admin minta kasir perbaiki laporan harian — tap buka form revisi",
    recipients: "Kasir outlet",
    defaultEnabled: true,
  },
  {
    id: "purchasing_fund",
    label: "Dana masuk Kas Kecil",
    description: "Admin Keuangan transfer ke dompet belanja purchasing",
    recipients: "Purchasing",
    defaultEnabled: true,
  },
  {
    id: "sosmed_reminder",
    label: "Pengingat Report Sosmed",
    description: "Pengingat isi laporan sosmed harian (DM, review, komplain)",
    recipients: "Kasir / admin outlet",
    defaultEnabled: true,
  },
  {
    id: "sdm_reminder",
    label: "Pengingat SDM pagi",
    description: "Pengingat jumlah staf masuk & target omset pagi",
    recipients: "Kasir outlet",
    defaultEnabled: true,
  },
  {
    id: "daily_report_submitted",
    label: "Laporan omset baru",
    description: "Kasir kirim / kirim ulang laporan omset — perlu verifikasi",
    recipients: "Admin Keuangan",
    defaultEnabled: true,
  },
  {
    id: "void_pending",
    label: "Void menunggu review",
    description: "Kasir ajukan void/cancel — perlu review admin",
    recipients: "Admin Keuangan",
    defaultEnabled: true,
  },
  {
    id: "daily_report_verified",
    label: "Laporan omset diverifikasi",
    description: "Admin sudah verifikasi fisik — kasir bisa cek status",
    recipients: "Kasir outlet",
    defaultEnabled: true,
  },
];

export function defaultNotificationPrefs() {
  const enabled = Object.fromEntries(
    NOTIFICATION_CATALOG.map((c) => [c.id, c.defaultEnabled !== false])
  );
  return {
    ...enabled,
    sosmedReminderHour: 20,
    sdmReminderHour: 10,
  };
}

export function hydrateNotificationPrefs(saved) {
  const base = defaultNotificationPrefs();
  if (!saved || typeof saved !== "object") return base;
  const out = { ...base };
  for (const c of NOTIFICATION_CATALOG) {
    if (saved[c.id] != null) out[c.id] = saved[c.id] !== false;
  }
  if (saved.sosmedReminderHour != null) out.sosmedReminderHour = Math.min(23, Math.max(12, +saved.sosmedReminderHour || 20));
  if (saved.sdmReminderHour != null) out.sdmReminderHour = Math.min(14, Math.max(6, +saved.sdmReminderHour || 10));
  return out;
}

export function isNotificationEnabled(prefs, kind) {
  if (!kind || kind === "broadcast") return true;
  return hydrateNotificationPrefs(prefs)[kind] !== false;
}

export function getMessageKind(msg) {
  if (msg?.kind) return msg.kind;
  if (legacyRevisionTitle(msg)) return "revision_request";
  return "broadcast";
}

export function hasStaffMessageDedupe(messages, dedupeKey) {
  if (!dedupeKey) return false;
  return (messages || []).some((m) => m.meta?.dedupeKey === dedupeKey);
}

/** Aksi tap dari layar Pengumuman — null jika hanya tandai dibaca. */
export function getStaffMessageAction(msg, user) {
  const kind = getMessageKind(msg);
  switch (kind) {
    case "revision_request":
      return {
        type: "laporanHarian",
        date: revisionDateFromMsg(msg),
        label: "Buka form revisi →",
        urgent: true,
      };
    case "purchasing_fund":
      if ((user?.role || "") !== "purchasing") return null;
      return { type: "catatBelanja", label: "Catat belanja / cek saldo →", urgent: true };
    case "sosmed_reminder":
      return { type: "sosmedHarian", label: "Isi Report Sosmed hari ini →", urgent: true };
    case "sdm_reminder":
      return { type: "sdmHarian", label: "Isi SDM Pagi →", urgent: true };
    case "daily_report_submitted":
      if (!["admin", "owner"].includes(user?.role || "")) return null;
      return { type: "settleLaporan", label: "Verifikasi / settle laporan →", urgent: true };
    case "void_pending":
      if (!["admin", "owner"].includes(user?.role || "")) return null;
      return { type: "voidReview", label: "Review void kasir →", urgent: true };
    case "daily_report_verified":
      return {
        type: "laporanHarian",
        date: msg.meta?.reportDate || null,
        label: "Lihat laporan omset →",
        urgent: false,
      };
    default:
      return null;
  }
}

/** Notif operasional yang sudah selesai (laporan settled, dll.) — jangan tampil sebagai spam. */
export function isStaffMessageStale(msg, dailyReports) {
  const kind = getMessageKind(msg);
  const reports = dailyReports || [];
  const reportId = msg.meta?.dailyReportId;
  const outlet = msg.meta?.outlet;
  const reportDate = msg.meta?.reportDate;

  const findReport = () => {
    if (reportId) return reports.find((r) => r.id === reportId);
    if (outlet && reportDate) return reports.find((r) => r.outlet === outlet && r.date === reportDate);
    return null;
  };
  const rep = findReport();

  if (kind === "daily_report_submitted") {
    if (msg.meta?.fulfilledAt) return true;
    if (rep?.status === "settled") return true;
    if (rep?.status === "admin_verified") return true;
    return false;
  }
  if (kind === "revision_request") {
    if (!rep) return false;
    return rep.status !== "revision_requested";
  }
  if (kind === "daily_report_verified") {
    if (rep?.status === "settled" || rep?.status === "admin_verified") return true;
  }
  if (kind === "daily_report_settled") {
    return true;
  }
  if (kind === "void_pending") return false;
  return false;
}

export function isActionableStaffMessage(msg, user, dailyReports) {
  if (isStaffMessageStale(msg, dailyReports)) return false;
  return !!getStaffMessageAction(msg, user);
}

/** Buang notif operasional yang sudah tidak relevan — cegah spam balik dari merge HP lama. */
export function pruneStaleStaffMessages(messages, dailyReports) {
  return (messages || []).filter((m) => {
    const kind = getMessageKind(m);
    if (kind === "broadcast") return true;
    return !isStaffMessageStale(m, dailyReports);
  });
}

export function notificationKindLabel(kind) {
  return NOTIFICATION_CATALOG.find((c) => c.id === kind)?.label || "Pengumuman";
}
