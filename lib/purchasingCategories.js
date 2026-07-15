// lib/purchasingCategories.js — kategori default purchasing (13) + fallback jika DB/app_state kosong

/** Nama kategori purchasing final (13) — dipakai buang duplikat umum/out lama. */
export const PURCHASING_FINAL_NAMES = new Set([
  "bahan baku",
  "kemasan",
  "gas lpg",
  "listrik, air & internet",
  "gaji & upah",
  "sewa tempat",
  "kebutuhan operasional",
  "transport & ongkos belanja",
  "peralatan & perbaikan",
  "promosi",
  "pembelian aset",
  "keperluan owner",
  "lain-lain",
]);
export const DEFAULT_PURCHASING_CATEGORIES = [
  { id: "cp1", name: "Bahan Baku", type: "out", role: "purchasing", active: true, icon: "shopping-bag", color: "#1D9E75", sort: 1, accounting_group: "hpp", description: "Ayam, beras, sayur, bumbu, susu, kopi, minyak. Bisa habis untuk membuat menu." },
  { id: "cp2", name: "Kemasan", type: "out", role: "purchasing", active: true, icon: "box", color: "#0F6E56", sort: 2, accounting_group: "hpp", description: "Cup, mangkuk, plastik, paper bag, sendok takeaway. Dipakai membungkus pesanan." },
  { id: "cp3", name: "Gas LPG", type: "out", role: "purchasing", active: true, icon: "flame", color: "#D85A30", sort: 3, accounting_group: "hpp", description: "Pembelian tabung gas LPG untuk memasak." },
  { id: "cp4", name: "Listrik, Air & Internet", type: "out", role: "purchasing", active: true, icon: "bolt", color: "#378ADD", sort: 4, accounting_group: "beban_operasional", description: "Tagihan listrik, air, WiFi, token listrik." },
  { id: "cp5", name: "Gaji & Upah", type: "out", role: "purchasing", active: true, icon: "users", color: "#085041", sort: 5, accounting_group: "beban_operasional", description: "Gaji staf, upah harian, tunjangan." },
  { id: "cp6", name: "Sewa Tempat", type: "out", role: "purchasing", active: true, icon: "building", color: "#5F5E5A", sort: 6, accounting_group: "beban_operasional", description: "Sewa ruko, kontrakan outlet, sewa tempat usaha." },
  { id: "cp7", name: "Kebutuhan Operasional", type: "out", role: "purchasing", active: true, icon: "settings", color: "#7F77DD", sort: 7, accounting_group: "beban_operasional", description: "Sabun, tisu, alat kebersihan, ATK, galon, kebutuhan outlet sehari-hari." },
  { id: "cp8", name: "Transport & Ongkos Belanja", type: "out", role: "purchasing", active: true, icon: "truck", color: "#BA7517", sort: 8, accounting_group: "beban_operasional", description: "Bensin, parkir, ongkir, ongkos mengambil barang." },
  { id: "cp9", name: "Peralatan & Perbaikan", type: "out", role: "purchasing", active: true, icon: "tools", color: "#993C1D", sort: 9, accounting_group: "beban_operasional", description: "Pisau, baskom, gelas, kabel, servis kompor, servis keran. Barang kecil dipakai berulang." },
  { id: "cp10", name: "Promosi", type: "out", role: "purchasing", active: true, icon: "speakerphone", color: "#D4537E", sort: 10, accounting_group: "beban_operasional", description: "Iklan, cetak banner, endorse, diskon promosi." },
  { id: "cp11", name: "Pembelian Aset", type: "out", role: "purchasing", active: true, icon: "device-laptop", color: "#534AB7", sort: 11, accounting_group: "aset", description: "Kulkas, freezer, AC, mesin kopi, laptop, tablet, meja besar. Barang mahal dan tahan lama." },
  { id: "cp12", name: "Keperluan Owner", type: "out", role: "purchasing", active: true, icon: "user", color: "#888780", sort: 12, accounting_group: "pribadi", description: "Pengambilan atau pembelian untuk kebutuhan pribadi owner. Bukan biaya usaha." },
  { id: "cp13", name: "Lain-lain", type: "out", role: "purchasing", active: true, icon: "dots", color: "#B4B2A9", sort: 13, accounting_group: "lain", description: "Wajib isi keterangan di kolom catatan." },
];

function categoryNameNorm(c) {
  return (c?.name || "").trim().toLowerCase();
}

/** Buang kategori purchasing ad-hoc (nama barang mis. "ayam pentung") — hanya 13 kelompok resmi. */
export function purgeRoguePurchasingCategories(categories = []) {
  return (categories || []).filter((c) => {
    if (c?.role !== "purchasing" || c?.type !== "out") return true;
    return PURCHASING_FINAL_NAMES.has(categoryNameNorm(c));
  });
}

/** Set role purchasing pada kategori out dengan nama final tapi role kosong (dari DB lama). */
export function inferPurchasingRole(c) {
  if (!c || c.role === "purchasing") return c;
  if (c.type === "out" && PURCHASING_FINAL_NAMES.has(categoryNameNorm(c))) {
    return { ...c, role: "purchasing" };
  }
  return c;
}

/**
 * Pastikan minimal 13 kategori purchasing tersedia — cegah form kosong setelah merge DB.
 * @param {Function} [cleanFn] — cleanCategoryList dari appState (hindari circular import di runtime)
 */
export function ensurePurchasingCategories(categories = [], cleanFn = (x) => x) {
  const purged = purgeRoguePurchasingCategories(categories);
  const inferred = purged.map(inferPurchasingRole);
  const byName = new Map(inferred.map((c) => [categoryNameNorm(c), c]));

  for (const def of DEFAULT_PURCHASING_CATEGORIES) {
    const key = categoryNameNorm(def);
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { ...def });
      continue;
    }
    if (existing.role !== "purchasing") {
      byName.set(key, { ...def, ...existing, role: "purchasing", type: "out" });
    }
  }
  return cleanFn([...byName.values()]);
}
