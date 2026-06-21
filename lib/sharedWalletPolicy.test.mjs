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

test("sanitizeSharedLinks removes invalid links", () => {
  const clean = sanitizeSharedLinks([
    { sourceWalletId: "w_bca", sourceWalletType: "rekening", linkKind: "rekening" },
    { sourceWalletId: "w_kas_besar", sourceWalletType: "kas_fisik" },
    { sourceWalletId: "w_kas_kecil" },
  ]);
  assert.equal(clean.length, 1);
  assert.equal(clean[0].sourceWalletId, "w_bca");
});
