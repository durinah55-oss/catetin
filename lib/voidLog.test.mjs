import { submitVoidLog, pendingVoidLogs, reviewVoidLog, visibleVoidLogs } from "./voidLog.js";

let pass = 0;
let fail = 0;
function ok(name, cond) {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.error(`✗ ${name}`); }
}

const user = { id: "u1", name: "Ayu", role: "kasir", outlet: "KBU" };
const state = { voidLogs: [] };

const { entry: cancel } = submitVoidLog(state, {
  type: "cancel",
  date: "2026-06-17",
  txnNo: "SKBU028169326110",
  customerName: "Vivi",
  reason: "ganti cash ke qris",
  amount: 133000,
  voidedBy: "Ayu",
}, user);
ok("Void cancel", cancel.type === "cancel" && cancel.amount === 133000 && cancel.customerName === "Vivi");

const { entry: repl } = submitVoidLog(state, {
  type: "replacement",
  date: "2026-06-16",
  txnNo: "SKBU028169326110",
  txnNoNew: "SKBU02202606160015",
  reason: "ganti cash ke qris",
  amount: 133000,
  voidedBy: "Ayu",
}, user);
ok("Transaksi baru", repl.txnNoNew === "SKBU02202606160015");

const st2 = { voidLogs: [cancel, repl] };
ok("Pending 2", pendingVoidLogs(st2.voidLogs).length === 2);

const { entry: reviewed } = reviewVoidLog(st2, cancel.id, { id: "admin", name: "Admin" });
ok("Reviewed", reviewed.status === "reviewed");

ok("Kasir lihat outlet sendiri", visibleVoidLogs(st2.voidLogs, user).length === 2);
ok("Admin lihat semua", visibleVoidLogs(st2.voidLogs, { role: "admin" }).length === 2);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
