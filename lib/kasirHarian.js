// lib/kasirHarian.js — laporan omset harian kasir & settle Admin NF3

import {
  getReportChannels,
  getSettleChannels,
  reportCashAmount,
  reportChannelTotal,
  legacyFieldsFromChannels,
  cashChannel,
  channelAmounts,
  snapshotChannelDefs,
} from "./reportChannels.js";
import { todayLocal } from "./laporanKeuangan.js";
import { isRevisionRequestMessage, revisionStillPending } from "./staffMessages.js";
import { resolveWalletId, resolveTransferIds } from "./transactionNormalize.js";

export const LACI_BY_OUTLET = { KBU: "w_laci_kbu", KSM: "w_laci_ksm", SMT: "w_laci_smt" };
export const LACI_FLOOR = 250000;

function findCat(categories, hint, type = "in") {
  return (categories || []).find(
    (c) => c.type === type && c.active !== false && c.name.toLowerCase().includes(hint.toLowerCase())
  );
}

export function walletBalance(walletId, wallets, transactions) {
  const w = (wallets || []).find((x) => x.id === walletId);
  if (!w) return 0;
  const txs = (transactions || []).filter((t) => {
    if (t.type === "transfer") {
      const { from, to } = resolveTransferIds(t);
      return from === walletId || to === walletId;
    }
    return resolveWalletId(t) === walletId;
  });
  return (w.opening || 0) + txs.reduce((a, t) => {
    if (t.type === "transfer") {
      const { to } = resolveTransferIds(t);
      return a + (to === walletId ? t.amount : -t.amount);
    }
    return a + (t.type === "in" ? t.amount : -t.amount);
  }, 0);
}

/** Batas settle: esok hari jam 17:00 setelah tanggal laporan. */
export function reportSettleDeadlineIso(dateStr) {
  const [y, m, d] = (dateStr || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d + 1, 17, 0, 0, 0).toISOString();
}

export function reportSettleDeadlineLabel(dateStr) {
  const iso = reportSettleDeadlineIso(dateStr);
  if (!iso) return "";
  const dt = new Date(iso);
  return dt.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" }) + " · 17:00";
}

/** overdue | urgent | ok */
export function reportSettleUrgency(report) {
  if (!report || report.status === "settled") return null;
  const iso = reportSettleDeadlineIso(report.date);
  if (!iso) return null;
  const deadline = new Date(iso);
  const now = new Date();
  if (now > deadline) return "overdue";
  if (deadline - now < 24 * 3600000) return "urgent";
  return "ok";
}

function computeReportPayload(state, payload) {
  const { date, user, physicalCashEnd } = payload;
  const outlet = user?.outlet;
  const walletId = LACI_BY_OUTLET[outlet];
  if (!walletId) throw new Error("Outlet kasir tidak valid.");

  const channels = getReportChannels(state, outlet);
  const cashCh = cashChannel(channels);
  if (!cashCh) throw new Error("Channel tunai belum dikonfigurasi untuk outlet ini.");

  const laciWallet = (state.wallets || []).find((w) => w.id === walletId);
  const floor = laciWallet?.floor ?? LACI_FLOOR;

  let amounts = channelAmounts(payload.channels || {});

  if (!Object.keys(amounts).length && (payload.cash != null || payload.qrisBca != null)) {
    amounts = channelAmounts({
      tunai: payload.cash,
      qris_bca: payload.qrisBca,
      qris_bri: payload.qrisBri,
      gojek: payload.gojek,
    });
  }

  const physical = Math.max(0, +physicalCashEnd || 0);
  if (physical > 0) {
    amounts[cashCh.id] = Math.max(0, physical - floor);
  }

  const cashAmt = Math.max(0, +(amounts[cashCh.id] || 0));
  const channelEntries = channels.filter((c) => c.role !== "cash");
  const nonCashTotal = channelEntries.reduce((s, c) => s + Math.max(0, +(amounts[c.id] || 0)), 0);
  const total = cashAmt + nonCashTotal;

  if (total <= 0 && physical <= 0) throw new Error("Isi minimal satu nominal omset atau kas fisik akhir.");

  const legacy = legacyFieldsFromChannels(amounts, channels);
  return { outlet, walletId, channels, cashCh, floor, amounts, physical, cashAmt, total, legacy, date };
}

