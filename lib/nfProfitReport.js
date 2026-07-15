// lib/nfProfitReport.js — laba rugi NF (terpisah arus kas & prive owner)

import { filterTransactions } from "./laporanKeuangan.js";
import { nfCategoryById, normalizeNfCategoryId } from "./nfCategoryCatalog.js";

function kindOf(cat) {
  return cat?.nfKind || null;
}

function sumTxAmount(txs) {
  return (txs || []).reduce((a, t) => a + (Number(t.amount) || 0), 0);
}

/**
 * Hitung ringkasan laba NF untuk periode.
 * @returns {{
 *   omzetKotor, potonganOmzet, omzetBersih, hpp, labaKotor,
 *   biayaMarketplace, biayaOperasional, labaBersih,
 *   arusMasuk, arusKeluar, arusBersih, prive, transfer, capex,
 *   warnings: string[]
 * }}
 */
export function computeNfProfit(transactions, categories, { start, end }) {
  const catMap = nfCategoryById(categories);
  const txs = filterTransactions(transactions, { start, end });
  const warnings = [];

  const byKind = {};
  const bucket = (kind, t) => {
    if (!kind) return;
    if (!byKind[kind]) byKind[kind] = [];
    byKind[kind].push(t);
  };

  for (const t of txs) {
    if (t.type !== "in" && t.type !== "out") continue;
    const cat = catMap.get(normalizeNfCategoryId(t.categoryId));
    bucket(kindOf(cat), t);
  }

  const grossIn = sumTxAmount(byKind.revenue_gross);
  const netIn = sumTxAmount(byKind.revenue_net);
  const deductions = sumTxAmount(byKind.revenue_deduction);

  let omzetKotor = 0;
  let omzetBersih = 0;

  if (grossIn > 0 && netIn > 0) {
    warnings.push("Ada pemasukan kotor dan bersih sekaligus — pilih satu cara pencatatan MP agar tidak dobel.");
    omzetKotor = grossIn;
    omzetBersih = grossIn - deductions;
  } else if (netIn > 0) {
    omzetBersih = netIn - deductions;
    omzetKotor = omzetBersih;
  } else {
    omzetKotor = grossIn;
    omzetBersih = grossIn - deductions;
  }

  const hpp = sumTxAmount(byKind.hpp);
  const labaKotor = omzetBersih - hpp;

  const marketplaceFee = sumTxAmount(byKind.marketplace_fee);
  if (netIn > 0 && marketplaceFee > 0) {
    warnings.push("Pemasukan MP sudah bersih — jangan catat biaya marketplace lagi (hindari dobel).");
  }

  const opex = sumTxAmount(byKind.opex);
  const biayaOperasional = opex;
  const labaBersih = labaKotor - marketplaceFee - biayaOperasional;

  const prive = sumTxAmount(byKind.prive);
  const transfer = sumTxAmount(byKind.transfer);
  const capex = sumTxAmount(byKind.capex);

  const arusMasuk = sumTxAmount(txs.filter((t) => t.type === "in"));
  const arusKeluar = sumTxAmount(txs.filter((t) => t.type === "out"));
  const arusBersih = arusMasuk - arusKeluar;

  return {
    omzetKotor,
    potonganOmzet: deductions,
    omzetBersih,
    hpp,
    labaKotor,
    biayaMarketplace: marketplaceFee,
    biayaOperasional,
    labaBersih,
    arusMasuk,
    arusKeluar,
    arusBersih,
    prive,
    transfer,
    capex,
    warnings,
  };
}
