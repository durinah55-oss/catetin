// lib/businessFeatures.js — fitur & dompet per tipe bisnis (F&B vs e-commerce vs UMKM)

import {
  isCanonicalBusiness,
  CANONICAL_DISPLAY_NAME,
  findCanonicalInList,
  resolveBusinessDisplayName,
} from "./canonicalBusiness.js";
import { NF_FNB_WALLETS, NF_FISHING_WALLET_IDS } from "./walletPresets.js";
import { PURCHASING_FINAL_NAMES } from "./purchasingCategories.js";
import { visibleWallets, visibleTransactions, visibleCategories } from "./rbac.js";
import {
  NF_FISHING_DEFAULT_CATEGORIES,
  isLegacyEcommerceCategoryList,
  isDetailedNfCategoryList,
  ensureNfFishingCategories,
} from "./nfCategoryCatalog.js";

const FNB_WALLET_IDS = new Set(NF_FNB_WALLETS.map((w) => w.id));

const ECOMMERCE_WALLET_IDS = new Set(["w_kas", "w_bank", "w_marketplace", "w_qris"]);

export function resolveBusinessType(business) {
  if (isCanonicalBusiness(business)) return "fnb";
  return business?.type || "umkm";
}

export function isFnBBusiness(business) {
  return resolveBusinessType(business) === "fnb";
}

export function businessTypeLabel(type) {
  if (type === "fnb") return "Resto F&B";
  if (type === "ecommerce") return "E-commerce";
  return "Toko / UMKM";
}

/** Fitur yang boleh dipakai di bisnis aktif. */
export function businessFeatures(business) {
  const type = resolveBusinessType(business);
  const isFnB = type === "fnb";
  return {
    type,
    isFnB,
    label: businessTypeLabel(type),
    settleLaci: isFnB,
    kasirDaily: isFnB,
    sosmedReports: isFnB,
    voidOutlet: isFnB,
    purchasingModule: isFnB,
    fnbAnalisis: isFnB,
    sharedWalletLinks: true,
  };
}

/** Dompet khusus resto (laci outlet, purchasing, marketplace makanan, dll.).
 *  Catatan: type "shared" (rekening Sam mirror) BUKAN FNB-only — dipakai bersama di NF. */
export function isFnBOnlyWallet(w) {
  if (!w) return false;
  if (w.type === "shared" || String(w.id || "").startsWith("shared_")) return false;
  if (NF_FISHING_WALLET_IDS.has(w.id)) return false;
  if (w.outlet && ["KBU", "KSM", "SMT"].includes(w.outlet)) return true;
  if (FNB_WALLET_IDS.has(w.id)) return true;
  if (ECOMMERCE_WALLET_IDS.has(w.id)) return false;
  return false;
}

/** Kategori awal e-commerce / NF — katalog lengkap NF Fishing (contoh owner). */
export const ECOMMERCE_DEFAULT_CATEGORIES = NF_FISHING_DEFAULT_CATEGORIES;

export function defaultCategoriesForBusiness(business) {
  if (isFnBBusiness(business)) return null;
  const type = resolveBusinessType(business);
  if (type === "ecommerce" || type === "umkm") {
    return NF_FISHING_DEFAULT_CATEGORIES.map((c) => ({ ...c }));
  }
  return [];
}

/** @deprecated gunakan NF_FISHING_DEFAULT_CATEGORIES */
export const ECOMMERCE_DEFAULT_CATEGORIES_LEGACY = [
  { id: "ec_in1", name: "Penjualan", type: "in", active: true, sort: 0 },
  { id: "ec_in2", name: "Ongkir masuk", type: "in", active: true, sort: 1 },
  { id: "ec_out1", name: "Modal / Kulakan", type: "out", active: true, sort: 0 },
  { id: "ec_out2", name: "Packing", type: "out", active: true, sort: 1 },
  { id: "ec_out3", name: "Ongkir", type: "out", active: true, sort: 2 },
  { id: "ec_out4", name: "Iklan", type: "out", active: true, sort: 3 },
  { id: "ec_out5", name: "Lain-lain", type: "out", active: true, sort: 4 },
];

export function hasFnBPurchasingCategories(categories = []) {
  return (categories || []).some((c) => {
    if (c?.role === "purchasing") return true;
    const n = (c?.name || "").trim().toLowerCase();
    return PURCHASING_FINAL_NAMES.has(n);
  });
}

