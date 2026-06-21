// node lib/appState.dailyReports.test.mjs
import { mergeAppStateData, pickNewerDailyReport } from "./appState.js";

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("✓", msg); }
  else { failed++; console.error("✗", msg); }
}

const settled = {
  id: "dr1",
  outlet: "KBU",
  date: "2026-06-18",
  status: "settled",
  settledAt: "2026-06-19T10:00:00Z",
  total: 1000000,
};
const submitted = {
  id: "dr1",
  outlet: "KBU",
  date: "2026-06-18",
  status: "submitted",
  submittedAt: "2026-06-18T20:00:00Z",
  total: 1000000,
};

ok(pickNewerDailyReport(submitted, settled).status === "settled", "pickNewerDailyReport: settled menang (id sama)");

const merged = mergeAppStateData(
  { dailyReports: [submitted], transactions: [] },
  { dailyReports: [settled], transactions: [] }
);
ok(merged.dailyReports.length === 1 && merged.dailyReports[0].status === "settled", "mergeAppStateData: owner settle tidak ditimpa submitted cloud (id sama)");

const settledOld = {
  id: "dr_settled",
  outlet: "KBU",
  date: "2026-06-21",
  status: "settled",
  settledAt: "2026-06-21T08:00:00Z",
  total: 500000,
};
const submittedNew = {
  id: "dr_new",
  outlet: "KBU",
  date: "2026-06-21",
  status: "submitted",
  submittedAt: "2026-06-21T14:00:00Z",
  total: 3200000,
};
ok(
  pickNewerDailyReport(settledOld, submittedNew).id === "dr_new",
  "pickNewerDailyReport: laporan baru setelah settle menang (KBU same day)"
);

const mergedDupDay = mergeAppStateData(
  { dailyReports: [settledOld], transactions: [] },
  { dailyReports: [submittedNew], transactions: [] }
);
ok(
  mergedDupDay.dailyReports.length === 1 && mergedDupDay.dailyReports[0].id === "dr_new",
  "mergeAppStateData: laporan KBU aktif tidak hilang saat ada settled lama hari sama"
);

const adminVerified = {
  id: "dr2",
  outlet: "KSM",
  date: "2026-06-20",
  status: "admin_verified",
  adminVerifiedAt: "2026-06-20T09:00:00Z",
  total: 2000000,
};
const submittedStale = {
  id: "dr2",
  outlet: "KSM",
  date: "2026-06-20",
  status: "submitted",
  submittedAt: "2026-06-20T07:00:00Z",
  total: 2000000,
};
ok(
  pickNewerDailyReport(submittedStale, adminVerified).status === "admin_verified",
  "pickNewerDailyReport: admin_verified menang atas submitted stale"
);

const purchasingRemote = {
  transactions: [{ id: "t1", type: "out", amount: 0, module: "purchasing", outlet: "KBU" }],
};
const purchasingLocal = {
  transactions: [{
    id: "t1",
    type: "out",
    amount: 220000,
    module: "purchasing",
    outlet: "KBU",
    meta: { items: [{ name: "Ayam" }] },
  }],
};
const mergedTx = mergeAppStateData(purchasingRemote, purchasingLocal);
ok(
  mergedTx.transactions[0].amount === 220000 && mergedTx.transactions[0].module === "purchasing",
  "mergeTransactions: purchasing KBU tidak jadi 0 saat cloud stale"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
