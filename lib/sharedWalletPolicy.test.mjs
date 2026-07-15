import test from "node:test";
import assert from "node:assert/strict";
import {
  isCrossBusinessShareableWallet,
  isFnBCashWallet,
  filterShareableRemoteWallets,
  sanitizeSharedLinks,
} from "./sharedWalletPolicy.js";

test("only rekening bank is shareable cross-business", () => {
  assert.equal(isCrossBusinessShareableWallet({ id: "w_bca", type: "rekening", active: true }), true);
  assert.equal(isCrossBusinessShareableWallet({ id: "w_bank", type: "rekening", active: true }), true);
  assert.equal(isCrossBusinessShareableWallet({ id: "w_kas_besar", type: "kas_fisik", active: true }), false);
  assert.equal(isCrossBusinessShareableWallet({ id: "w_kas_kecil", type: "kas_fisik", active: true }), false);
  assert.equal(isCrossBusinessShareableWallet({ id: "w_shopeepay", type: "ewallet", active: true }), false);
  assert.equal(isFnBCashWallet({ id: "w_kas_besar", name: "NF Cash (Kas Besar)", type: "kas_fisik" }), true);
});

test("filterShareableRemoteWallets drops kas and laci", () => {
  const list = filterShareableRemoteWallets([
    { id: "w_bri", type: "rekening", active: true },
    { id: "w_laci_kbu", type: "kas_fisik", outlet: "KBU", active: true },
    { id: "w_kas", type: "kas_fisik", active: true },
  ]);
  assert.deepEqual(list.map((w) => w.id), ["w_bri"]);
});

test("sanitizeSharedLinks keeps ops_share Uang NF + PayLater, drops Kas Besar", () => {
  const clean = sanitizeSharedLinks([
    { sourceWalletId: "w_bca", sourceWalletType: "rekening", linkKind: "rekening" },
    { sourceWalletId: "w1782220389555", sourceWalletType: "kas_fisik", linkKind: "ops_share" },
    { sourceWalletId: "w_shopee_paylater", sourceWalletType: "paylater", linkKind: "ops_share" },
    { sourceWalletId: "w_kas_besar", sourceWalletType: "kas_fisik", linkKind: "nf_cash" },
    { sourceWalletId: "w_kas_besar", sourceWalletType: "kas_fisik" },
  ]);
  assert.equal(clean.length, 3);
  assert.ok(clean.some((l) => l.sourceWalletId === "w1782220389555"));
  assert.ok(clean.some((l) => l.sourceWalletId === "w_shopee_paylater"));
  assert.ok(!clean.some((l) => l.sourceWalletId === "w_kas_besar"));
});
