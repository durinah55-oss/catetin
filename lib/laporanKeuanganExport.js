// lib/laporanKeuanganExport.js — export PDF/CSV laporan masuk-keluar (bukan purchasing)

import { resolveTransferIds } from "./transactionNormalize.js";
import { foodWalletDisplayName } from "./wallets.js";

function formatRupiah(n) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);
}

function txTypeLabel(t) {
  if (t.type === "in") return "Masuk";
  if (t.type === "out") return "Keluar";
  if (t.type === "transfer") return "Transfer";
  return t.type || "—";
}

function walletLabel(t, walletMap, wallets) {
  if (t.type === "transfer") {
    const { from, to } = resolveTransferIds(t);
    return `${walletMap[from] || from || "—"} → ${walletMap[to] || to || "—"}`;
  }
  const w = wallets?.find((x) => x.id === (t.walletId || t.wallet_id));
  return w ? foodWalletDisplayName(w) : (walletMap[t.walletId || t.wallet_id] || "—");
}

export function exportKeuanganCsv(transactions, categories, wallets, bounds, periodLabel, businessName = "NF3") {
  const catMap = Object.fromEntries((categories || []).map((c) => [c.id, c.name]));
  const walletMap = Object.fromEntries((wallets || []).map((w) => [w.id, w.name]));
  const header = ["Tanggal", "Tipe", "Kategori", "Dompet", "Nominal", "Catatan", "Sumber"];
  const rows = (transactions || []).map((t) => [
    t.date || "",
    txTypeLabel(t),
    catMap[t.categoryId || t.category_id] || (t.type === "transfer" ? "Transfer" : "—"),
    walletLabel(t, walletMap, wallets),
    String(t.amount || 0),
    (t.desc || t.description || "").replace(/"/g, '""'),
    t.source || "",
  ]);
  const inSum = transactions.filter((t) => t.type === "in").reduce((s, t) => s + (t.amount || 0), 0);
  const outSum = transactions.filter((t) => t.type === "out").reduce((s, t) => s + (t.amount || 0), 0);
  rows.push([]);
  rows.push(["", "", "", "Total Masuk", String(inSum), "", ""]);
  rows.push(["", "", "", "Total Keluar", String(outSum), "", ""]);
  rows.push(["", "", "", "Laba Bersih", String(inSum - outSum), "", ""]);

  const csv = [header, ...rows]
    .map((r) => r.map((c) => `"${c}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = (periodLabel || "laporan").toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  a.href = url;
  a.download = `laporan-keuangan-${slug}-${bounds?.start || "export"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportKeuanganPdf(transactions, categories, wallets, bounds, periodLabel, businessName = "NF3") {
  let jsPDF, autoTable;
  try {
    const mod1 = await import("jspdf");
    const mod2 = await import("jspdf-autotable");
    jsPDF = mod1.jsPDF || mod1.default;
    autoTable = mod2.default || mod2.autoTable;
  } catch {
    throw new Error("Modul PDF belum tersedia. Refresh halaman atau gunakan export Excel (CSV).");
  }

  const catMap = Object.fromEntries((categories || []).map((c) => [c.id, c.name]));
  const walletMap = Object.fromEntries((wallets || []).map((w) => [w.id, w.name]));
  const inSum = transactions.filter((t) => t.type === "in").reduce((s, t) => s + (t.amount || 0), 0);
  const outSum = transactions.filter((t) => t.type === "out").reduce((s, t) => s + (t.amount || 0), 0);
  const net = inSum - outSum;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Laporan Keuangan — ${businessName}`, 14, 16);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Periode: ${periodLabel} (${bounds.start} s/d ${bounds.end})`, 14, 23);
  doc.text(`Masuk: ${formatRupiah(inSum)}  ·  Keluar: ${formatRupiah(outSum)}  ·  Laba: ${formatRupiah(net)}`, 14, 29);
  doc.text(`${transactions.length} transaksi · Dicetak: ${new Date().toLocaleString("id-ID")}`, 14, 35);

  autoTable(doc, {
    startY: 40,
    head: [["Tanggal", "Tipe", "Kategori", "Dompet", "Nominal", "Catatan"]],
    body: transactions.map((t) => [
      t.date || "—",
      txTypeLabel(t),
      catMap[t.categoryId || t.category_id] || (t.type === "transfer" ? "—" : "—"),
      walletLabel(t, walletMap, wallets),
      formatRupiah(t.amount),
      (t.desc || t.description || "").slice(0, 50),
    ]),
    foot: [["", "", "", "Laba bersih", formatRupiah(net), ""]],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255 },
    footStyles: { fillColor: [240, 240, 240], fontStyle: "bold" },
    columnStyles: { 4: { halign: "right" } },
  });

  const slug = (periodLabel || "laporan").toLowerCase().replace(/\s+/g, "-").slice(0, 40);
  doc.save(`laporan-keuangan-${slug}-${bounds?.start || "export"}.pdf`);
}
