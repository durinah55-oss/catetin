// lib/nfCategoryCatalog.js — katalog kategori NF Nusa Fishing (laba rugi & arus kas)

/**
 * nfKind — untuk hitung laba:
 * - revenue_gross: omzet kotor (cara lengkap MP)
 * - revenue_net: pemasukan bersih (cara sederhana MP — jangan + marketplace_fee lagi)
 * - revenue_deduction: diskon / retur / refund (kurangi omzet)
 * - hpp: modal produk terjual
 * - marketplace_fee: biaya admin MP (hanya jika pakai revenue_gross)
 * - opex: biaya operasional (mengurangi laba bersih)
 * - capex: pembelian alat (arus kas, bukan beban laba bulanan)
 * - prive: uang owner / transfer usaha lain (arus kas, bukan beban laba)
 * - transfer: perpindahan internal (netral laba)
 */

function cat(id, name, type, { group, nfKind, purchasingUse = false, sort = 0, hint = "" } = {}) {
  return {
    id,
    name,
    type,
    active: true,
    sort,
    group: group || null,
    nfKind: nfKind || null,
    purchasingUse: !!purchasingUse,
    hint: hint || null,
  };
}

export const NF_CATEGORY_GROUPS = [
  "Pemasukan",
  "Bahan produk",
  "Kemasan",
  "Produksi",
  "Pengiriman",
  "Biaya marketplace",
  "Marketing",
  "Karyawan",
  "Operasional",
  "Riset produk",
  "Retur & komplain",
  "Pembelian alat",
  "Uang owner",
  "Transfer internal",
];

