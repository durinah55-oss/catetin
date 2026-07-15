import test from "node:test";
import assert from "node:assert/strict";
import {
  canWriteSharedBank,
  resolveSharedLinkFromWalletId,
  buildSourceTransaction,
  appendTransactionToDoc,
} from "./sharedBankWrite.js";

const link = {
  id: "sh_nf_bca",
  enabled: true,
  linkKind: "rekening",
  sourceBusinessId: "fnb-1",
  sourceWalletId: "w_bca",
  sourceWalletName: "BCA",
  sourceWalletType: "rekening",
};

test("canWriteSharedBank: owner admin purchasing saja", () => {
  assert.equal(canWriteSharedBank("owner"), true);
  assert.equal(canWriteSharedBank("admin"), true);
  assert.equal(canWriteSharedBank("purchasing"), true);
  assert.equal(canWriteSharedBank("kasir"), false);
});

test("resolveSharedLinkFromWalletId", () => {
  assert.equal(resolveSharedLinkFromWalletId("shared_sh_nf_bca", [link])?.sourceWalletId, "w_bca");
  assert.equal(resolveSharedLinkFromWalletId("w_fish_dana", [link]), null);
});

test("buildSourceTransaction maps wallet to source", () => {
  const tx = buildSourceTransaction({
    draft: { type: "out", amount: 150000, desc: "Kulakan", categoryId: "ec_out1", date: "2026-07-08" },
    sourceWalletId: "w_bca",
    fromBusinessId: "fish-1",
    fromBusinessName: "NF Nusa Fishing",
    user: { id: "u1", name: "Purchasing", role: "purchasing" },
    txId: "t_shared_1",
  });
  assert.equal(tx.walletId, "w_bca");
  assert.equal(tx.type, "out");
  assert.equal(tx.amount, 150000);
  assert.equal(tx.meta.sharedWriteThrough, true);
  assert.equal(tx.meta.fromBusinessId, "fish-1");
});

test("appendTransactionToDoc idempotent", () => {
  const tx = { id: "t1", type: "out", amount: 1, walletId: "w_bca" };
  const a = appendTransactionToDoc({ transactions: [] }, tx);
  assert.equal(a.appended, true);
  assert.equal(a.doc.transactions.length, 1);
  const b = appendTransactionToDoc(a.doc, tx);
  assert.equal(b.appended, false);
  assert.equal(b.doc.transactions.length, 1);
});
