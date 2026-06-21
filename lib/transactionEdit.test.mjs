import test from "node:test";
import assert from "node:assert/strict";
import {
  getTransactionEditPolicy,
  validateTransactionUpdate,
} from "./transactionEdit.js";
import { walletBalance } from "./kasirHarian.js";

test("settle tx locked from edit", () => {
  const p = getTransactionEditPolicy({
    id: "t1",
    dailyReportId: "dr1",
    source: "Settle Admin NF3",
    type: "in",
    amount: 100000,
  });
  assert.equal(p.canEdit, false);
  assert.equal(p.canDelete, false);
});

test("manual transfer editable", () => {
  const p = getTransactionEditPolicy({
    id: "t2",
    source: "Manual",
    type: "transfer",
    amount: 2000000,
  });
  assert.equal(p.canEdit, true);
  assert.equal(p.canDelete, true);
});

test("delete transfer restores kas kecil balance in simulation", () => {
  const wallets = [
    { id: "w_kas_besar", opening: 0, floor: 0 },
    { id: "w_kas_kecil", opening: 0, floor: 0 },
  ];
  const transfer = {
    id: "t_trf",
    type: "transfer",
    amount: 2000000,
    fromWalletId: "w_kas_besar",
    toWalletId: "w_kas_kecil",
    date: "2026-06-21",
    source: "Manual",
  };
  const txs = [transfer];
  const without = txs.filter((t) => t.id !== "t_trf");
  assert.equal(walletBalance("w_kas_kecil", wallets, txs), 2000000);
  assert.equal(walletBalance("w_kas_kecil", wallets, without), 0);
});

test("validate transfer rejects insufficient from wallet", () => {
  const wallets = [
    { id: "w_a", opening: 100000, floor: 0 },
    { id: "w_b", opening: 0, floor: 0 },
  ];
  const existing = {
    id: "t1",
    type: "transfer",
    amount: 50000,
    fromWalletId: "w_a",
    toWalletId: "w_b",
    date: "2026-06-21",
  };
  const err = validateTransactionUpdate(
    existing,
    { amount: 500000 },
    { wallets, transactions: [existing] }
  );
  assert.ok(err);
});