function cashTxForReport(state, reportId, cashAmt, walletId, outlet, date, cashCh) {
  if (!(cashAmt > 0)) return null;
  const hint = cashCh.categoryHint || "tunai";
  const cat = findCat(state.categories, hint) || findCat(state.categories, "penjualan");
  return {
    id: "t" + Date.now() + "cash",
    type: "in",
    amount: cashAmt,
    categoryId: cat?.id,
    walletId,
    desc: `Omset tunai ${outlet}`,
    date,
    source: "Laporan harian",
    dailyReportId: reportId,
  };
}

/**
 * Kasir submit laporan omset.
 * - Tunai (role cash) → transaksi masuk laci outlet
 * - Channel lain → dicatat di laporan, settle Admin NF3
 * - physicalCashEnd opsional: tunai = fisik − floor (modal statis)
 */
export function submitDailyReport(state, payload) {
  const { user } = payload;
  const computed = computeReportPayload(state, payload);
  const { outlet, walletId, channels, cashCh, floor, amounts, physical, cashAmt, total, legacy, date } = computed;

  const reports = state.dailyReports || [];
  const conflict = reports.find((r) => r.outlet === outlet && r.date === date);
  if (conflict) {
    if (conflict.status === "revision_requested") {
      throw new Error("Admin minta revisi — buka laporan dan kirim ulang (bukan laporan baru).");
    }
    if (conflict.status === "settled") {
      throw new Error(`Laporan ${date} ${outlet} sudah disettle. Hubungi admin keuangan jika perlu koreksi.`);
    }
    throw new Error(`Laporan ${date} untuk ${outlet} sudah dikirim.`);
  }

  const report = {
    id: "dr" + Date.now(),
    date,
    outlet,
    kasirId: user.id,
    kasirName: user.name,
    channels: { ...amounts },
    channelDefs: snapshotChannelDefs(channels),
    physicalCashEnd: physical || null,
    laciFloor: floor,
    setoranOwner: cashAmt,
    ...legacy,
    total,
    status: "submitted",
    submittedAt: new Date().toISOString(),
  };

  const txs = [];
  const cashTx = cashTxForReport(state, report.id, cashAmt, walletId, outlet, date, cashCh);
  if (cashTx) txs.push(cashTx);

  return { report, txs };
}

/** Kasir perbaiki laporan setelah diminta revisi admin/owner. */
export function resubmitDailyReport(state, reportId, payload) {
  const reports = state.dailyReports || [];
  const report = reports.find((r) => r.id === reportId);
  if (!report) throw new Error("Laporan tidak ditemukan.");

  const hasRevisionNotice = (state.staffMessages || []).some(
    (m) => isRevisionRequestMessage(m) && m.meta?.dailyReportId === reportId
  );
  const inRevision =
    report.status === "revision_requested"
    || (hasRevisionNotice && ["submitted", "admin_verified"].includes(report.status));

  if (!inRevision) throw new Error("Laporan ini tidak dalam status revisi.");

  const { user } = payload;
  const computed = computeReportPayload(state, payload);
  const { outlet, walletId, channels, cashCh, floor, amounts, physical, cashAmt, total, legacy, date } = computed;

  if (date !== report.date || outlet !== report.outlet) {
    throw new Error("Tanggal/outlet tidak bisa diubah saat revisi.");
  }

  const updated = {
    ...report,
    channels: { ...amounts },
    channelDefs: snapshotChannelDefs(channels),
    physicalCashEnd: physical || null,
    laciFloor: floor,
    setoranOwner: cashAmt,
    ...legacy,
    total,
    status: "submitted",
    resubmittedAt: new Date().toISOString(),
    revisionNote: null,
    revisionRequestedAt: null,
    revisionRequestedBy: null,
    revisionRequestedByRole: null,
    adminVerifiedAt: null,
    adminVerifiedBy: null,
    adminVerifyNote: null,
  };

  const removeIds = (state.transactions || [])
    .filter((t) => t.dailyReportId === reportId && t.source === "Laporan harian")
    .map((t) => t.id);

  const txs = [];
  const cashTx = cashTxForReport(state, reportId, cashAmt, walletId, outlet, date, cashCh);
  if (cashTx) txs.push(cashTx);

  return { report: updated, txs, removeIds };
}

/** Admin Keuangan verifikasi fisik + nota sebelum settle. */
export function verifyDailyReportAdmin(state, reportId, adminUser, { note = "" } = {}) {
  const report = (state.dailyReports || []).find((r) => r.id === reportId);
  if (!report) throw new Error("Laporan tidak ditemukan.");
  if (report.status !== "submitted") throw new Error("Hanya laporan baru yang menunggu verifikasi.");
  return {
    ...report,
    status: "admin_verified",
    adminVerifiedAt: new Date().toISOString(),
    adminVerifiedBy: adminUser?.id,
    adminVerifyNote: (note || "").trim() || null,
  };
}

