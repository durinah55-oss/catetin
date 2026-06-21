import test from "node:test";
import assert from "node:assert/strict";
import {
  businessFeatures,
  isFnBOnlyWallet,
  isOverlayAllowedForBusiness,
  visibleWalletsForBusiness,
} from "./businessFeatures.js";

test("e-commerce hides F&B wallets and settle overlay", () => {
  const fishing = { id: "fish-1", type: "ecommerce", name: "Nusa Fishing" };
  const f = businessFeatures(fishing);
  assert.equal(f.isFnB, false);
  assert.equal(f.settleLaci, false);
  assert.equal(isOverlayAllowedForBusiness("settleLaporan", fishing), false);
  assert.equal(isOverlayAllowedForBusiness("wallets", fishing), true);

  const wallets = [
    { id: "w_kas", name: "Kas", active: true },
    { id: "w_laci_kbu", name: "Laci KBU", outlet: "KBU", active: true },
    { id: "w_kas_kecil", name: "Kas Kecil", active: true, purchasingUse: true },
  ];
  const user = { role: "owner" };
  const visible = visibleWalletsForBusiness(wallets, user, fishing);
  assert.deepEqual(visible.map((w) => w.id), ["w_kas"]);
  assert.equal(isFnBOnlyWallet(wallets[1]), true);
});

test("F&B business keeps full features", () => {
  const nf = { id: "e23ed572-234c-4995-acad-fa6bff7c58d2", type: "fnb", name: "Nusa Food" };
  assert.equal(businessFeatures(nf).isFnB, true);
  assert.equal(isOverlayAllowedForBusiness("settleLaporan", nf), true);
});
