// lib/nfSalesChannels.js — registry toko MP & grouping channel omzet NF Nusa Fishing

/** Grup channel untuk dashboard & analisis ketergantungan MP. */
export const NF_CHANNEL_GROUPS = {
  marketplace: { label: "Marketplace", settlesViaMp: true },
  direct: { label: "Direct", settlesViaMp: false },
  reseller: { label: "Reseller", settlesViaMp: false },
  maklon: { label: "Maklon", settlesViaMp: false },
  other: { label: "Pendapatan lain", settlesViaMp: false },
  capital: { label: "Modal / pinjaman", settlesViaMp: false, isRevenue: false },
};

export const NF_INCOME_GROUP_ORDER = [
  "marketplace",
  "direct",
  "reseller",
  "maklon",
  "other",
  "capital",
];

export const NF_MP_PLATFORMS = [
  { id: "tiktok", categoryId: "nf_in_mp_tiktok", label: "TikTok Shop", sort: 10 },
  { id: "shopee", categoryId: "nf_in_mp_shopee", label: "Shopee", sort: 20 },
  { id: "tokopedia", categoryId: "nf_in_mp_tokopedia", label: "Tokopedia", sort: 30 },
  { id: "lazada", categoryId: "nf_in_mp_lazada", label: "Lazada", sort: 40 },
  { id: "bukalapak", categoryId: "nf_in_mp_bukalapak", label: "Bukalapak", sort: 50 },
];

/** Template toko awal — admin bisa tambah/edit di Pengaturan. */
export const DEFAULT_MP_STORES = [
  { id: "tts_nf_01", platformId: "tiktok", code: "TTS-NF-01", name: "Nusa Fishing Official", active: true, sort: 10 },
  { id: "spe_nf_01", platformId: "shopee", code: "SPE-NF-01", name: "Nusa Fishing", active: true, sort: 20 },
  { id: "tpc_nf_01", platformId: "tokopedia", code: "TPC-NF-01", name: "Nusa Fishing", active: true, sort: 30 },
];

const platformByCategory = new Map(NF_MP_PLATFORMS.map((p) => [p.categoryId, p]));

export function platformForCategory(categoryId) {
  return platformByCategory.get(categoryId) || null;
}

export function categoryNeedsStore(cat) {
  return cat?.channelGroup === "marketplace";
}

export function hydrateMpStores(saved) {
  const list = Array.isArray(saved) ? saved : [];
  const byId = new Map();
  for (const def of DEFAULT_MP_STORES) {
    byId.set(def.id, { ...def });
  }
  for (const s of list) {
    if (!s?.id) continue;
    byId.set(s.id, { ...byId.get(s.id), ...s });
  }
  return [...byId.values()].sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999) || (a.name || "").localeCompare(b.name || "", "id"));
}

export function mpStoresForCategory(categoryId, stores = []) {
  const platform = platformForCategory(categoryId);
  if (!platform) return [];
  return (stores || []).filter((s) => s.platformId === platform.id && s.active !== false);
}

export function findMpStore(stores, storeId) {
  return (stores || []).find((s) => s.id === storeId) || null;
}

export function createMpStoreId(platformId, stores = []) {
  const prefix = String(platformId || "mp").slice(0, 3).toLowerCase();
  let n = (stores || []).length + 1;
  let id;
  do {
    id = `${prefix}_custom_${String(n).padStart(2, "0")}`;
    n += 1;
  } while ((stores || []).some((s) => s.id === id));
  return id;
}

export function nextStoreCode(platformId, stores = []) {
  const plat = NF_MP_PLATFORMS.find((p) => p.id === platformId);
  const prefix = plat?.id === "tiktok" ? "TTS"
    : plat?.id === "shopee" ? "SPE"
    : plat?.id === "tokopedia" ? "TPC"
    : plat?.id === "lazada" ? "LZD"
    : plat?.id === "bukalapak" ? "BLP"
    : "MP";
  const same = (stores || []).filter((s) => s.platformId === platformId);
  const n = same.length + 1;
  return `${prefix}-NF-${String(n).padStart(2, "0")}`;
}

/** Meta transaksi pemasukan MP — konsisten untuk dashboard per toko. */
export function buildMpIncomeMeta(cat, storeId, stores = []) {
  if (!categoryNeedsStore(cat) || !storeId) return {};
  const store = findMpStore(stores, storeId);
  if (!store) return { storeId };
  return {
    storeId: store.id,
    storeCode: store.code || null,
    storeName: store.name || null,
    platformId: store.platformId || cat?.platformId || null,
  };
}

/** Grup kategori pemasukan NF untuk form input. */
export function groupNfIncomeCategories(categories = []) {
  const buckets = Object.fromEntries(NF_INCOME_GROUP_ORDER.map((g) => [g, []]));
  for (const c of categories || []) {
    if (c.type !== "in" || c.active === false) continue;
    if (c.id === "nf_in_mp_gross" || c.id === "nf_in_mp_net") continue;
    const g = c.channelGroup || "other";
    if (buckets[g]) buckets[g].push(c);
    else buckets.other.push(c);
  }
  for (const g of NF_INCOME_GROUP_ORDER) {
    buckets[g].sort((a, b) => (a.sort ?? 999) - (b.sort ?? 999));
  }
  return NF_INCOME_GROUP_ORDER
    .map((g) => ({ id: g, label: NF_CHANNEL_GROUPS[g]?.label || g, categories: buckets[g] }))
    .filter((row) => row.categories.length > 0);
}