/** Admin/owner minta kasir perbaiki laporan. */
export function requestDailyReportRevision(state, reportId, user, note) {
  const trimmed = (note || "").trim();
  if (!trimmed) throw new Error("Catatan revisi wajib diisi — jelaskan selisih fisik/nota.");
  const report = (state.dailyReports || []).find((r) => r.id === reportId);
  if (!report) throw new Error("Laporan tidak ditemukan.");
  if (!["submitted", "admin_verified"].includes(report.status)) {
    throw new Error("Laporan tidak bisa direvisi dari status ini.");
  }
  return {
    ...report,
    status: "revision_requested",
    revisionNote: trimmed,
    revisionRequestedAt: new Date().toISOString(),
    revisionRequestedBy: user?.id,
    revisionRequestedByRole: user?.role || null,
    adminVerifiedAt: null,
    adminVerifiedBy: null,
    adminVerifyNote: null,
  };
}

/** Admin NF3 settle — channel non-tunai ke dompet/rekening, tunai → Kas Besar, laci tetap floor. */
export function settleDailyReport(state, reportId, adminUser) {
  const reports = state.dailyReports || [];
  const report = reports.find((r) => r.id === reportId);
  if (!report) throw new Error("Laporan tidak ditemukan atau sudah disettle.");
  if (report.status === "settled") {
    return { report, txs: [] };
  }
  if (report.status !== "admin_verified") {
    if (report.status === "submitted") {
      throw new Error("Verifikasi fisik & nota dulu (Admin Keuangan) sebelum settle.");
    }
    if (report.status === "revision_requested") {
      throw new Error("Kasir belum mengirim revisi laporan.");
    }
    throw new Error("Laporan belum siap disettle.");
  }
  if (reportHasSettleTxs(reportId, state.transactions)) {
    return {
      report: {
        ...report,
        status: "settled",
        settledAt: report.settledAt || new Date().toISOString(),
        settledBy: report.settledBy || adminUser?.id,
      },
      txs: [],
    };
  }

  const older = reports.find(
    (r) => r.outlet === report.outlet && r.status !== "settled" && r.date < report.date
  );
  if (older) throw new Error(`Selesaikan laporan ${older.date} (${older.outlet}) terlebih dulu.`);

  const outlet = report.outlet;
  const channels = getSettleChannels(state, report);
  const walletId = LACI_BY_OUTLET[outlet];
  const laciWallet = (state.wallets || []).find((w) => w.id === walletId);
  const floor = laciWallet?.floor || LACI_FLOOR;
  const settleDate = todayLocal();
  const ts = Date.now();
  const txs = [];

  const amounts = report.channels || {};
  const cashAmt = reportCashAmount(report, channels);

  // Channel non-tunai dari config outlet
  channels
    .filter((c) => c.role === "channel" && c.settleWallet)
    .forEach((ch, i) => {
      const amt = Math.max(0, +(amounts[ch.id] ?? legacyFallbackAmount(report, ch.id)));
      if (amt <= 0) return;
      const hint = ch.categoryHint || ch.label;
      const cat = findCat(state.categories, hint) || findCat(state.categories, "penjualan");
      txs.push({
        id: "t" + ts + "ch" + i,
        type: "in",
        amount: amt,
        categoryId: cat?.id,
        walletId: ch.settleWallet,
        desc: `${ch.label} ${outlet} · ${report.date}`,
        date: settleDate,
        source: "Settle Admin NF3",
        dailyReportId: report.id,
        reportChannelId: ch.id,
      });
    });

  // Laporan legacy tanpa channels — fallback hardcoded
  if (!report.channels) {
    settleLegacyNonCash(report, txs, ts, settleDate, outlet);
  }

  if (cashAmt > 0) {
    const bal = walletBalance(walletId, state.wallets, [...(state.transactions || []), ...txs]);
    if (bal - cashAmt < floor) {
      throw new Error(
        `Saldo laci ${outlet} tidak cukup. Butuh Rp ${new Intl.NumberFormat("id-ID").format(cashAmt)} di atas floor Rp ${new Intl.NumberFormat("id-ID").format(floor)}.`
      );
    }
    txs.push({
      id: "t" + ts + "trf",
      type: "transfer",
      amount: cashAmt,
      fromWalletId: walletId,
      toWalletId: "w_kas_besar",
      desc: `Setoran tunai ${outlet} · ${report.date} → Kas Besar`,
      date: settleDate,
      source: "Settle Admin NF3",
      dailyReportId: report.id,
    });
  }

  const settled = {
    ...report,
    status: "settled",
    settledAt: new Date().toISOString(),
    settledBy: adminUser?.id,
    settlement: { toKasBesar: cashAmt, laciFloor: floor, laciAfter: floor },
  };

  return { report: settled, txs };
}

