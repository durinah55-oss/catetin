// lib/nfLegacyMpMigration.js — migrasi transaksi pemasukan MP agregat ke channel per platform

import { NF_MP_PLATFORMS } from "./nfSalesChannels.js";
import { mpStoresForCategory } from "./nfSalesChannels.js";

const LEGACY_MP_CATEGORY_IDS = new Set([
  "nf_in_mp_net",
  "nf_in_mp_gross",
  "ec_in1",
  "ec_in2",
]);

const PLATFORM_INFERENCE = [
  { platformId: "tiktok", categoryId: "nf_in_mp_tiktok", patterns: [/tiktok(?:\s*shop)?/i, /\btts[-\s]/i, /shop\.tiktok/i] },
  { platformId: "shopee", categoryId: "nf_in_mp_shopee", patterns: [/shopee/i, /\bspe[-\s]/i, /seller\.shopee/i] },
  { platformId: "tokopedia", categoryId: "nf_in_mp_tokopedia", patterns: [/tokopedia/i, /\btpc[-\s]/i, /seller\.tokopedia/i] },
  { platformId: "lazada", categoryId: "nf_in_mp_lazada", patterns: [/lazada/i, /\blzd[-\s]/i] },
  { platformId: "bukalapak", categoryId: "nf_in_mp_bukalapak", patterns: [/bukalapak/i, /\bblp[-\s]/i] },
];

function txSearchText(t) {
  const parts = [
    t.desc,
    t.source,
    t.meta?.storeCode,
    t.meta?.storeName,
    t.meta?.note,
  ].filter(Boolean);
  return parts.join(" ").toLowerCase();
}

function inferPlatform(categoryId, text) {
  for (const row of PLATFORM_INFERENCE) {
    if (row.patterns.some((rx) => rx.test(text))) return row;
  }
  if (categoryId === "ec_in2") return PLATFORM_INFERENCE.find((r) => r.platformId === "shopee") || null;
  return null;
}

function inferStore(text, categoryId, mpStores = []) {
  const stores = mpStoresForCategory(categoryId, mpStores);
  for (const st of stores) {
    const code = String(st.code || "").toLowerCase();
    const name = String(st.name || "").toLowerCase();
    if (code && text.includes(code)) return st;
    if (name && name.length >= 4 && text.includes(name)) return st;
  }
  return null;
}

/**
 * Pindahkan pemasukan MP agregat (nf_in_mp_net, dll.) ke kategori channel per platform
 * berdasarkan kata kunci di catatan/sumber. Transaksi tanpa petunjuk platform dibiarkan.
 */
export function migrateLegacyMpIncomeTransactions(transactions = [], { mpStores = [] } = {}) {
  let changed = false;
  let migrated = 0;
  let storeTagged = 0;
  let unchanged = 0;

  const out = (transactions || []).map((t) => {
    if (t.type !== "in" || !LEGACY_MP_CATEGORY_IDS.has(t.categoryId)) return t;

    const text = txSearchText(t);
    const inferred = inferPlatform(t.categoryId, text);
    if (!inferred) {
      unchanged += 1;
      return t;
    }

    changed = true;
    migrated += 1;

    const store = inferStore(text, inferred.categoryId, mpStores);
    const meta = {
      ...(t.meta || {}),
      migratedFrom: t.categoryId,
      migratedAt: new Date().toISOString().slice(0, 10),
    };
    if (store) {
      meta.storeId = store.id;
      meta.storeCode = store.code || null;
      meta.storeName = store.name || null;
      meta.platformId = store.platformId || inferred.platformId;
      storeTagged += 1;
    }

    return {
      ...t,
      categoryId: inferred.categoryId,
      meta,
    };
  });

  return {
    transactions: out,
    changed,
    stats: { migrated, storeTagged, unchanged },
  };
}

export function countLegacyMpIncomeTransactions(transactions = []) {
  return (transactions || []).filter(
    (t) => t.type === "in" && LEGACY_MP_CATEGORY_IDS.has(t.categoryId)
  ).length;
}

export { LEGACY_MP_CATEGORY_IDS, NF_MP_PLATFORMS };