/** Katalog default NF — contoh struktur owner; purchasing pakai subset purchasingUse. */
export const NF_FISHING_DEFAULT_CATEGORIES = [
  // ── Pemasukan ──
  cat("nf_in_mp_gross", "Penjualan MP (kotor)", "in", { group: "Pemasukan", nfKind: "revenue_gross", sort: 10, hint: "Cara lengkap: catat omzet sebelum potongan MP" }),
  cat("nf_in_mp_net", "Pemasukan MP (bersih)", "in", { group: "Pemasukan", nfKind: "revenue_net", sort: 20, hint: "Cara sederhana: uang yang benar-benar cair" }),
  cat("nf_in_ongkir_buyer", "Ongkir dibayar pembeli", "in", { group: "Pemasukan", nfKind: "revenue_gross", sort: 30 }),

  // ── Bahan produk ──
  cat("nf_out_bahan_essen", "Bahan essen", "out", { group: "Bahan produk", nfKind: "hpp", purchasingUse: true, sort: 100 }),
  cat("nf_out_bahan_perisa", "Perisa", "out", { group: "Bahan produk", nfKind: "hpp", purchasingUse: true, sort: 110 }),
  cat("nf_out_bahan_pewarna", "Pewarna", "out", { group: "Bahan produk", nfKind: "hpp", purchasingUse: true, sort: 120 }),
  cat("nf_out_bahan_campuran", "Bahan campuran", "out", { group: "Bahan produk", nfKind: "hpp", purchasingUse: true, sort: 130 }),

  // ── Kemasan ──
  cat("nf_out_kem_botol", "Botol", "out", { group: "Kemasan", nfKind: "hpp", purchasingUse: true, sort: 200 }),
  cat("nf_out_kem_tutup", "Tutup", "out", { group: "Kemasan", nfKind: "hpp", purchasingUse: true, sort: 210 }),
  cat("nf_out_kem_stiker", "Stiker", "out", { group: "Kemasan", nfKind: "hpp", purchasingUse: true, sort: 220 }),
  cat("nf_out_kem_segel", "Segel", "out", { group: "Kemasan", nfKind: "hpp", purchasingUse: true, sort: 230 }),
  cat("nf_out_kem_kardus", "Kardus", "out", { group: "Kemasan", nfKind: "hpp", purchasingUse: true, sort: 240 }),
  cat("nf_out_kem_bubble", "Bubble wrap", "out", { group: "Kemasan", nfKind: "hpp", purchasingUse: true, sort: 250 }),
  cat("nf_out_kem_qr", "QR / serial / PIN", "out", { group: "Kemasan", nfKind: "hpp", purchasingUse: true, sort: 260 }),

  // ── Produksi ──
  cat("nf_out_prod_upah", "Upah produksi", "out", { group: "Produksi", nfKind: "hpp", purchasingUse: true, sort: 300 }),
  cat("nf_out_prod_packing", "Upah packing", "out", { group: "Produksi", nfKind: "hpp", purchasingUse: true, sort: 310 }),
  cat("nf_out_prod_gagal", "Produk gagal", "out", { group: "Produksi", nfKind: "hpp", purchasingUse: true, sort: 320 }),
  cat("nf_out_prod_rusak", "Produk bocor / rusak", "out", { group: "Produksi", nfKind: "hpp", purchasingUse: true, sort: 330 }),

  // ── Pengiriman ──
  cat("nf_out_kirim_pesanan", "Ongkir pesanan", "out", { group: "Pengiriman", nfKind: "opex", purchasingUse: true, sort: 400 }),
  cat("nf_out_kirim_bahan", "Ongkir beli bahan", "out", { group: "Pengiriman", nfKind: "opex", purchasingUse: true, sort: 410 }),
  cat("nf_out_kirim_bensin", "Bensin", "out", { group: "Pengiriman", nfKind: "opex", purchasingUse: true, sort: 420 }),
  cat("nf_out_kirim_cargo", "Cargo", "out", { group: "Pengiriman", nfKind: "opex", purchasingUse: true, sort: 430 }),

  // ── Biaya marketplace ──
  cat("nf_out_mp_admin", "Admin TikTok / Shopee", "out", { group: "Biaya marketplace", nfKind: "marketplace_fee", sort: 500, hint: "Hanya jika pemasukan pakai omzet kotor" }),
  cat("nf_out_mp_affiliate", "Komisi affiliate", "out", { group: "Biaya marketplace", nfKind: "marketplace_fee", sort: 510 }),
  cat("nf_out_mp_voucher", "Voucher", "out", { group: "Biaya marketplace", nfKind: "marketplace_fee", sort: 520 }),
  cat("nf_out_mp_campaign", "Potongan campaign", "out", { group: "Biaya marketplace", nfKind: "marketplace_fee", sort: 530 }),

  // ── Marketing ──
  cat("nf_out_mkt_iklan", "Iklan", "out", { group: "Marketing", nfKind: "opex", sort: 600 }),
  cat("nf_out_mkt_kol", "KOL", "out", { group: "Marketing", nfKind: "opex", sort: 610 }),
  cat("nf_out_mkt_affiliate", "Affiliate", "out", { group: "Marketing", nfKind: "opex", sort: 620 }),
  cat("nf_out_mkt_tester", "Produk gratis tester", "out", { group: "Marketing", nfKind: "opex", sort: 630 }),
  cat("nf_out_mkt_giveaway", "Giveaway", "out", { group: "Marketing", nfKind: "opex", sort: 640 }),
  cat("nf_out_mkt_konten", "Konten & live", "out", { group: "Marketing", nfKind: "opex", sort: 650 }),

  // ── Karyawan ──
  cat("nf_out_kar_gaji", "Gaji", "out", { group: "Karyawan", nfKind: "opex", sort: 700 }),
  cat("nf_out_kar_bonus", "Bonus", "out", { group: "Karyawan", nfKind: "opex", sort: 710 }),
  cat("nf_out_kar_lembur", "Lembur", "out", { group: "Karyawan", nfKind: "opex", sort: 720 }),
  cat("nf_out_kar_makan", "Uang makan & transport", "out", { group: "Karyawan", nfKind: "opex", sort: 730 }),

  // ── Operasional ──
  cat("nf_out_ops_listrik", "Listrik", "out", { group: "Operasional", nfKind: "opex", sort: 800 }),
  cat("nf_out_ops_internet", "Internet", "out", { group: "Operasional", nfKind: "opex", sort: 810 }),
  cat("nf_out_ops_sewa", "Sewa", "out", { group: "Operasional", nfKind: "opex", sort: 820 }),
  cat("nf_out_ops_atk", "ATK", "out", { group: "Operasional", nfKind: "opex", purchasingUse: true, sort: 830 }),
  cat("nf_out_ops_software", "Software", "out", { group: "Operasional", nfKind: "opex", sort: 840 }),
  cat("nf_out_ops_domain", "Domain", "out", { group: "Operasional", nfKind: "opex", sort: 850 }),
  cat("nf_out_ops_fonnte", "Fonnte", "out", { group: "Operasional", nfKind: "opex", sort: 860 }),

  // ── Riset produk ──
  cat("nf_out_riset_bahan", "Bahan trial", "out", { group: "Riset produk", nfKind: "opex", sort: 900 }),
  cat("nf_out_riset_kolam", "Tiket kolam", "out", { group: "Riset produk", nfKind: "opex", sort: 910 }),
  cat("nf_out_riset_tester", "Tester", "out", { group: "Riset produk", nfKind: "opex", sort: 920 }),
  cat("nf_out_riset_transport", "Transport uji coba", "out", { group: "Riset produk", nfKind: "opex", sort: 930 }),

  // ── Retur & komplain ──
  cat("nf_out_ret_refund", "Refund", "out", { group: "Retur & komplain", nfKind: "revenue_deduction", sort: 1000 }),
  cat("nf_out_ret_salah", "Salah kirim", "out", { group: "Retur & komplain", nfKind: "opex", sort: 1010 }),
  cat("nf_out_ret_ulang", "Kirim ulang", "out", { group: "Retur & komplain", nfKind: "opex", sort: 1020 }),
  cat("nf_out_ret_rusak", "Barang rusak (komplain)", "out", { group: "Retur & komplain", nfKind: "revenue_deduction", sort: 1030 }),

  // ── Pembelian alat (capex) ──
  cat("nf_out_alat_mesin", "Mesin", "out", { group: "Pembelian alat", nfKind: "capex", sort: 1100 }),
  cat("nf_out_alat_printer", "Printer", "out", { group: "Pembelian alat", nfKind: "capex", sort: 1110 }),
  cat("nf_out_alat_laptop", "Laptop", "out", { group: "Pembelian alat", nfKind: "capex", sort: 1120 }),
  cat("nf_out_alat_hp", "HP", "out", { group: "Pembelian alat", nfKind: "capex", sort: 1130 }),
  cat("nf_out_alat_rak", "Rak gudang", "out", { group: "Pembelian alat", nfKind: "capex", sort: 1140 }),

  // ── Uang owner (prive — bukan beban laba) ──
  cat("nf_out_own_prive", "Prive owner", "out", { group: "Uang owner", nfKind: "prive", sort: 1200, hint: "Kurangi saldo kas, tidak mengurangi laba NF" }),
  cat("nf_out_own_transfer", "Transfer ke usaha lain", "out", { group: "Uang owner", nfKind: "prive", sort: 1210 }),
  cat("nf_out_own_modal", "Pengembalian modal", "out", { group: "Uang owner", nfKind: "prive", sort: 1220 }),

  // ── Transfer internal (netral laba) ──
  cat("nf_out_trf_internal", "Transfer internal", "out", { group: "Transfer internal", nfKind: "transfer", sort: 1300, hint: "Perpindahan antar dompet — bukan pemasukan/pengeluaran usaha" }),
];

const LEGACY_EC_IDS = new Set([
  "ec_in1", "ec_in2", "ec_out1", "ec_out2", "ec_out3", "ec_out4", "ec_out5",
]);

export function isLegacyEcommerceCategoryList(categories = []) {
  const list = categories || [];
  if (!list.length) return false;
  return list.every((c) => LEGACY_EC_IDS.has(c.id) || /^ec_(in|out)\d+$/.test(String(c.id || "")));
}

export function nfCategoryById(categories = []) {
  return new Map((categories || []).map((c) => [c.id, c]));
}

export function nfPurchasingCategories(categories = []) {
  return (categories || []).filter((c) => c.active !== false && c.type === "out" && c.purchasingUse);
}
