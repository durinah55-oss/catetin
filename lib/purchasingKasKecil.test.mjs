import test from "node:test";
import assert from "node:assert/strict";
import { kasKecilDaySummary } from "./purchasingKasKecil.js";

const wallets = [{ id: "w_kas_kecil", opening: 0, active: true }];

test("kasKecilDaySummary matches manual purchasing math", () => {
  const txs = [
    { id: "t1", type: "transfer", date: "2026-06-22", amount: 1400000, fromWalletId: "w_kas_besar", toWalletId: "w_kas_kecil", source: "Manual" },
    { id: "t2", type: "out", date: "2026-06-22", amount: 500000, walletId: "w_kas_kecil", module: "purchasing", source: "purchasing:manual" },
    { id: "t3", type: "transfer", date: "2026-06-23", amount: 800000, fromWalletId: "w_kas_besar", toWalletId: "w_kas_kecil", source: "Manual" },
    { id: "t4", type: "transfer", date: "2026-06-23", amount: 1400000, fromWalletId: "w_kas_besar", toWalletId: "w_kas_kecil", source: "Manual" },
    { id: "t5", type: "out", date: "2026-06-23", amount: 1956205, walletId: "w_kas_kecil", module: "purchasing", source: "purchasing:manual" },
  ];
  const s = kasKecilDaySummary(wallets, txs, "2026-06-23");
  assert.equal(s.opening, 900000);
  assert.equal(s.transfersIn, 2200000);
  assert.equal(s.belanjaOut, 1956205);
  assert.equal(s.closing, 1143795);
  assert.equal(s.ledger, s.closing);
});
