#!/usr/bin/env node
/**
 * Import data pengeluaran Excel → app_state.data.transactions[] (referensi AI only).
 *
 * Preview (default):
 *   node scripts/importPurchasingExcel.mjs "path/Pengeluaran_F_B.xlsx" --biz=<uuid>
 *
 * Execute (setelah Sam approve preview):
 *   node scripts/importPurchasingExcel.mjs "path/Pengeluaran_F_B.xlsx" --biz=<uuid> --execute
 *
 * Env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createHash } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const BATCH_ID = "excel_fnb_2025";
const SHEET_NAME = "2. Cashflow";
const DATA_START_ROW = 7; // baris ke-7 (1-based), header di atas

const COL = {
  TGL: 1,
  JENIS: 2,
  QTY: 3,
  SATUAN: 4,
  DESKRIPSI: 5,
  CHANNEL: 6,
  KAS_MAHMUD: 9,
  KAS_ADEL: 11,
  EWALLET: 13,
};

const OUTLET_FROM_JENIS = new Map([
  ["kopi buri umah", "KBU"],
  ["kisamen", "KSM"],
  ["samtaro", "SMT"],
  ["gudang pusat", "GUDANG"],
  ["gudang pusat / office", "GUDANG"],
  ["office", "GUDANG"],
]);

const CATEGORY_FROM_JENIS = new Map([
  ["maintanance", "Peralatan & Perbaikan"],
  ["maintenance", "Peralatan & Perbaikan"],
  ["asset", "Pembelian Aset"],
  ["gaji", "Gaji & Upah"],
  ["transportasi", "Transport & Ongkos Belanja"],
  ["atk", "Kebutuhan Operasional"],
  ["konsumsi", "Kebutuhan Operasional"],
  ["makan team", "Kebutuhan Operasional"],
  ["kebersihan", "Kebutuhan Operasional"],
  ["kenyamanan outlet", "Kebutuhan Operasional"],
  ["packaging f&b", "Kemasan"],
  ["packaging f&amp;b", "Kemasan"],
  ["peralatan outlet", "Peralatan & Perbaikan"],
  ["signage outlet", "Promosi"],
  ["sosial", "Lain-lain"],
  ["lainnya", "Lain-lain"],
  ["lainnya / kas kecil / lainnya", "Lain-lain"],
]);

const SKIP_JENIS = new Set(["kas kecil"]);

const DESC_CATEGORY_RULES = [
  { re: /tabung gas|gas lpg|\blpg\b/i, cat: "Gas LPG" },
  { re: /cup|mangkuk|plastik|paper bag|sendok|kemasan|bungkus|packaging|thermal|paper bowl/i, cat: "Kemasan" },
  { re: /bensin|parkir|ongkir|ongkos ambil|ongkos ke pasar|transport/i, cat: "Transport & Ongkos Belanja" },
  { re: /kulkas|freezer|\bac\b|mesin kopi|laptop|tablet|meja besar/i, cat: "Pembelian Aset" },
  { re: /servis|perbaikan|pisau|baskom|keran|kompor/i, cat: "Peralatan & Perbaikan" },
  { re: /listrik|token listrik|wifi|internet|\bpln\b/i, cat: "Listrik, Air & Internet" },
  { re: /gaji|upah harian|tunjangan/i, cat: "Gaji & Upah" },
  { re: /sewa|kontrakan|ruko/i, cat: "Sewa Tempat" },
  { re: /iklan|banner|endorse|promosi/i, cat: "Promosi" },
];

// ── Env ─────────────────────────────────────────────────────────────────────

function loadEnvLocal() {
  const envPath = join(ROOT, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function parseArgs(argv) {
  const positional = [];
  let bizId = null;
  let execute = false;
  let outPath = null;

  for (const arg of argv) {
    if (arg === "--execute") execute = true;
    else if (arg.startsWith("--biz=")) bizId = arg.slice(6);
    else if (arg.startsWith("--out=")) outPath = arg.slice(6);
    else if (!arg.startsWith("-")) positional.push(arg);
  }

  return {
    excelPath: positional[0] ? resolve(positional[0]) : null,
    bizId,
    execute,
    outPath,
  };
}

// ── Parse helpers ───────────────────────────────────────────────────────────

function normKey(v) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cellStr(row, idx) {
  const v = row?.[idx];
  if (v == null) return "";
  return String(v).trim();
}

function parseNominal(row) {
  for (const idx of [COL.KAS_MAHMUD, COL.KAS_ADEL, COL.EWALLET]) {
    const raw = row[idx];
    if (raw == null || raw === "") continue;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.round(Math.abs(n));
  }
  return 0;
}

/** Kolom Excel → dompet NF3 (untuk saldo real). */
const PAYMENT_COLUMN_WALLET = new Map([
  [COL.KAS_MAHMUD, "w_kas_kecil"],
  [COL.KAS_ADEL, "w_kas_kecil"],
  [COL.EWALLET, "w_shopeepay"],
]);

