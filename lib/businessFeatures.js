// lib/businessFeatures.js — fitur & dompet per tipe bisnis (F&B vs e-commerce vs UMKM)

import {
  isCanonicalBusiness,
  CANONICAL_DISPLAY_NAME,
  findCanonicalInList,
  resolveBusinessDisplayName,
} from "./canonicalBusiness.js";
import { NF_FNB_WALLETS } from "./walletPresets.js";
import { visibleWallets, visibleTransactions } from "./rbac.js";

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

/** Dompet khusus resto (laci outlet, purchasing, marketplace makanan, dll.). */
export function isFnBOnlyWallet(w) {
  if (!w) return false;
  if (w.type === "shared") return true;
  if (w.outlet && ["KBU", "KSM", "SMT"].includes(w.outlet)) return true;
  if (FNB_WALLET_IDS.has(w.id)) return true;
  if (ECOMMERCE_WALLET_IDS.has(w.id)) return false;
  if (/laci|kasir|purchasing|gofood|grab|shopee food/i.test(w.name || "")) return true;
  return false;
}

export function visibleWalletsForBusiness(wallets, user, business) {
  const base = visibleWallets(wallets, user);
  if (isFnBBusiness(business)) return base;
  return base.filter((w) => !isFnBOnlyWallet(w));
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
    laporanPurchasing: "Laporan purchasing",
    asisten: "Asisten purchasing",
  };
  return map[overlayName] || "Fitur resto F&B";
}

export { findCanonicalInList, resolveBusinessDisplayName, CANONICAL_DISPLAY_NAME };
