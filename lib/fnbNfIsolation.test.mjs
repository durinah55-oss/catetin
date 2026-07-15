import test from "node:test";
import assert from "node:assert/strict";
import { CANONICAL_BUSINESS_ID } from "./canonicalBusiness.js";
import {
  businessFeatures,
  isFnBOnlyWallet,
  visibleWalletsForBusiness,
  isOverlayAllowedForBusiness,
  resolveCategoriesForBusiness,
} from "./businessFeatures.js";
import {
  getWalletCatalogForBusiness,
  resolveWalletMergeMode,
  buildFishingSharedLinks,
  createFishingWalletSetup,
  createWalletSetupSeed,
  NF_FNB_WALLETS,
  NF_FISHING_WALLETS,
} from "./walletPresets.js";
import { sanitizeSharedLinks } from "./sharedWalletPolicy.js";

const FNB = { id: CANONICAL_BUSINESS_ID, slug: "nusa-food", name: "Nusa Food", type: "fnb" };
const FISHING = { id: "e37505c1-f5b8-480f-810e-6c1e8c288933", slug: "nf-nusa-fishing", name: "NF Nusa Fishing", type: "ecommerce" };

test("FNB keeps full F&B feature set", () => {
  const f = businessFeatures(FNB);
  assert.equal(f.isFnB, true);
  assert.equal(f.settleLaci, true);
  assert.equal(f.kasirDaily, true);
  assert.equal(f.purchasingModule, true);
  assert.equal(f.fnbAnalisis, true);
  assert.equal(isOverlayAllowedForBusiness("settleLaporan", FNB), true);
  assert.equal(isOverlayAllowedForBusiness("laporanPurchasing", FNB), true);
});

test("NF Fishing does not inherit F&B-only overlays", () => {
  const f = businessFeatures(FISHING);
  assert.equal(f.isFnB, false);
  assert.equal(f.purchasingModule, false);
  assert.equal(isOverlayAllowedForBusiness("settleLaporan", FISHING), false);
  assert.equal(isOverlayAllowedForBusiness("wallets", FISHING), true);
});

test("FNB wallet catalog is full NF_FNB_WALLETS, not Fishing preset", () => {
  const fnbCatalog = getWalletCatalogForBusiness(CANONICAL_BUSINESS_ID, "fnb");
  assert.ok(fnbCatalog.some((w) => w.id === "w_laci_kbu"));
  assert.ok(fnbCatalog.some((w) => w.id === "w_kas_besar"));
  assert.ok(!fnbCatalog.some((w) => w.id === "w_fish_marketplace"));
  assert.equal(resolveWalletMergeMode(CANONICAL_BUSINESS_ID, {}), "canonical");
});

test("Fishing seed uses shared Uang NF + PayLater + bank links", () => {
  const setup = createFishingWalletSetup();
  const links = buildFishingSharedLinks({ enabled: true });
  assert.equal(setup.businessType, "ecommerce");
  assert.equal(links.length, 6);
  assert.ok(links.every((l) => l.sourceBusinessId === CANONICAL_BUSINESS_ID));
  assert.ok(!NF_FISHING_WALLETS.some((w) => w.id === "w_fish_uang_nf"));
  assert.ok(!NF_FISHING_WALLETS.some((w) => NF_FNB_WALLETS.some((f) => f.id === w.id)));
});

test("FNB wallet setup seed has no auto shared links", () => {
  const setup = createWalletSetupSeed("fnb");
  assert.deepEqual(setup.sharedLinks, []);
});

test("FNB load path does not strip any saved wallets", () => {
  const saved = [
    { id: "w_laci_kbu", name: "Laci KBU", outlet: "KBU", active: true },
    { id: "w_kas_kecil", name: "Kas Kecil Dodi", active: true, purchasingUse: true },
    { id: "w_shopee_paylater", name: "Shopee PayLater", type: "paylater", active: true },
  ];
  const isFnb = true;
  const kept = saved.filter((w) => isFnb || !isFnBOnlyWallet(w));
  assert.equal(kept.length, 3);
});

test("NF strips leaked FNB wallets but keeps Fishing + custom", () => {
  const saved = [
    { id: "w_fish_uang_makan", name: "Dompet Uang Makan", type: "kas_fisik", active: true },
    { id: "w_custom", name: "Tokopedia", type: "ewallet", active: true },
    { id: "w_laci_kbu", name: "Laci KBU", outlet: "KBU", active: true },
  ];
  const isFnb = false;
  const kept = saved.filter((w) => isFnb || !isFnBOnlyWallet(w));
  assert.deepEqual(kept.map((w) => w.id).sort(), ["w_custom", "w_fish_uang_makan"].sort());
});

test("FNB categories stay purchasing; NF gets ecommerce catalog", () => {
  const fnbCats = [{ id: "cp1", name: "Bahan Baku", type: "out", role: "purchasing", active: true }];
  assert.equal(resolveCategoriesForBusiness(fnbCats, FNB), null);
  const resolved = resolveCategoriesForBusiness(fnbCats, FISHING);
  assert.ok(resolved.some((c) => c.name === "Bahan produk"));
});

test("shared write-through includes ops share + banks, not Kas Besar", () => {
  const links = sanitizeSharedLinks(buildFishingSharedLinks({ enabled: true }));
  assert.equal(links.length, 6);
  assert.ok(links.some((l) => l.linkKind === "ops_share"));
  assert.ok(!links.some((l) => l.sourceWalletId === "w_kas_besar"));
  assert.equal(links.filter((l) => l.sourceWalletType === "rekening").length, 4);
});

test("FNB owner sees all FNB wallets including laci and kas kecil", () => {
  const wallets = NF_FNB_WALLETS.map((w) => ({ ...w, active: true }));
  const visible = visibleWalletsForBusiness(wallets, { role: "owner" }, FNB);
  assert.ok(visible.some((w) => w.id === "w_laci_kbu"));
  assert.ok(visible.some((w) => w.id === "w_kas_kecil"));
});