function parseNominalAndWallet(row) {
  for (const [idx, walletId] of PAYMENT_COLUMN_WALLET) {
    const raw = row[idx];
    if (raw == null || raw === "") continue;
    const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(/[^\d.-]/g, ""));
    if (Number.isFinite(n) && n > 0) {
      return { amount: Math.round(Math.abs(n)), walletId, paymentColumn: idx };
    }
  }
  return { amount: 0, walletId: null, paymentColumn: null };
}

function parseQty(row) {
  const raw = row[COL.QTY];
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function excelDateToIso(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") {
    const dc = XLSX.SSF.parse_date_code(v);
    if (dc) {
      const d = new Date(Date.UTC(dc.y, dc.m - 1, dc.d));
      return d.toISOString().slice(0, 10);
    }
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

function mapOutletAndCategory(jenisRaw) {
  const key = normKey(jenisRaw);
  if (!key) return { outlet: "GUDANG", categoryName: "Lain-lain", jenisKey: key };

  if (SKIP_JENIS.has(key)) {
    return { outlet: null, categoryName: null, jenisKey: key, skip: true, skipReason: "kas_kecil" };
  }

  if (OUTLET_FROM_JENIS.has(key)) {
    return {
      outlet: OUTLET_FROM_JENIS.get(key),
      categoryName: "Bahan Baku",
      jenisKey: key,
    };
  }

  const cat = CATEGORY_FROM_JENIS.get(key) || "Lain-lain";
  return { outlet: "GUDANG", categoryName: cat, jenisKey: key };
}

function refineCategory(categoryName, desc) {
  if (!desc) return categoryName;
  for (const { re, cat } of DESC_CATEGORY_RULES) {
    if (re.test(desc)) return cat;
  }
  return categoryName;
}

function makeImportId(date, desc, amount) {
  const h = createHash("sha256")
    .update(`${date}|${desc}|${amount}`)
    .digest("hex")
    .slice(0, 16);
  return `imp_${h}`;
}

function findCategoryId(categories, categoryName) {
  if (!categoryName) return null;
  const key = categoryName.trim().toLowerCase();
  const hit = (categories || []).find(
    (c) =>
      c.type === "out" &&
      c.role === "purchasing" &&
      String(c.name || "").trim().toLowerCase() === key
  );
  return hit?.id ?? null;
}

// ── Row transform ───────────────────────────────────────────────────────────

function transformRow(row, rowNum) {
  const deskripsi = cellStr(row, COL.DESKRIPSI);
  const channel = cellStr(row, COL.CHANNEL);
  const jenisRaw = cellStr(row, COL.JENIS);
  const satuan = cellStr(row, COL.SATUAN) || null;
  const qty = parseQty(row);
  const { amount, walletId, paymentColumn } = parseNominalAndWallet(row);
  const date = excelDateToIso(row[COL.TGL]);

  if (!deskripsi) return { skip: true, skipReason: "deskripsi_kosong", rowNum };
  if (!amount) return { skip: true, skipReason: "nominal_nol", rowNum, deskripsi };
  if (!date) return { skip: true, skipReason: "tanggal_invalid", rowNum, deskripsi };

  const mapped = mapOutletAndCategory(jenisRaw);
  if (mapped.skip) return { skip: true, skipReason: mapped.skipReason, rowNum, deskripsi };

  let categoryName = refineCategory(mapped.categoryName, deskripsi);

  const tx = {
    id: makeImportId(date, deskripsi, amount),
    type: "out",
    amount,
    date,
    desc: deskripsi,
    categoryId: null,
    walletId,
    outlet: mapped.outlet,
    supplier: channel || null,
    module: "purchasing",
    source: "purchasing:import",
    meta: {
      items: [
        {
          name: deskripsi,
          qty,
          unit: satuan,
          unitPrice: null,
          subtotal: null,
        },
      ],
      importBatch: BATCH_ID,
      paymentColumn,
      verified: false,
      excelRow: rowNum,
      excelJenis: jenisRaw,
      mappedCategory: categoryName,
    },
  };

  return { tx, rowNum, categoryName };
}

// ── Read Excel ──────────────────────────────────────────────────────────────

function readExcelRows(excelPath) {
  if (!existsSync(excelPath)) {
    throw new Error(`File tidak ditemukan: ${excelPath}`);
  }
  const wb = XLSX.readFile(excelPath, { cellDates: true });
  const sheet = wb.Sheets[SHEET_NAME];
  if (!sheet) {
    const names = wb.SheetNames.join(", ");
    throw new Error(`Sheet "${SHEET_NAME}" tidak ditemukan. Tersedia: ${names}`);
  }
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  return rows.slice(DATA_START_ROW - 1);
}

// ── Summary ─────────────────────────────────────────────────────────────────

function buildSummary(transactions, skipped) {
  const byOutlet = {};
  const byCategory = {};
  const bySupplier = {};
  let totalNominal = 0;

  for (const t of transactions) {
    totalNominal += t.amount;
    byOutlet[t.outlet] = (byOutlet[t.outlet] || 0) + 1;
    const cat = t.meta.mappedCategory || "?";
    byCategory[cat] = (byCategory[cat] || 0) + 1;
    const sup = t.supplier || "(kosong)";
    bySupplier[sup] = (bySupplier[sup] || 0) + 1;
  }

  const topSuppliers = Object.entries(bySupplier)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  const skipReasons = {};
  for (const s of skipped) {
    skipReasons[s.skipReason] = (skipReasons[s.skipReason] || 0) + 1;
  }

  return {
    totalRowsParsed: transactions.length + skipped.length,
    totalImported: transactions.length,
    totalSkipped: skipped.length,
    skipReasons,
    totalNominal,
    totalNominalFormatted: `Rp${totalNominal.toLocaleString("id-ID")}`,
    byOutlet,
    byCategory,
    topSuppliers,
  };
}

// ── Supabase app_state ──────────────────────────────────────────────────────

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib di .env.local");
  }
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function loadAppStateDoc(admin, bizId) {
  const { data, error } = await admin
    .from("app_state")
    .select("data, updated_at")
    .eq("business_id", bizId)
    .maybeSingle();
  if (error) throw new Error(`[loadAppState] ${error.message}`);
  return data;
}

async function saveAppStateDoc(admin, bizId, data) {
  const { error } = await admin.from("app_state").upsert(
    {
      business_id: bizId,
      data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "business_id" }
  );
  if (error) throw new Error(`[saveAppState] ${error.message}`);
}

async function executeImport(bizId, newTxs) {
  const admin = getAdmin();
  const doc = await loadAppStateDoc(admin, bizId);
  if (!doc?.data) throw new Error(`app_state kosong untuk business_id ${bizId}`);

  const data = doc.data;
  const categories = data.categories || [];
  const existing = data.transactions || [];
  const existingIds = new Set(existing.map((t) => t.id));

  let added = 0;
  let deduped = 0;

  for (const tx of newTxs) {
    if (existingIds.has(tx.id)) {
      deduped++;
      continue;
    }
    const catName = tx.meta.mappedCategory;
    tx.categoryId = findCategoryId(categories, catName);
    existing.push(tx);
    existingIds.add(tx.id);
    added++;
  }

  data.transactions = existing;
  await saveAppStateDoc(admin, bizId, data);

  return { added, deduped, totalTransactions: existing.length };
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  loadEnvLocal();
  const { excelPath, bizId, execute, outPath } = parseArgs(process.argv.slice(2));

  if (!excelPath) {
    console.error(`Usage:
  node scripts/importPurchasingExcel.mjs <path.xlsx> --biz=<business_uuid> [--execute] [--out=preview.json]

Preview only (default). --execute menulis ke app_state (service role).`);
    process.exit(1);
  }

  if (!bizId) {
    console.error("Wajib --biz=<business_uuid>");
    process.exit(1);
  }

  console.log(`\n📂 Membaca: ${excelPath}`);
  console.log(`   Sheet: ${SHEET_NAME}, data dari baris ${DATA_START_ROW}`);
  console.log(`   Mode: ${execute ? "EXECUTE → app_state" : "PREVIEW only"}\n`);

  const rawRows = readExcelRows(excelPath);
  const transactions = [];
  const skipped = [];

  for (let i = 0; i < rawRows.length; i++) {
    const rowNum = DATA_START_ROW + i;
    const row = rawRows[i];
    if (!row || row.every((c) => c == null || c === "")) continue;

    const result = transformRow(row, rowNum);
    if (result.skip) {
      skipped.push(result);
      continue;
    }

    const { tx, categoryName } = result;
    transactions.push(tx);
    tx.meta.mappedCategory = categoryName;
  }

  const summary = buildSummary(transactions, skipped);
  const preview = {
    generatedAt: new Date().toISOString(),
    excelPath,
    businessId: bizId,
    importBatch: BATCH_ID,
    mode: execute ? "execute" : "preview",
    summary,
    sampleFirst20: transactions.slice(0, 20),
    skippedSample: skipped.slice(0, 10),
  };

  const defaultOut = join(ROOT, "scripts", "output", `import-preview-${Date.now()}.json`);
  const writePath = outPath || defaultOut;
  mkdirSync(dirname(writePath), { recursive: true });
  writeFileSync(writePath, JSON.stringify(preview, null, 2), "utf8");

  console.log("── Summary ──────────────────────────────────────");
  console.log(`  Baris diproses   : ${summary.totalRowsParsed.toLocaleString("id-ID")}`);
  console.log(`  Siap import      : ${summary.totalImported.toLocaleString("id-ID")}`);
  console.log(`  Dilewati         : ${summary.totalSkipped.toLocaleString("id-ID")}`);
  if (Object.keys(summary.skipReasons).length) {
    console.log(`  Alasan skip      :`, summary.skipReasons);
  }
  console.log(`  Total nominal    : ${summary.totalNominalFormatted}`);
  console.log(`  Outlet           :`, summary.byOutlet);
  console.log(`  Kategori         :`, summary.byCategory);
  console.log(`  Top 10 supplier  :`);
  for (const s of summary.topSuppliers) {
    console.log(`    · ${s.name} (${s.count})`);
  }
  console.log(`\n  Preview JSON     : ${writePath}`);

  if (execute) {
    console.log("\n── Execute ──────────────────────────────────────");
    const result = await executeImport(bizId, transactions);
    console.log(`  Ditambahkan      : ${result.added.toLocaleString("id-ID")}`);
    console.log(`  Dedupe (skip)    : ${result.deduped.toLocaleString("id-ID")}`);
    console.log(`  Total transaksi  : ${result.totalTransactions.toLocaleString("id-ID")} di app_state`);
    console.log("\n✅ Import selesai. Transaksi import terhubung ke dompet (Kas Kecil / ShopeePay).");
  } else {
    console.log("\nℹ️  Preview saja. Jalankan ulang dengan --execute setelah Sam approve.");
  }
}

main().catch((e) => {
  console.error("\n❌", e.message || e);
  process.exit(1);
});
