// node lib/appState.destructiveSave.test.mjs
import { isDestructiveSave, countAppStateRecords } from "./appState.js";

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("✓", msg); }
  else { failed++; console.error("✗", msg); }
}

const counts = countAppStateRecords({ transactions: [{ id: "1" }], dailyReports: [] });
ok(counts.transactions === 1, "count transactions");

const remote100 = { transactions: Array.from({ length: 100 }, (_, i) => ({ id: `t${i}` })), dailyReports: [] };
const local1 = { transactions: [{ id: "t1" }], dailyReports: [] };
ok(isDestructiveSave(remote100, local1).blocked === true, "blocks large tx drop");

const remote1 = { transactions: [{ id: "a" }], dailyReports: [] };
const local2 = { transactions: [{ id: "a" }, { id: "b" }], dailyReports: [] };
ok(isDestructiveSave(remote1, local2).blocked === false, "allows append");

ok(isDestructiveSave({ transactions: [], dailyReports: [] }, local2).blocked === false, "allows new business");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
