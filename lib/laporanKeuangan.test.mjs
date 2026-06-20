import {
  getPeriodBounds,
  shiftAnchor,
  filterTransactions,
  buildCashflowChart,
  sumInOut,
  formatPeriodLabel,
  localISO,
} from "./laporanKeuangan.js";

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.error(`✗ ${name}`); }
}

const txs = [
  { id: "1", type: "in", amount: 100000, date: "2026-06-17", walletId: "w1", categoryId: "c1" },
  { id: "2", type: "out", amount: 30000, date: "2026-06-17", walletId: "w1", categoryId: "c2" },
  { id: "3", type: "in", amount: 50000, date: "2026-06-16", walletId: "w1", categoryId: "c1" },
  { id: "4", type: "in", amount: 200000, date: "2026-06-01", walletId: "w1", categoryId: "c1" },
  { id: "5", type: "transfer", amount: 100000, date: "2026-06-17", fromWalletId: "w1", toWalletId: "w2" },
];

const dayBounds = getPeriodBounds("Harian", "2026-06-17");
ok("Harian satu hari", dayBounds.start === "2026-06-17" && dayBounds.end === "2026-06-17");

const week = getPeriodBounds("Mingguan", "2026-06-17"); // Rabu
ok("Mingguan Sen–Min", week.start === "2026-06-15" && week.end === "2026-06-21");

const month = getPeriodBounds("Bulanan", "2026-06-17");
ok("Bulanan Juni", month.start === "2026-06-01" && month.end === "2026-06-30");

const custom = getPeriodBounds("Custom", "2026-06-17", { customStart: "2026-06-15", customEnd: "2026-06-18" });
ok("Custom range", custom.start === "2026-06-15" && custom.end === "2026-06-18");

const filtered = filterTransactions(txs, { start: "2026-06-16", end: "2026-06-17", walletId: "all" });
ok("Filter tanggal", filtered.length === 3 && !filtered.some((t) => t.type === "transfer"));

const { inSum, outSum } = sumInOut(filtered);
ok("Sum in/out", inSum === 150000 && outSum === 30000);

const chart = buildCashflowChart(txs, "2026-06-16", "2026-06-17");
ok("Chart 2 hari", chart.length === 2 && chart[1].in === 100000);

ok("Shift harian", shiftAnchor("Harian", "2026-06-17", -1) === "2026-06-16");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
