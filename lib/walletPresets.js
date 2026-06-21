// lib/walletPresets.js — katalog dompet per tipe bisnis (onboarding tidak pakai F&B penuh semua)

import { CANONICAL_BUSINESS_ID } from "./canonicalBusiness.js";
import { sanitizeSharedLinks } from "./sharedWalletPolicy.js";

/** Nusa Food F&B — katalog lengkap (canonical saja). */
export const NF_FNB_WALLETS = [
  { id: "w_laci_kbu", name: "Laci KBU", type: "kas_fisik", outlet: "KBU", color: "#6366F1", opening: 250000, floor: 250000, active: true, sort: 10 },
  { id: "w_laci_ksm", name: "Laci Kisamen", type: "kas_fisik", outlet: "KSM", color: "#16A34A", opening: 250000, floor: 250000, active: true, sort: 20 },
  { id: "w_laci_smt", name: "Laci Samtaro", type: "kas_fisik", outlet: "SMT", color: "#D97706", opening: 250000, floor: 250000, active: true, sort: 30 },
  { id: "w_kas_besar", name: "NF Cash (Kas Besar)", type: "kas_fisik", outlet: null, color: "#0EA5E9", opening: 0, floor: 0, active: true, sort: 40 },
  { id: "w_pm", name: "Shopee Food", type: "digital", outlet: null, color: "#EE4D2D", opening: 0, floor: 0, active: true, sort: 50 },
  { id: "w_nf", name: "Grab Food", type: "digital", outlet: null, color: "#00B14F", opening: 0, floor: 0, active: true, sort: 51 },
  { id: "w_gofood", name: "Go Food", type: "digital", outlet: null, color: "#00AA13", opening: 0, floor: 0, active: true, sort: 52 },
  { id: "w_kas_kecil", name: "Kas Kecil Purchasing", type: "kas_fisik", outlet: null, color: "#8B5CF6", opening: 0, floor: 0, active: true, purchasingUse: true, sort: 60 },
  { id: "w_ops_kar", name: "Operasional Karyawan", type: "kas_fisik", outlet: null, color: "#EC4899", opening: 0, floor: 0, active: true, sort: 70 },
  { id: "w_shopeepay", name: "ShopeePay", type: "ewallet", outlet: null, color: "#EE4D2D", opening: 0, floor: 0, active: true, purchasingUse: true, sort: 80 },
  { id: "w_gojek", name: "Saldo Gojek", type: "ewallet", outlet: null, color: "#00AA13", opening: 0, floor: 0, active: true, purchasingUse: true, sort: 90 },
  { id: "w_shopee_paylater", name: "Shopee PayLater", type: "paylater", liability: true, allowNegative: true, outlet: null, color: "#B45309", opening: 0, floor: 0, active: true, purchasingUse: true, sort: 100 },
  { id: "w_bca", name: "BCA", type: "rekening", outlet: null, color: "#1D4ED8", opening: 0, floor: 0, active: true, ownerOnly: true, purchasingUse: true, hide_balance: true, sort: 110 },
  { id: "w_bri", name: "BRI", type: "rekening", outlet: null, color: "#DC2626", opening: 0, floor: 0, active: true, ownerOnly: true, purchasingUse: true, hide_balance: true, sort: 120 },
  { id: "w_mandiri", name: "Mandiri", type: "rekening", outlet: null, color: "#CA8A04", opening: 0, floor: 0, active: true, ownerOnly: true, purchasingUse: true, hide_balance: true, sort: 130 },
  { id: "w_bni", name: "BNI", type: "rekening", outlet: null, color: "#1E40AF", opening: 0, floor: 0, active: true, ownerOnly: true, purchasingUse: true, hide_balance: true, sort: 140 },
  { id: "w_owner", name: "Owner", type: "rekening", outlet: null, color: "#7C3AED", opening: 0, floor: 0, active: true, ownerOnly: true, sort: 150 },
];

