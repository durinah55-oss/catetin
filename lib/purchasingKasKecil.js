// lib/purchasingKasKecil.js — saldo & alur kas kecil purchasing per hari

import { walletBalance } from "./kasirHarian.js";
import { resolveWalletId, resolveTransferIds } from "./transactionNormalize.js";
import { isPurchasingTx } from "./purchasingExpense.js";

export const KAS_KECIL_ID = "w_kas_kecil";

function isoDayBefore(iso) {
  if (!iso) return iso;
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Saldo dompet sampai akhir tanggal (inklusif). */
export function walletBalanceAtDate(walletId, wallets, transactions, asOfDate) {
  const filtered = (transactions || []).filter((t) => (t.date || "") <= asOfDate);
  return walletBalance(walletId, wallets, filtered);
}

/** Ringkasan alur kas kecil untuk satu hari — cocok dengan cara purchasing hitung manual. */
export function kasKecilDaySummary(wallets, transactions, date) {
  const prev = isoDayBefore(date);
  const opening = walletBalanceAtDate(KAS_KECIL_ID, wallets, transactions, prev);
  const dayTxs = (transactions || []).filter((t) => t.date === date);

  let transfersIn = 0;
  let belanjaOut = 0;
  for (const t of dayTxs) {
    if (t.type === "transfer") {
      const { to } = resolveTransferIds(t);
      if (to === KAS_KECIL_ID) transfersIn += t.amount || 0;
    } else if (
      t.type === "out" &&
      isPurchasingTx(t) &&
      resolveWalletId(t) === KAS_KECIL_ID
    ) {
      belanjaOut += t.amount || 0;
    }
  }

  const closing = opening + transfersIn - belanjaOut;
  const ledger = walletBalanceAtDate(KAS_KECIL_ID, wallets, transactions, date);

  return { opening, transfersIn, belanjaOut, closing, ledger, prevDate: prev };
}

/** Deteksi transfer duplikat ke kas kecil (amount + from + to + tanggal sama). */
export function findDuplicateKasKecilTransfers(transactions) {
  const groups = new Map();
  for (const t of transactions || []) {
    if (t.type !== "transfer") continue;
    const { from, to } = resolveTransferIds(t);
    if (to !== KAS_KECIL_ID) continue;
    const key = `${t.date}|${from}|${to}|${t.amount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  const dupes = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => String(a.id).localeCompare(String(b.id)));
    dupes.push(...sorted.slice(1));
  }
  return dupes;
}
