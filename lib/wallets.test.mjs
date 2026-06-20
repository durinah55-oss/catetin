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
