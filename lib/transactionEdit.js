// lib/transactionEdit.js — edit/hapus transaksi owner, admin keuangan & purchasing

import { walletBalance } from "./kasirHarian.js";
import { resolveWalletId, resolveTransferIds, normalizeTransaction } from "./transactionNormalize.js";
import { isPurchasingTx } from "./purchasingExpense.js";
import {
  normalizePurchasingItems,
  itemsTotalFromList,
  formatPurchasingItemLine,
  purchasingTxTitle,
} from "./purchasingItems.js";

function walletAllowNegative(w) {
  return w?.type === "paylater" || w?.liability === true || w?.allowNegative === true;
}

export function getTransactionEditPolicy(tx, user) {
  if (!tx?.id) {
    return { canEdit: false, canDelete: false, reason: "Transaksi tidak valid." };
  }
  if (user?.role === "purchasing" && !isPurchasingTx(tx)) {
    return {
      canEdit: false,
      canDelete: false,
      reason: "Hanya transaksi belanja purchasing yang bisa diubah.",
    };
  }
  const src = (tx.source || "").toLowerCase();
  if (tx.dailyReportId) {
    if (/settle admin/.test(src)) {
      return {
        canEdit: false,
        canDelete: false,
        reason:
          "Transaksi settle laporan omset tidak bisa diubah di sini. Koreksi lewat proses verifikasi & settle kasir.",
      };
    }
    if (/laporan harian/.test(src)) {
      return {
        canEdit: false,
        canDelete: false,
        reason: "Transaksi dari laporan omset kasir. Minta kasir kirim revisi laporan.",
      };
    }
  }
  return { canEdit: true, canDelete: true, reason: null };
}

/** Daftar transaksi setelah satu entri diganti (untuk simulasi saldo). */
export function replaceTransactionInList(transactions, id, nextTx) {
  return (transactions || []).map((t) => (t.id === id ? nextTx : t));
}

export function validateTransactionUpdate(existing, patch, { wallets, transactions }) {
  if (!existing?.id) return "Transaksi tidak ditemukan.";
  const merged = normalizeTransaction({ ...existing, ...patch });
  const amount = Math.round(Number(merged.amount) || 0);
  if (amount <= 0) return "Nominal harus lebih dari 0.";

  if (merged.type === "transfer") {
    const { from, to } = resolveTransferIds(merged);
    if (!from || !to) return "Pilih dompet asal dan tujuan transfer.";
    if (from === to) return "Dompet asal dan tujuan tidak boleh sama.";
    const fromW = (wallets || []).find((w) => w.id === from);
    const nextList = replaceTransactionInList(transactions, existing.id, merged);
    const fromBal = walletBalance(from, wallets, nextList);
    if (fromW && !walletAllowNegative(fromW)) {
      const floor = fromW.floor || 0;
      if (fromBal < floor) {
        return floor > 0
          ? `Saldo ${fromW.name} di bawah floor setelah perubahan (min. Rp ${new Intl.NumberFormat("id-ID").format(floor)}).`
          : `Saldo ${fromW.name} tidak cukup setelah perubahan.`;
      }
    }
    return null;
  }

  if (merged.type === "out") {
    const wId = resolveWalletId(merged);
    const w = (wallets || []).find((x) => x.id === wId);
    const nextList = replaceTransactionInList(transactions, existing.id, merged);
    const bal = walletBalance(wId, wallets, nextList);
    if (w && !walletAllowNegative(w)) {
      const floor = w.floor || 0;
      if (bal < floor) {
        return floor > 0
          ? `Saldo ${w.name} di bawah floor setelah perubahan.`
          : `Saldo ${w.name} tidak cukup setelah perubahan.`;
      }
    }
    if (!merged.categoryId) return "Pilih kelompok belanja.";
    if (isPurchasingTx(merged) && !(merged.meta?.items?.length || merged.desc?.trim())) {
      return "Isi minimal satu barang dibeli.";
    }
    return null;
  }

  if (merged.type === "in") {
    if (!resolveWalletId(merged)) return "Pilih dompet tujuan pemasukan.";
    if (!merged.categoryId) return "Pilih kategori pemasukan.";
    return null;
  }

  return "Tipe transaksi tidak dikenali.";
}

export function buildTransactionPatch(form, existing) {
  const amount = Math.round(Number(form.amount) || 0);
  const base = {
    amount,
    date: form.date || existing.date,
    desc: form.desc ?? existing.desc ?? "",
  };

  if (existing.type === "transfer") {
    return {
      ...base,
      type: "transfer",
      fromWalletId: form.fromWalletId,
      toWalletId: form.toWalletId,
    };
  }

  return {
    ...base,
    type: existing.type,
    walletId: form.walletId,
    categoryId: form.categoryId,
    supplier: form.supplier ?? existing.supplier,
    ...(form.meta != null ? { meta: form.meta } : {}),
  };
}

export function transactionTypeLabel(type) {
  if (type === "in") return "Pemasukan";
  if (type === "out") return "Pengeluaran";
  if (type === "transfer") return "Transfer";
  return "Transaksi";
}

/** Hapus transaksi + catat tombstone agar tidak muncul lagi saat sync awan. */
export function applyTransactionDelete(state, id) {
  if (!state || !id) return;
  state.transactions = (state.transactions || []).filter((t) => t.id !== id);
  const tomb = new Set(state.deletedTransactionIds || []);
  tomb.add(id);
  state.deletedTransactionIds = [...tomb].slice(-1000);
}
