import {
  calcSdmCost,
  calcSdmRatio,
  calcDailyOmsetTarget,
  sdmStatus,
  buildSdmSnapshot,
  submitSdmReport,
  minOmsetForRatio,
  parseHeadcountInput,
  formatTargetFormula,
} from "./sdmHarian.js";

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.error(`✗ ${name}`); }
}

ok("Parse headcount tunggal", parseHeadcountInput("10") === 10);
ok("Parse headcount range", parseHeadcountInput("9-13") === 11);
ok("Parse headcount range KSM", parseHeadcountInput("5-6") === 6);
const wage = 69230.768;
ok("Biaya SDM 5 orang", calcSdmCost(5, wage) === 346154);

const target5 = calcDailyOmsetTarget(5, { KBU: { omsetPerPerson: 500000 } }, "KBU");
ok("Target 5 SDM = 2,5jt", target5 === 2500000);

const ratio = calcSdmRatio(346153.84, target5);
ok("Rasio 13,84%", Math.abs(ratio - 13.8461536) < 0.01);

ok("Status AMAN (<14%)", sdmStatus(ratio).label === "AMAN");
ok("Status SEHAT", sdmStatus(16).label === "SEHAT");
ok("Status WARNING", sdmStatus(19).label === "WARNING");
ok("Status BAHAYA", sdmStatus(21).label === "BAHAYA");

const snap = buildSdmSnapshot({ headcount: 5, dailyWage: wage, targetOmset: target5, omsetPerPerson: 500000, outlet: "KBU" });
ok("Snapshot ratio label", snap.ratioLabel.startsWith("13,8"));

ok("Min omset AMAN", minOmsetForRatio(350000, 14) === 2500000);

ok("Format target", formatTargetFormula(10, 500000).includes("10 SDM"));

const state = { outletConfig: { KBU: { omsetPerPerson: 500000, dailyWage: 70000 } }, sdmReports: [] };
const { report } = submitSdmReport(state, {
  headcount: 10,
  date: "2026-06-19",
  user: { id: "u1", name: "Kasir", outlet: "KBU" },
});
ok("Submit SDM 10 orang", report.headcount === 10 && report.sdmCost === 700000);
ok("Target 10 × 500rb", report.targetOmset === 5000000);
ok("Rasio 10 org vs 5jt target = 14%", Math.abs(report.ratio - 14) < 0.01);
ok("Status AMAN di 14%", report.statusLabel === "AMAN");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
