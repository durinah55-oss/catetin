// lib/sharedWalletPolicy.js — mirror antar bisnis: rekening Sam + ops share (Uang NF / PayLater)

/** Kas resto / laci — tidak dishare via picker manual. */
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
  "w_kas",
  "w_marketplace",
  "w_qris",
  "w_owner",
]);

/** Dompet ops yang boleh dishare FNB↔Fishing (preset, bukan picker kasual). */
export const OPS_SHARE_SOURCE_IDS = new Set([
  "w1782220389555", // Uang NF (kas fisik di FNB)
  "w_shopee_paylater",
]);

export function isFnBCashWallet(w) {
  if (!w) return false;
  if (NON_SHAREABLE_WALLET_IDS.has(w.id)) return true;
  if (OPS_SHARE_SOURCE_IDS.has(w.id)) return true; // share hanya via linkKind ops_share
  if (w.type === "kas_fisik" || w.type === "ewallet" || w.type === "paylater" || w.type === "digital") {
    return true;
  }
  if (w.outlet) return true;
  if (/nf cash|kas besar|kas kecil|laci|purchasing|gofood|grab|shopee pay/i.test(w.name || "")) return true;
  return false;
}

/** Picker manual: hanya rekening bank. Ops share lewat preset Fishing. */
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
  // Jangan pernah mirror Kas Besar FNB.
  if (link.linkKind === "nf_cash" || link.sourceWalletId === "w_kas_besar") return false;

  // Preset ops: Uang NF + Shopee PayLater dari FNB.
  if (link.linkKind === "ops_share" && OPS_SHARE_SOURCE_IDS.has(link.sourceWalletId)) {
    return true;
  }

  if (link.sourceWalletType && link.sourceWalletType !== "rekening") return false;
  if (NON_SHAREABLE_WALLET_IDS.has(link.sourceWalletId) || OPS_SHARE_SOURCE_IDS.has(link.sourceWalletId)) {
    return false;
  }
  if (link.linkKind && link.linkKind !== "rekening") return false;
  return true;
}

export function sanitizeSharedLinks(links) {
  return (links || []).filter(sanitizeSharedLink);
}

export const SHARED_WALLET_POLICY_HINT =
  "Terhubung dari Nusa Food: Uang NF, Shopee PayLater, dan rekening Sam (BCA/BRI/Mandiri/BNI). Kas Besar resto tetap terpisah.";