function legacyFallbackAmount(report, channelId) {
  const map = {
    qris_bca: report.qrisBca,
    edc_bca: report.qrisBca,
    qris_bri: report.qrisBri,
    edc_bri: report.qrisBri,
    gojek: report.gojek,
    ojek_online: report.gojek,
    online: report.gojek,
  };
  return map[channelId] || 0;
}

function settleLegacyNonCash(report, txs, ts, settleDate, outlet) {
  const pairs = [
    [report.qrisBca, "w_bca", "qris bca"],
    [report.qrisBri, "w_bri", "qris bri"],
    [report.gojek, "w_gofood", "gojek"],
  ];
  pairs.forEach(([amt, wallet, hint], i) => {
    if (!(amt > 0)) return;
    txs.push({
      id: "t" + ts + "leg" + i,
      type: "in",
      amount: amt,
      walletId: wallet,
      desc: `${hint} ${outlet} · ${report.date}`,
      date: settleDate,
      source: "Settle Admin NF3",
      dailyReportId: report.id,
    });
  });
}

/** Apakah laporan sudah punya transaksi settle di buku (status DB bisa telat). */
export function reportHasSettleTxs(reportId, transactions) {
  if (!reportId) return false;
  return (transactions || []).some(
    (t) =>
      t.dailyReportId === reportId &&
      (t.source === "Settle Admin NF3" || /settle admin/i.test(t.source || ""))
  );
}

/** Sinkronkan status laporan dari transaksi settle yang sudah ada. */
export function reconcileDailyReports(reports, transactions) {
  return (reports || []).map((r) => {
    if (r.status === "settled") return r;
    if (!reportHasSettleTxs(r.id, transactions)) return r;
    return {
      ...r,
      status: "settled",
      settledAt: r.settledAt || new Date().toISOString(),
    };
  });
}

function openReports(reports, transactions) {
  const list = reconcileDailyReports(reports, transactions);
  const settledKeys = new Set(
    list.filter((r) => r.status === "settled").map((r) => `${r.outlet}|${r.date}`)
  );
  return list
    .filter((r) => {
      if (r.status === "settled") return false;
      if (settledKeys.has(`${r.outlet}|${r.date}`)) return false;
      if (reportHasSettleTxs(r.id, transactions)) return false;
      return true;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || (a.outlet || "").localeCompare(b.outlet || ""));
}

export function reportsAwaitingVerify(reports, transactions) {
  return openReports(reports, transactions).filter((r) => r.status === "submitted");
}

export function reportsReadyToSettle(reports, transactions) {
  return openReports(reports, transactions).filter((r) => r.status === "admin_verified");
}

export function reportsAwaitingRevision(reports, transactions) {
  return openReports(reports, transactions).filter((r) => r.status === "revision_requested");
}

/** Apakah laporan ini menunggu kasir revisi (status DB atau notif admin). */
export function reportAwaitingKasirRevision(report, staffMessages, outlet) {
  return revisionStillPending(report, staffMessages, outlet);
}

/** Laporan revisi terbaru untuk outlet kasir (bisa tanggal kemarin). */
export function findPendingRevisionReport(reports, outlet, staffMessages) {
  if (!outlet) return null;
  const pending = (reports || [])
    .filter((r) => r.outlet === outlet && revisionStillPending(r, staffMessages, outlet))
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (pending.length) return pending[0];

  const msg = (staffMessages || [])
    .filter((m) => isRevisionRequestMessage(m) && m.target?.value === outlet && !m.meta?.fulfilledAt)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0];
  if (!msg) return null;

  const rep = (reports || []).find(
    (r) =>
      r.outlet === outlet
      && r.status !== "settled"
      && (r.id === msg.meta?.dailyReportId || r.date === msg.meta?.reportDate)
  );
  return rep && revisionStillPending(rep, staffMessages, outlet) ? rep : null;
}

/** Laporan submitted + admin_verified (menunggu tindakan admin/owner). */
export function pendingReports(reports, transactions) {
  return openReports(reports, transactions).filter((r) =>
    r.status === "submitted" || r.status === "admin_verified"
  );
}

export { reportCashAmount, reportChannelTotal };
