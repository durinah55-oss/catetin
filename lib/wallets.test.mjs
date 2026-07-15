import test from "node:test";
import assert from "node:assert/strict";
import { mergeWalletsPreferLocal, patchWalletCatalog } from "./wallets.js";

test("mergeWalletsPreferLocal keeps local wallet name and logo", () => {
  const remote = [{ id: "w_kbu", name: "Laci KBU", color: "#C47D0E", logoUrl: null }];
  const local = [{
    id: "w_kbu",
    name: "Laci Utama KBU",
    color: "#C47D0E",
    logoUrl: "data:image/webp;base64,abc123",
  }];
  const merged = mergeWalletsPreferLocal(remote, local);
  const w = merged.find((x) => x.id === "w_kbu");
  assert.equal(w.name, "Laci Utama KBU");
  assert.equal(w.logoUrl, "data:image/webp;base64,abc123");
});

test("patchWalletCatalog does not reset custom Shopee Food name", () => {
  const wallets = patchWalletCatalog([
    { id: "w_pm", name: "ShopeePay Merchant", color: "#111", type: "digital", sort: 50 },
  ]);
  const w = wallets.find((x) => x.id === "w_pm");
  assert.equal(w.name, "ShopeePay Merchant");
});

test("patchWalletCatalog still migrates legacy Payment Method name", () => {
  const wallets = patchWalletCatalog([
    { id: "w_pm", name: "Payment Method", color: "#111", sort: 50 },
  ]);
  const w = wallets.find((x) => x.id === "w_pm");
  assert.equal(w.name, "Shopee Food");
});

test("patchWalletCatalog migrates Dompet PM and Dompet NF", () => {
  const wallets = patchWalletCatalog([
    { id: "w_pm", name: "Dompet PM", color: "#14B8A6", sort: 50 },
    { id: "w_nf", name: "Dompet NF", color: "#F97316", sort: 51 },
  ]);
  assert.equal(wallets.find((x) => x.id === "w_pm").name, "Shopee Food");
  assert.equal(wallets.find((x) => x.id === "w_nf").name, "Grab Food");
});

test("patchWalletCatalog does not inject Go Food into NF Fishing wallets", () => {
  const wallets = patchWalletCatalog([
    { id: "w_fish_uang_nf", name: "Uang NF", type: "kas_fisik", sort: 4 },
    { id: "w_fish_marketplace", name: "Marketplace", type: "ewallet", sort: 10 },
  ]);
  assert.ok(!wallets.some((w) => w.id === "w_gofood"));
  assert.equal(wallets.length, 2);
});
