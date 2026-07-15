import test from "node:test";
import assert from "node:assert/strict";
import { NF_FISHING_DEFAULT_CATEGORIES } from "./nfCategoryCatalog.js";
import { computeNfProfit } from "./nfProfitReport.js";

const cats = NF_FISHING_DEFAULT_CATEGORIES;
const id = (name) => cats.find((c) => c.name === name)?.id;

test("NF laba contoh user: omzet kotor − HPP − opex", () => {
  const txs = [
    { id: "1", type: "in", amount: 100_000_000, categoryId: id("Penjualan MP (kotor)"), date: "2026-07-01" },
    { id: "2", type: "out", amount: 5_000_000, categoryId: id("Refund"), date: "2026-07-02" },
    { id: "3", type: "out", amount: 35_000_000, categoryId: id("Bahan essen"), date: "2026-07-03" },
    { id: "4", type: "out", amount: 30_000_000, categoryId: id("Gaji"), date: "2026-07-04" },
  ];
  const r = computeNfProfit(txs, cats, { start: "2026-07-01", end: "2026-07-31" });
  assert.equal(r.omzetBersih, 95_000_000);
  assert.equal(r.hpp, 35_000_000);
  assert.equal(r.labaKotor, 60_000_000);
  assert.equal(r.labaBersih, 30_000_000);
});

test("NF prive tidak mengurangi laba bersih", () => {
  const txs = [
    { id: "1", type: "in", amount: 10_000_000, categoryId: id("Pemasukan MP (bersih)"), date: "2026-07-01" },
    { id: "2", type: "out", amount: 2_000_000, categoryId: id("Prive owner"), date: "2026-07-02" },
  ];
  const r = computeNfProfit(txs, cats, { start: "2026-07-01", end: "2026-07-31" });
  assert.equal(r.labaBersih, 10_000_000);
  assert.equal(r.prive, 2_000_000);
  assert.equal(r.arusBersih, 8_000_000);
});

test("peringatan dobel marketplace jika pemasukan bersih + fee", () => {
  const txs = [
    { id: "1", type: "in", amount: 8_500_000, categoryId: id("Pemasukan MP (bersih)"), date: "2026-07-01" },
    { id: "2", type: "out", amount: 1_500_000, categoryId: id("Admin TikTok / Shopee"), date: "2026-07-01" },
  ];
  const r = computeNfProfit(txs, cats, { start: "2026-07-01", end: "2026-07-31" });
  assert.ok(r.warnings.some((w) => w.includes("bersih")));
});
