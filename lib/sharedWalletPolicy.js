// lib/sharedWalletPolicy.js — mirror antar bisnis: HANYA rekening bank

/** Kas NF / laci / e-wallet — ekosistem F&B atau bisnis masing-masing, tidak dishare. */
const NON_SHAREABLE_WALLET_IDS = new Set([
  "w_kas_besar",
  "w_kas_kecil",
  "w_laci_kbu",
  "w_laci_ksm",
  "w_laci_smt",
  "w_pm",
  "w_nf",
  "w_gofood",
  "w_ops_kar",
  "w_shopeepay",
  "w_gojek",
  "w_shopee_paylater",
  "w_kas",
  "w_marketplace",
  "w_qris",
  "w_owner",
]);

export function isFnBCashWallet(w) {
  if (!w) return false;
  if (NON_SHAREABLE_WALLET_IDS.has(w.id)) return true;
  if (w.type === "kas_fisik" || w.type === "ewallet" || w.type === "paylater" || w.type === "digital") {
    return true;
  }
  if (w.outlet) return true;
  if (/nf cash|kas besar|kas kecil|laci|purchasing|gofood|grab|shopee pay/i.test(w.name || "")) return true;
  return false;
}

/** Hanya rekening bank operasional (BCA/BRI/Mandiri/BNI/Bank) boleh dihubungkan antar bisnis. */
export function isCrossBusinessShareableWallet(w) {
  if (!w || w.active === false) return false;
  if (isFnBCashWallet(w)) return false;
  if (w.type !== "rekening") return false;
  if (w.id === "w_owner") return false;
  return true;
}

export function filterShareableRemoteWallets(wallets) {
  return (wallets || []).filter(isCrossBusinessShareableWallet);
}

export function sanitizeSharedLink(link) {
  if (!link?.sourceWalletId) return false;
  if (link.sourceWalletType && link.sourceWalletType !== "rekening") return false;
  if (NON_SHAREABLE_WALLET_IDS.has(link.sourceWalletId)) return false;
  if (link.linkKind && link.linkKind !== "rekening") return false;
  return true;
}

export function sanitizeSharedLinks(links) {
  return (links || []).filter(sanitizeSharedLink);
}

export const SHARED_WALLET_POLICY_HINT =
  "Hanya rekening bank (BCA, BRI, Mandiri, BNI, dll.) yang boleh dihubungkan. NF Cash/Kas Besar, laci outlet, kas kecil, dan e-wallet tetap terpisah per ekosistem bisnis.";
