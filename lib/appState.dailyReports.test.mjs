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

ok(pickNewerDailyReport(submitted, settled).status === "settled", "pickNewerDailyReport: settled menang");

const merged = mergeAppStateData(
  { dailyReports: [submitted], transactions: [] },
  { dailyReports: [settled], transactions: [] }
);
ok(merged.dailyReports.length === 1 && merged.dailyReports[0].status === "settled", "mergeAppStateData: owner settle tidak ditimpa submitted cloud");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
