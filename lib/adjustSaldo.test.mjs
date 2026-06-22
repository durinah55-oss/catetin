// node lib/adjustSaldo.test.mjs
import { applyBalanceAdjustment, computeBalanceAdjustment } from "./adjustSaldo.js";
import { walletBalance } from "./kasirHarian.js";

const categories = [
  { id: "c_adj_in", name: "Penyesuaian masuk", type: "in", active: true },
  { id: "c_adj_out", name: "Penyesuaian keluar", type: "out", active: true },
];

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("✓", msg); }
  else { failed++; console.error("✗", msg); }
}

const wallets = [{ id: "w_laci_kbu", opening: 250000, floor: 250000 }];
const txs = [
  { id: "t1", type: "in", amount: 4015000, walletId: "w_laci_kbu", date: "2026-06-21", source: "Laporan harian" },
  { id: "t2", type: "in", amount: 4015000, walletId: "w_laci_kbu", date: "2026-06-21", source: "Laporan harian" },
];
const state = { wallets, transactions: [...txs], categories };
const before = walletBalance("w_laci_kbu", wallets, txs);
ok(before === 8275000, "Saldo awal tes duplikat");

const r = applyBalanceAdjustment(state, {
  walletId: "w_laci_kbu",
  targetNum: 4265000,
  categories,
  date: "2026-06-22",
  userRole: "owner",
});
const after = walletBalance("w_laci_kbu", state.wallets, state.transactions);
ok(after === 4265000, "Saldo persis sesuai target owner");
ok(r.after === 4265000 && r.before === before, "Return before/after benar");

let blocked = false;
try {
  applyBalanceAdjustment(
    { wallets, transactions: [...state.transactions], categories },
    { walletId: "w_laci_kbu", targetNum: 100000, categories, userRole: "kasir" }
  );
} catch (e) {
  blocked = e.message.includes("floor");
}
ok(blocked, "Kasir tidak bisa set di bawah floor");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
