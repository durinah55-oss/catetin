// lib/walletDisplay.js — tampilan saldo dompet per role (UI purchasing)

/** Sembunyikan angka saldo dari staf purchasing (dompet tetap bisa dipilih). */
export function walletHidesBalanceFromPurchasing(w) {
  return w?.hide_balance === true || w?.hideBalanceFromPurchasing === true;
}

export function shouldHideWalletBalance(w, user) {
  if ((user?.role || "kasir") !== "purchasing") return false;
  return walletHidesBalanceFromPurchasing(w);
}

/** Label dompet + saldo untuk dropdown/kartu. Purchasing + hide_balance → nama saja. */
export function walletOptionLabel(w, bal, cur, user, fmtMoney) {
  if (shouldHideWalletBalance(w, user)) return w.name;
  if ((w?.type === "paylater" || w?.liability) && bal < 0) {
    return `${w.name} — Hutang ${fmtMoney(Math.abs(bal), cur)}`;
  }
  return `${w.name} — ${fmtMoney(bal, cur)}`;
}

/** Saldo untuk kartu dompet; null = jangan tampilkan angka. */
export function walletBalanceDisplay(w, bal, cur, user, fmtMoney) {
  if (shouldHideWalletBalance(w, user)) return null;
  if ((w?.type === "paylater" || w?.liability) && bal < 0) {
    return `Hutang ${fmtMoney(Math.abs(bal), cur)}`;
  }
  return fmtMoney(bal, cur);
}

/** Total saldo beranda — hanya dompet yang saldonya boleh dilihat purchasing. */
export function walletsForSaldoTotal(wallets, user) {
  return (wallets || []).filter((w) => !shouldHideWalletBalance(w, user));
}