/** E-commerce / marketplace — starter ringkas. */
export const ECOMMERCE_WALLETS = [
  { id: "w_kas", name: "Kas", type: "kas_fisik", outlet: null, color: "#16A34A", opening: 0, floor: 0, active: true, sort: 10 },
  { id: "w_bank", name: "Bank", type: "rekening", outlet: null, color: "#2563EB", opening: 0, floor: 0, active: true, sort: 20 },
  { id: "w_marketplace", name: "Saldo Marketplace", type: "ewallet", outlet: null, color: "#F97316", opening: 0, floor: 0, active: true, sort: 30 },
];

/** UMKM / toko umum — starter minimal. */
export const UMKM_WALLETS = [
  { id: "w_kas", name: "Kas", type: "kas_fisik", outlet: null, color: "#16A34A", opening: 0, floor: 0, active: true, sort: 10 },
  { id: "w_bank", name: "Bank", type: "rekening", outlet: null, color: "#2563EB", opening: 0, floor: 0, active: true, sort: 20 },
  { id: "w_qris", name: "QRIS / E-Wallet", type: "ewallet", outlet: null, color: "#7C3AED", opening: 0, floor: 0, active: true, sort: 30 },
];

export function getPresetWalletsForType(businessType) {
  if (businessType === "fnb") return NF_FNB_WALLETS.map((w) => ({ ...w }));
  if (businessType === "ecommerce") return ECOMMERCE_WALLETS.map((w) => ({ ...w }));
  return UMKM_WALLETS.map((w) => ({ ...w }));
}

/** Dompet default saat load — canonical NF pakai katalog F&B penuh. */
export function getWalletCatalogForBusiness(bizId, businessType) {
  if (bizId === CANONICAL_BUSINESS_ID) return NF_FNB_WALLETS.map((w) => ({ ...w }));
  return getPresetWalletsForType(businessType || "umkm");
}

/**
 * canonical = merge penuh (backward compat Nusa Food)
 * saved-only = hanya dompet yang disimpan owner — tidak inject 17 dompet F&B otomatis
 */
export function resolveWalletMergeMode(bizId, savedDoc) {
  if (bizId === CANONICAL_BUSINESS_ID && !savedDoc?.walletSetup?.initialized) {
    return "canonical";
  }
  if (savedDoc?.walletSetup?.initialized) return "saved-only";
  if (Array.isArray(savedDoc?.wallets) && savedDoc.wallets.length > 0) return "saved-only";
  return "preset";
}

export function createWalletSetupSeed(businessType) {
  return {
    initialized: true,
    businessType: businessType || "umkm",
    sharedLinks: [],
  };
}

/** Dompet mirror dari bisnis lain — default mati, owner aktifkan manual. Hanya rekening bank. */
export function createSharedWalletLink({
  sourceBusinessId,
  sourceBusinessName,
  sourceWalletId,
  sourceWalletName,
  sourceWalletType = "rekening",
}) {
  return {
    id: "sh_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    sourceBusinessId,
    sourceBusinessName: sourceBusinessName || "",
    sourceWalletId,
    sourceWalletName: sourceWalletName || "",
    sourceWalletType,
    linkKind: "rekening",
    label: sourceWalletName || "Rekening bersama",
    enabled: false,
  };
}

export function applySharedWalletLinks(wallets, walletSetup) {
  const base = wallets || [];
  const links = sanitizeSharedLinks(walletSetup?.sharedLinks).filter((l) => l.enabled);
  if (!links.length) return base;

  const virtual = links.map((link) => ({
    id: `shared_${link.id}`,
    name: `${link.label || link.sourceWalletName} ↗`,
    type: "shared",
    outlet: null,
    color: "#6B7280",
    opening: 0,
    floor: 0,
    active: true,
    sort: 9990,
    sharedLink: link,
    ownerOnly: true,
  }));

  return [...base, ...virtual];
}

/** Dompet nyata saja + mirror rekening bersama yang owner aktifkan. */
export function rebuildWalletsWithShared(wallets, walletSetup) {
  const base = (wallets || []).filter((w) => w.type !== "shared");
  const setup = walletSetup
    ? { ...walletSetup, sharedLinks: sanitizeSharedLinks(walletSetup.sharedLinks) }
    : walletSetup;
  return applySharedWalletLinks(base, setup);
}
