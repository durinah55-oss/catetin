/**
 * Verifikasi: purchasing hanya 13 kategori, tanpa duplikat/lama.
 * Jalankan: node lib/categoriesVisibility.test.mjs
 */
import { visibleCategories } from "./rbac.js";

const PURCHASING_FINAL_NAMES = new Set([
  "bahan baku", "kemasan", "gas lpg", "listrik, air & internet", "gaji & upah",
  "sewa tempat", "kebutuhan operasional", "transport & ongkos belanja",
  "peralatan & perbaikan", "promosi", "pembelian aset", "keperluan owner", "lain-lain",
]);
const LEGACY = new Set([
  "belanja pasar", "kemasan & alat", "listrik & air", "transport belanja",
  "perlengkapan dapur", "operasional",
]);

function categoryNameKey(c) {
  return `${c.type || "out"}:${(c.name || "").trim().toLowerCase()}`;
}
function categoryNameNorm(c) {
  return (c?.name || "").trim().toLowerCase();
}
function categoryRichness(c) {
  let s = 0;
  if (c.role === "purchasing") s += 4;
  if (c.accounting_group) s += 2;
  if (c.description) s += 1;
  if (String(c.id || "").includes("-")) s += 1;
  return s;
}
function dedupeCategories(cats) {
  const byName = new Map();
  for (const c of cats || []) {
    if (!c?.name || LEGACY.has(categoryNameNorm(c))) continue;
    const key = categoryNameKey(c);
    const prev = byName.get(key);
    if (!prev || categoryRichness(c) > categoryRichness(prev)) byName.set(key, c);
  }
  return [...byName.values()];
}
function cleanCategoryList(cats) {
  const list = cats || [];
  const filtered = list.filter((c) => {
    if (LEGACY.has(categoryNameNorm(c))) return false;
    if (c?.type !== "out" || c?.role === "purchasing" || c?.role === "kasir") return true;
    const name = categoryNameNorm(c);
    if (PURCHASING_FINAL_NAMES.has(name)) return false;
    const key = categoryNameKey(c);
    return !list.some((p) => p?.role === "purchasing" && p.type === "out" && categoryNameKey(p) === key);
  });
  return dedupeCategories(filtered);
}

const purchasingUser = { role: "purchasing", outlet: null };
const dirty = [
  { id: "co1", name: "Bahan Baku", type: "out", role: null, active: true },
  { id: "co2", name: "Gaji & Upah", type: "out", role: null, active: true },
  { id: "co3", name: "Listrik & Air", type: "out", role: null, active: true },
  { id: "old1", name: "Belanja Pasar", type: "out", role: "purchasing", active: true },
  { id: "old2", name: "Transport Belanja", type: "out", role: "purchasing", active: true },
  { id: "old3", name: "Operasional", type: "out", role: "purchasing", active: true },
  ...[...PURCHASING_FINAL_NAMES].map((name, i) => ({
    id: `cp${i + 1}`, name: name.replace(/\b\w/g, (m) => m.toUpperCase()).replace(/& /g, "& "),
    type: "out", role: "purchasing", active: true, sort: i + 1, accounting_group: "hpp",
  })),
];
// Fix proper display names for cp entries
const final13 = [
  "Bahan Baku", "Kemasan", "Gas LPG", "Listrik, Air & Internet", "Gaji & Upah",
  "Sewa Tempat", "Kebutuhan Operasional", "Transport & Ongkos Belanja",
  "Peralatan & Perbaikan", "Promosi", "Pembelian Aset", "Keperluan Owner", "Lain-lain",
].map((name, i) => ({
  id: `cp${i + 1}`, name, type: "out", role: "purchasing", active: true,
  sort: i + 1, accounting_group: "hpp", description: "test",
}));

const cleaned = cleanCategoryList([...dirty.filter((c) => !String(c.id).startsWith("cp")), ...final13]);
const visible = visibleCategories(cleaned, purchasingUser, "out");
const names = visible.map((c) => c.name);

let ok = true;
function assert(cond, msg) {
  if (!cond) { console.error("FAIL:", msg); ok = false; } else console.log("OK:", msg);
}

assert(visible.length === 13, `purchasing melihat ${visible.length} kategori (harus 13)`);
assert(!names.some((n) => LEGACY.has(n.toLowerCase()) || ["Belanja Pasar", "Listrik & Air", "Operasional"].includes(n)), "tidak ada kategori lama");
assert(names.length === new Set(names.map((n) => n.toLowerCase())).size, "tidak ada duplikat nama");
console.log("\nDaftar:", names.join(" | "));
process.exit(ok ? 0 : 1);
