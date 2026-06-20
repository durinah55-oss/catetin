// lib/transactionNormalize.js — normalisasi field transaksi (camelCase + snake_case)

export function resolveWalletId(t) {
  if (!t) return null;
  return t.walletId || t.wallet_id || null;
}

export function resolveTransferIds(t) {
  return {
    from: t.fromWalletId || t.from_wallet_id || null,
    to: t.toWalletId || t.to_wallet_id || null,
  };
}

export function normalizeTransaction(t) {
  if (!t || typeof t !== "object") return t;
  const { from, to } = resolveTransferIds(t);
  return {
    ...t,
    walletId: resolveWalletId(t),
    categoryId: t.categoryId || t.category_id,
    fromWalletId: from,
    toWalletId: to,
  };
}

export function normalizeTransactions(transactions) {
  return (transactions || []).map(normalizeTransaction);
}
