// node lib/kasirHarian.test.mjs
import {
  submitDailyReport,
  settleDailyReport,
  verifyDailyReportAdmin,
  requestDailyReportRevision,
  resubmitDailyReport,
  walletBalance,
  pendingReports,
  reportsAwaitingVerify,
  reportsReadyToSettle,
  reportHasSettleTxs,
  reportSettleUrgency,
  LACI_FLOOR,
} from "./kasirHarian.js";
import { hydrateReportChannels } from "./reportChannels.js";

const baseWallets = [
  { id: "w_laci_kbu", opening: LACI_FLOOR, floor: LACI_FLOOR },
  { id: "w_kas_besar", opening: 0, floor: 0 },
  { id: "w_bca", opening: 0, floor: 0 },
  { id: "w_bri", opening: 0, floor: 0 },
  { id: "w_nf", opening: 0, floor: 0 },
  { id: "w_gofood", opening: 0, floor: 0 },
];

const categories = [
  { id: "ci_tunai", name: "Penjualan Tunai", type: "in", active: true },
  { id: "ci_qris_bca", name: "Penjualan QRIS BCA", type: "in", active: true },
  { id: "ci_qris_bri", name: "Penjualan QRIS BRI", type: "in", active: true },
  { id: "ci_gojek", name: "Penjualan Gojek", type: "in", active: true },
];

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("✓", msg); }
  else { failed++; console.error("✗", msg); }
}

// --- submit channels: tunai masuk laci (KSM pakai channel form KBU) ---
const state1 = { wallets: [...baseWallets, { id: "w_laci_ksm", opening: LACI_FLOOR, floor: LACI_FLOOR }], categories, transactions: [], dailyReports: [], reportChannels: hydrateReportChannels(null) };
const { report: r1, txs: t1 } = submitDailyReport(state1, {
  channels: { tunai: 500000, edc_bca: 100000, gofood: 50000 },
  date: "2026-06-18",
  user: { id: "u3", name: "Kasir", outlet: "KSM" },
});
ok(t1.length === 1 && t1[0].amount === 500000 && t1[0].walletId === "w_laci_ksm", "Hanya tunai yang jadi transaksi laci");
ok(r1.total === 650000, "Total laporan benar");
ok(r1.channels?.tunai === 500000, "Channels tersimpan");

// --- physical cash: kas fisik - floor = tunai ---
const { report: rPhys } = submitDailyReport(
  { ...state1, dailyReports: [] },
  {
    channels: {},
    physicalCashEnd: 1456000,
    date: "2026-06-17",
    user: { id: "u3", name: "Kasir", outlet: "KBU" },
  }
);
ok(rPhys.cash === 1206000, "KBU-style: kas fisik − 250rb = setoran tunai");

// --- legacy API masih jalan ---
const { report: rLeg } = submitDailyReport({ ...state1, dailyReports: [] }, {
  cash: 100000, qrisBca: 50000, qrisBri: 0, gojek: 0,
  date: "2026-06-16", user: { id: "u3", name: "Kasir", outlet: "KBU" },
});
ok(rLeg.cash === 100000, "Legacy cash field");

// --- settle: perlu verifikasi admin dulu ---
const state2 = {
  wallets: [...baseWallets, { id: "w_laci_ksm", opening: LACI_FLOOR, floor: LACI_FLOOR }],
  categories,
  transactions: [...t1],
  dailyReports: [r1],
};
let noVerify = false;
try { settleDailyReport(state2, r1.id, { id: "admin" }); } catch (e) { noVerify = e.message.includes("Verifikasi"); }
ok(noVerify, "Settle ditolak sebelum verifikasi admin");

const verified = verifyDailyReportAdmin(state2, r1.id, { id: "admin" });
ok(verified.status === "admin_verified", "Admin verifikasi laporan");
const state2b = { ...state2, dailyReports: [verified] };
const { txs: t2 } = settleDailyReport(state2b, r1.id, { id: "admin" });
const laciBal = walletBalance("w_laci_ksm", state2.wallets, [...t1, ...t2]);
ok(t2.some(t => t.type === "transfer" && t.amount === 500000), "Transfer ke kas besar = nominal tunai laporan");
ok(laciBal === LACI_FLOOR, `Laci setelah settle = floor (${laciBal})`);
ok(t2.some(t => t.walletId === "w_bca" && t.amount === 100000), "QRIS BCA ke rekening BCA");
ok(t2.some(t => t.walletId === "w_gofood" && t.amount === 50000), "Gofood ke dompet Go Food");

// --- settle harus urut tanggal ---
const rOld = { ...r1, id: "dr_old", date: "2026-06-17", status: "admin_verified" };
const rNew = { ...r1, id: "dr_new", date: "2026-06-18", status: "admin_verified" };
const state3 = { wallets: baseWallets, categories, transactions: [], dailyReports: [rOld, rNew] };
let threw = false;
try { settleDailyReport(state3, rNew.id, {}); } catch (e) { threw = e.message.includes("dulu"); }
ok(threw, "Tidak boleh settle laporan baru sebelum yang lama");

// --- revisi: admin minta perbaiki, kasir kirim ulang ---
const rev = requestDailyReportRevision(state2, r1.id, { id: "admin", role: "admin" }, "Selisih tunai Rp 50rb");
ok(rev.status === "revision_requested" && rev.revisionNote.includes("50rb"), "Admin minta revisi");
const stateRev = { ...state2, dailyReports: [rev] };
const { report: rResub, txs: tResub, removeIds } = resubmitDailyReport(stateRev, r1.id, {
  channels: { tunai: 550000, edc_bca: 100000, gofood: 50000 },
  date: "2026-06-18",
  user: { id: "u3", name: "Kasir", outlet: "KSM" },
});
ok(rResub.status === "submitted" && rResub.total === 700000, "Kasir kirim revisi");
ok(tResub.length === 1 && tResub[0].amount === 550000, "Transaksi tunai laci diperbarui");
ok(removeIds.length === 1, "Transaksi tunai lama dihapus");

// --- pendingReports: submitted + admin_verified ---
ok(reportsAwaitingVerify([r1], []).length === 1, "Submitted menunggu verifikasi");
ok(reportsReadyToSettle([verified], []).length === 1, "Admin verified siap settle");
ok(reportSettleUrgency({ date: "2020-01-01", status: "submitted" }) === "overdue", "Laporan lama overdue");

// --- pendingReports: jangan double jika sudah settled (outlet+tanggal sama) ---
const dupPending = pendingReports([
  { id: "dr_a", outlet: "KBU", date: "2026-06-18", status: "settled" },
  { id: "dr_b", outlet: "KBU", date: "2026-06-18", status: "submitted" },
  { id: "dr_c", outlet: "KSM", date: "2026-06-18", status: "submitted" },
], []);
ok(dupPending.length === 1 && dupPending[0].outlet === "KSM", "Submitted duplikat disembunyikan jika outlet+tanggal sudah settled");

// --- pendingReports: sembunyikan jika transaksi settle sudah ada (ghost submitted) ---
const ghostTxs = [{ id: "t1", type: "transfer", amount: 500000, dailyReportId: "dr_ghost", source: "Settle Admin NF3" }];
const ghostPending = pendingReports([
  { id: "dr_ghost", outlet: "KBU", date: "2026-06-19", status: "submitted" },
], ghostTxs);
ok(ghostPending.length === 0, "Submitted disembunyikan jika sudah ada tx settle");
ok(reportHasSettleTxs("dr_ghost", ghostTxs), "reportHasSettleTxs mendeteksi settle");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