/** Kategori awal untuk bisnis non-FNB — ganti katalog FNB yang ikut tersimpan. */
export function resolveCategoriesForBusiness(savedCats, business) {
  if (isFnBBusiness(business)) return null;
  const list = savedCats || [];
  if (
    !list.length
    || hasFnBPurchasingCategories(list)
    || isLegacyEcommerceCategoryList(list)
    || isDetailedNfCategoryList(list)
  ) {
    return ensureNfFishingCategories(defaultCategoriesForBusiness(business) || []);
  }
  return ensureNfFishingCategories(list);
}

/** Dompet operasional NF yang purchasing boleh pakai (nama lama manual / preset). */
export function isNfPurchasingOpsWallet(w) {
  if (!w || w.active === false) return false;
  if (w.purchasingUse === true) return true;
  const n = String(w.name || "").toLowerCase();
  return /dana\s*darurat|uang\s*makan|paylater|pay\s*later/.test(n);
}

export function visibleWalletsForBusiness(wallets, user, business) {
  let list = (wallets || []).filter((w) => w.active !== false);
  const role = user?.role || "kasir";
  const isShared = (w) => w?.type === "shared" || String(w?.id || "").startsWith("shared_");

  if (!isFnBBusiness(business)) {
    list = list.filter((w) => !isFnBOnlyWallet(w));
    if (role === "purchasing") {
      const uid = user?.id;
      const hasAssignment =
        !!uid &&
        list.some(
          (w) => !isShared(w) && Array.isArray(w?.allowedUserIds) && w.allowedUserIds.includes(uid)
        );
      const ops = hasAssignment
        ? list.filter((w) => Array.isArray(w?.allowedUserIds) && w.allowedUserIds.includes(uid))
        : list.filter((w) => !isShared(w) && isNfPurchasingOpsWallet(w));
      // Purchasing NF: dompet belanja + rekening Sam terhubung (write-through ke FNB).
      const sharedBanks = list.filter(isShared);
      const scoped = [...ops, ...sharedBanks];
      return scoped.sort(
        (a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || (a.name || "").localeCompare(b.name || "", "id")
      );
    }
  }

  return visibleWallets(list, user);
}

export function visibleCategoriesForBusiness(categories, user, txType, business) {
  if (isFnBBusiness(business)) {
    return visibleCategories(categories, user, txType);
  }
  const role = user?.role || "kasir";
  const list = categories || [];
  if (role === "purchasing") {
    return list.filter((c) => {
      if (c.active === false) return false;
      if (txType && c.type !== txType) return false;
      if (c.type !== "out") return false;
      if (c.nfKind === "prive" || c.nfKind === "transfer" || c.nfKind === "capex") return false;
      return c.purchasingUse === true || !c.nfKind;
    });
  }
  return visibleCategories(categories, user, txType);
}

export function visibleTransactionsForBusiness(transactions, wallets, user, business) {
  const scopedWallets = visibleWalletsForBusiness(wallets, user, business);
  return visibleTransactions(transactions, scopedWallets, user);
}

/** Overlay / layar yang hanya untuk Nusa Food F&B. */
export const FNB_ONLY_OVERLAYS = new Set([
  "settleLaporan",
  "sdmHarian",
  "laporanHarian",
  "sosmedHarian",
  "sosmedConfig",
  "voidReview",
  "outletTargets",
  "reportChannels",
  "laporanPurchasing",
  "asisten",
  "kategoriPurchasing",
  "purchasingAliases",
]);

export function isOverlayAllowedForBusiness(overlayName, business) {
  if (!overlayName || isFnBBusiness(business)) return true;
  return !FNB_ONLY_OVERLAYS.has(overlayName);
}

export function fnbFeatureLabel(overlayName) {
  const map = {
    settleLaporan: "Settle laporan omset kasir",
    sdmHarian: "SDM pagi outlet",
    laporanHarian: "Laporan omset harian",
    laporanPurchasing: "Laporan purchasing resto",
    asisten: "Asisten purchasing resto",
    kategoriPurchasing: "Kategori purchasing resto",
    purchasingAliases: "Alias purchasing resto",
  };
  return map[overlayName] || "Fitur resto F&B";
}

export { findCanonicalInList, resolveBusinessDisplayName, CANONICAL_DISPLAY_NAME };
