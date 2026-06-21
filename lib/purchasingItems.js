// lib/purchasingItems.js — label & normalisasi baris item belanja (bukan kategori)

import { formatRupiah } from "./purchasingExpense.js";

export function normalizePurchasingItems(items) {
  return (items || [])
    .filter((i) => i?.name && String(i.name).trim())
    .map((i) => {
      const qty = Number(i.qty) || 0;
      const unitPrice = Number(i.unitPrice) || 0;
      const subtotal = Math.round(Number(i.subtotal) || qty * unitPrice || 0);
      return {
        name: String(i.name).trim(),
        qty,
        unit: String(i.unit || "pcs").trim() || "pcs",
        unitPrice,
        subtotal,
      };
    });
}

/** Satu baris item — contoh: "Ubi ungu · 2 kg · Rp10.000" */
export function formatPurchasingItemLine(item) {
  if (!item?.name) return "";
  const qty = Number(item.qty) || 0;
  const unit = item.unit || "pcs";
  const sub = Math.round(Number(item.subtotal) || qty * (Number(item.unitPrice) || 0) || 0);
  const parts = [item.name.trim()];
  if (qty) parts.push(`${qty} ${unit}`);
  if (sub > 0) parts.push(formatRupiah(sub));
  return parts.join(" · ");
}

/** Judul transaksi belanja — item dulu, bukan kategori. */
export function purchasingTxTitle(tx) {
  const items = normalizePurchasingItems(tx?.meta?.items);
  if (items.length === 1) return formatPurchasingItemLine(items[0]);
  if (items.length > 1) {
    const lines = items.slice(0, 2).map((i) => i.name);
    const rest = items.length - lines.length;
    return rest > 0 ? `${lines.join(", ")} +${rest} item` : lines.join(", ");
  }
  const desc = (tx?.desc || "").trim();
  if (desc) return desc;
  if (tx?.supplier) return `Belanja · ${tx.supplier}`;
  return "Belanja";
}

/** Subjudul — kategori hanya sebagai kelompok akuntansi. */
export function purchasingTxSubtitle(tx, cat, wallet) {
  const parts = [];
  if (cat?.name) parts.push(cat.name);
  if (tx?.supplier && !purchasingTxTitle(tx).includes(tx.supplier)) parts.push(tx.supplier);
  if (wallet?.name) parts.push(wallet.name);
  return parts.filter(Boolean).join(" · ") || "—";
}

export function itemsTotalFromList(items) {
  return normalizePurchasingItems(items).reduce((s, i) => s + (i.subtotal || 0), 0);
}
