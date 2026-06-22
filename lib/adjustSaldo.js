// lib/adjustSaldo.js — penyesuaian saldo dompet ke nominal fisik/rekening

import { normalizeTransaction } from "./transactionNormalize.js";

export function pickAdjustmentCategory(categories, type) {
  return (
    (categories || []).find(
      (c) => c.type === type && c.active !== false && /penyesuaian|lain/i.test(c.name)
    )
    || (categories || []).find((c) => c.type === type && c.active !== false)
  );
}

/** Hitung delta penyesuaian ke target. */
export function computeBalanceAdjustment(currentBal, targetNum) {
  const bal = Math.round(Number(currentBal) || 0);
  const target = Math.round(Number(targetNum) || 0);
  if (!(target > 0)) return { ok: false, reason: "Masukkan saldo fisik / rekening yang benar." };
  const delta = target - bal;
  if (delta === 0) return { ok: false, reason: "Saldo sistem sudah sama dengan target — tidak perlu penyesuaian." };
  return {
    ok: true,
    delta,
    isIn: delta > 0,
    amount: Math.abs(delta),
    target,
    current: bal,
  };
}

function walletAllowNegative(w) {
  return w?.type === "paylater" || w?.liability === true || w?.allowNegative === true;
}

/** Validasi target vs floor dompet. */
export function validateBalanceAdjustmentTarget(wallet, targetNum) {
  if (!wallet) return "Dompet tidak valid.";
  const target = Math.round(Number(targetNum) || 0);
  const floor = Math.round(Number(wallet.floor) || 0);
  if (walletAllowNegative(wallet)) return null;
  if (floor > 0 && target < floor) {
    return `Saldo target di bawah floor dompet (min. Rp ${new Intl.NumberFormat("id-ID").format(floor)}). Untuk koreksi besar, hapus laporan omset yang ngawur dulu.`;
  }
  return null;
}

/** Buat transaksi penyesuaian + patch state. */
export function applyBalanceAdjustment(state, { walletId, targetNum, categories, date, currentBal }) {
  const wallet = (state.wallets || []).find((w) => w.id === walletId);
  if (!wallet) throw new Error("Dompet tidak ditemukan.");

  const floorErr = validateBalanceAdjustmentTarget(wallet, targetNum);
  if (floorErr) throw new Error(floorErr);

  const computed = computeBalanceAdjustment(currentBal, targetNum);
  if (!computed.ok) throw new Error(computed.reason);

  const cat = pickAdjustmentCategory(categories, computed.isIn ? "in" : "out");
  if (!cat) throw new Error("Kategori penyesuaian tidak ditemukan.");

  const tx = normalizeTransaction({
    id: "t" + Date.now() + Math.random().toString(36).slice(2, 5),
    type: computed.isIn ? "in" : "out",
    amount: computed.amount,
    walletId,
    categoryId: cat.id,
    desc: "Penyesuaian saldo manual",
    date: date || new Date().toISOString().slice(0, 10),
    source: "Sesuaikan Saldo",
  });

  if (!state.transactions) state.transactions = [];
  state.transactions.push(tx);

  return { tx, target: computed.target, delta: computed.delta };
}
