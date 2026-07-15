import test from "node:test";
import assert from "node:assert/strict";
import {
  businessFeatures,
  isFnBOnlyWallet,
  isOverlayAllowedForBusiness,
  visibleWalletsForBusiness,
  resolveCategoriesForBusiness,
} from "./businessFeatures.js";

test("e-commerce keeps NF fishing wallets and custom wallets", () => {
  const fishing = { id: "fish-1", type: "ecommerce", name: "Nusa Fishing" };
  const wallets = [
    { id: "w_fish_shopee_paylater", name: "Shopee PayLater", type: "paylater", active: true, purchasingUse: true },
    { id: "w_custom_1", name: "Tokopedia", type: "ewallet", active: true },
    { id: "w_laci_kbu", name: "Laci KBU", outlet: "KBU", active: true },
  ];
  const user = { role: "owner" };
  const visible = visibleWalletsForBusiness(wallets, user, fishing);
  assert.deepEqual(visible.map((w) => w.id).sort(), ["w_custom_1", "w_fish_shopee_paylater"].sort());
  assert.equal(isFnBOnlyWallet(wallets[0]), false);
  assert.equal(isFnBOnlyWallet(wallets[1]), false);
});

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

test("e-commerce purchasing only sees purchasingUse wallets", () => {
  const fishing = { id: "fish-1", type: "ecommerce", name: "Nusa Fishing" };
  const wallets = [
    { id: "w1781912441557", name: "Dana Darurat", active: true, type: "kas_fisik" },
    { id: "w_fish_marketplace", name: "Marketplace", active: true, type: "ewallet" },
    { id: "w_fish_bca_rudi", name: "Bank BCA Rudi", active: true, type: "rekening" },
    { id: "w_kas_kecil", name: "Kas Kecil Dodi", active: true, purchasingUse: true },
    { id: "shared_sh_nf_bca", name: "BCA (Sam · NF) ↗", active: true, type: "shared" },
  ];
  const user = { role: "purchasing" };
  const visible = visibleWalletsForBusiness(wallets, user, fishing);
  assert.deepEqual(visible.map((w) => w.id).sort(), ["shared_sh_nf_bca", "w1781912441557"].sort());
  assert.ok(visible.every((w) => w.id !== "w_kas_kecil"));
  assert.ok(visible.every((w) => w.id !== "w_fish_marketplace"));
});

test("e-commerce replaces FNB purchasing categories on resolve", () => {
  const fishing = { id: "fish-1", type: "ecommerce" };
  const fnbCats = [{ id: "cp1", name: "Bahan Baku", type: "out", role: "purchasing", active: true }];
  const resolved = resolveCategoriesForBusiness(fnbCats, fishing);
  assert.ok(resolved.some((c) => c.name === "Modal / Kulakan"));
  assert.ok(!resolved.some((c) => c.name === "Bahan Baku"));
});
test("F&B business keeps full features", () => {
  const nf = { id: "e23ed572-234c-4995-acad-fa6bff7c58d2", type: "fnb", name: "Nusa Food" };
  assert.equal(businessFeatures(nf).isFnB, true);
  assert.equal(isOverlayAllowedForBusiness("settleLaporan", nf), true);
});
