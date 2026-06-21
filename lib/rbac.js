// lib/rbac.js
// Aturan role NF3 (sumber kebenaran permission & navigasi)
//
// owner       — semua bisa atur + undang staf + rekening bank
// admin       — hampir semua (settle, dompet, transfer) TANPA undang staf; review void via beranda (bukan tab Void)
// purchasing  — belanja; transaksi out REAL (kurangi saldo dompet sumber). Dompet terbatas via flag purchasingUse
// kasir+outlet — KBU / KSM / SMT: SDM, omset, sosmed, void INPUT (tab Void khusus outlet)

import { resolveWalletId, resolveTransferIds } from "./transactionNormalize.js";
import { PURCHASING_FINAL_NAMES } from "./purchasingCategories.js";

export const ROLES = { owner: 4, admin: 3, kasir: 2, purchasing: 1 };

export function canDo(role, action) {
  const r = role || "kasir";
  const perms = {
    transfer: ["owner", "admin"],
    settleLaci: ["owner", "admin"],
    kelolaDompet: ["owner", "admin"],
    editSaldoDompet: ["owner", "admin"],
    kelolaKategoriSemua: ["owner", "admin"],
    kelolaKategoriSendiri: ["owner", "admin", "kasir", "purchasing"],
    lihatRekening: ["owner", "admin"],
    lihatAnalisis: ["owner", "admin"],
    lihatLaporanPenuh: ["owner", "admin"],
    inputLaporanHarian: ["kasir"],
    inputSosmedReport: ["owner", "admin", "kasir"],
    /** Tab Void — HANYA kasir outlet */
    inputVoid: ["kasir"],
    lihatVoidLog: ["admin", "kasir"],
    /** Review void — admin via kartu beranda, BUKAN tab Void */
    reviewVoidLog: ["admin"],
    inputIncome: ["owner", "admin"],
    inputExpense: ["owner", "admin", "kasir", "purchasing"],
    kelolaStaf: ["owner", "admin"],
    kelolaTransaksi: ["owner", "admin"],
    undangStaf: ["owner"],
    hubungkanWeb: ["owner", "admin"],
    kirimPengumuman: ["owner", "admin"],
  };
  return (perms[action] || []).includes(r);
}

/** Edit/hapus transaksi di Laporan — owner/admin semua; purchasing hanya belanja sendiri. */
export function canManageTransactions(role) {
  return canDo(role, "kelolaTransaksi") || role === "purchasing";
}

/** Tab Void di bottom nav — hanya kasir outlet. */
export function showVoidTab(role) {
  return role === "kasir";
}

/** Tab Analisis di bottom nav. */
export function showAnalisisTab(role) {
  return canDo(role, "lihatAnalisis");
}

/** Tab Asisten Purchasing — hanya role purchasing (owner/admin via kartu Beranda). */
export function showPurchasingAsistenTab(role) {
  return role === "purchasing";
}

/** Kartu Tanya Purchasing di Beranda — owner/admin saja (bukan tab terpisah). */
export function showPurchasingAsistenBeranda(role) {
  return role !== "purchasing" && canDo(role, "kelolaKategoriSemua");
}

/** Bisa buka overlay / API asisten purchasing. */
export function canUsePurchasingAsisten(role) {
  return showPurchasingAsistenTab(role) || showPurchasingAsistenBeranda(role);
}

/** Dompet yang purchasing boleh pakai belanja (saldo real berkurang). */
export const PURCHASING_WALLET_IDS = new Set([
  "w_kas_kecil",
  "w_shopeepay",
  "w_gojek",
  "w_shopee_paylater",
  "w_bca",
  "w_bri",
  "w_mandiri",
  "w_bni",
]);

export function isPurchasingWallet(w) {
  if (!w || w.active === false) return false;
  if (w.purchasingUse === true) return true;
  if (PURCHASING_WALLET_IDS.has(w.id)) return true;
  if (/kas\s*kecil/i.test(w.name || "")) return true;
  if (w.type === "rekening" && w.id !== "w_owner") return true;
  if (w.type === "ewallet" || w.type === "paylater") return true;
  return false;
}

/** Dompet yang boleh dipakai purchasing untuk catat belanja (transaksi out → saldo berkurang). */
export function purchasingWallets(wallets) {
  return (wallets || []).filter(isPurchasingWallet);
}

export function visibleWallets(wallets, user) {
  const role = user?.role || "kasir";
  const filtered = (wallets || []).filter((w) => {
    if (w.active === false) return false;
    if (role === "kasir") return w.outlet === user.outlet;
    if (role === "purchasing") return isPurchasingWallet(w);
    if (w.ownerOnly && !canDo(role, "lihatRekening")) return false;
    return true;
  });
  return filtered.sort((a, b) => (a.sort ?? 9999) - (b.sort ?? 9999) || (a.name || "").localeCompare(b.name || "", "id"));
}

export function visibleCategories(categories, user, txType) {
  const role = user?.role || "kasir";
  return (categories || []).filter((c) => {
    if (c.active === false) return false;
    if (txType && c.type !== txType) return false;

    if (role === "owner" || role === "admin") return true;

    if (role === "kasir") {
      if (c.type === "in") return false;
      if (!c.role) return c.type === "out";
      if (c.role === "kasir") return !c.outlet || c.outlet === user.outlet;
      return false;
    }

    if (role === "purchasing") {
      if (c.type === "in") return false;
      if (c.role !== "purchasing") return false;
      return PURCHASING_FINAL_NAMES.has((c.name || "").trim().toLowerCase());
    }

    return false;
  });
}

/** Dompet kas kecil purchasing — satu-satunya sumber saldo & pemasukan yang purchasing lihat. */
export function isKasKecilWallet(w) {
  if (!w) return false;
  if (w.id === "w_kas_kecil") return true;
  return /kas\s*kecil/i.test(w.name || "");
}

/**
 * Transaksi yang boleh tampil untuk purchasing:
 * - pengeluaran belanja (out) dari dompet purchasing
 * - pemasukan/transfer HANYA ke Kas Kecil (dana dari admin keuangan)
 * - BUKAN pemasukan settlement ke BRI/bank
 */
export function purchasingVisibleTransaction(t, wallets) {
  if (!t) return false;

  if (t.type === "out") {
    const w = (wallets || []).find((x) => x.id === resolveWalletId(t));
    return isPurchasingWallet(w);
  }

  if (t.type === "in") {
    const w = (wallets || []).find((x) => x.id === resolveWalletId(t));
    return isKasKecilWallet(w);
  }

  if (t.type === "transfer") {
    const { to } = resolveTransferIds(t);
    const toW = (wallets || []).find((x) => x.id === to);
    return isKasKecilWallet(toW);
  }

  return false;
}

export function visibleTransactions(transactions, wallets, user) {
  const role = user?.role || "kasir";

  if (role === "purchasing") {
    return (transactions || []).filter((t) => purchasingVisibleTransaction(t, wallets));
  }

  const allowedWalletIds = new Set(visibleWallets(wallets, user).map((w) => w.id));
  return (transactions || []).filter((t) => {
    if (t.type === "transfer") {
      const { from, to } = resolveTransferIds(t);
      return allowedWalletIds.has(from) || allowedWalletIds.has(to);
    }
    return allowedWalletIds.has(resolveWalletId(t));
  });
}

export const ROLE_LABEL = {
  owner: "Owner",
  admin: "Admin Keuangan",
  kasir: "Kasir",
  purchasing: "Purchasing",
};
