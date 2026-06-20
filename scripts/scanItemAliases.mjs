#!/usr/bin/env node
/**
 * Scan kandidat alias nama barang dari transaksi purchasing di app_state.
 *
 *   node scripts/scanItemAliases.mjs [--biz=<uuid>]
 *
 * Env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { distance as levenshtein } from "fastest-levenshtein";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const DEFAULT_BIZ = "e23ed572-234c-4995-acad-fa6bff7c58d2";

const GENERIC_NAMES = new Set([
  "",
  "-",
  "lainnya",
  "lain lain",
  "dll",
  "dsb",
  "misc",
  "dll.",
  "dsb.",
  "other",
  "umum",
]);

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
  let bizId = DEFAULT_BIZ;
  for (const arg of argv) {
    if (arg.startsWith("--biz=")) bizId = arg.slice(6);
  }
  return { bizId };
}

function normalizeName(raw) {
  return String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isPurchasingTx(t) {
  if (!t || t.type !== "out") return false;
  if (t.module === "purchasing") return true;
  const src = t.source || "";
  return typeof src === "string" && src.startsWith("purchasing");
}

function isSkippedForClustering(name) {
  if (!name || name.length <= 2) return true;
  if (GENERIC_NAMES.has(name)) return true;
  return false;
}

const STOPWORD_TOKENS = new Set([
  "uk",
  "no",
  "ijo",
  "besar",
  "kecil",
  "gede",
  "premium",
  "super",
  "extra",
  "spesial",
  "pack",
  "pcs",
  "kg",
  "ltr",
  "dus",
  "box",
  "botol",
  "sachet",
  "bks",
]);

const MAX_CLUSTER_MEMBERS = 8;
const SUSPECT_FREQ_THRESHOLD = 500;
const SUSPECT_MEMBER_THRESHOLD = 15;
const EDIT_DISTANCE_MAX = 3;
const MIN_EDIT_DISTANCE_NAME_LEN = 8;

function tokenize(name) {
  return name.split(/\s+/).filter((t) => t.length > 0);
}

function meaningfulSharedTokens(a, b) {
  const ta = new Set(tokenize(a));
  const shared = [];
  for (const t of tokenize(b)) {
    if (ta.has(t) && !STOPWORD_TOKENS.has(t)) shared.push(t);
  }
  return shared;
}

/** @returns {{ merge: boolean, reason: string|null, confidence: "high"|"medium"|null }} */
function pairMergeEval(a, b) {
  const shared = meaningfulSharedTokens(a, b);
  const tokenMerge = shared.length >= 2;

  const editEligible = a.length >= MIN_EDIT_DISTANCE_NAME_LEN && b.length >= MIN_EDIT_DISTANCE_NAME_LEN;
  const editDist = editEligible ? levenshtein(a, b) : null;
  const editMerge = editEligible && editDist <= EDIT_DISTANCE_MAX;

  if (!tokenMerge && !editMerge) {
    return { merge: false, reason: null, confidence: null };
  }

  if (tokenMerge && editMerge) {
    return {
      merge: true,
      reason: `token overlap: [${shared.join(", ")}]; edit distance: ${editDist}`,
      confidence: "high",
    };
  }
  if (tokenMerge) {
    return {
      merge: true,
      reason: `token overlap: [${shared.join(", ")}]`,
      confidence: "medium",
    };
  }
  return {
    merge: true,
    reason: `edit distance: ${editDist}`,
    confidence: "medium",
  };
}

function maxDate(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a >= b ? a : b;
}

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
    .select("data")
    .eq("business_id", bizId)
    .maybeSingle();
  if (error) throw new Error(`[loadAppState] ${error.message}`);
  if (!data?.data) throw new Error(`app_state kosong untuk business_id ${bizId}`);
  return data.data;
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.rank = new Array(n).fill(0);
  }
  find(x) {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    if (this.rank[ra] < this.rank[rb]) this.parent[ra] = rb;
    else if (this.rank[ra] > this.rank[rb]) this.parent[rb] = ra;
    else {
      this.parent[rb] = ra;
      this.rank[ra]++;
    }
  }
}

const CONF_RANK = { high: 3, medium: 2, low: 1 };

function clusterConfidence(edges) {
  if (!edges.length) return "medium";
  let best = "low";
  for (const c of edges) {
    if (CONF_RANK[c] > CONF_RANK[best]) best = c;
  }
  return best;
}

function collectNamesFromTransactions(transactions) {
  /** @type {Map<string, { freq: number, last_seen: string|null, suppliers: Set<string> }>} */
  const stats = new Map();
  let purchasingCount = 0;

  for (const tx of transactions || []) {
    if (!isPurchasingTx(tx)) continue;
    purchasingCount++;

    const date = tx.date || tx.occurred_at || null;
    const supplier = (tx.supplier || "").trim() || null;
    const items = tx.meta?.items || [];
    const names = [];

    if (Array.isArray(items) && items.length) {
      for (const it of items) {
        const n = normalizeName(it?.name);
        if (n) names.push(n);
      }
    }
    if (!names.length) {
      const d = normalizeName(tx.desc || tx.description);
      if (d) names.push(d);
    }

    for (const name of names) {
      if (!name) continue;
      const prev = stats.get(name) || { freq: 0, last_seen: null, suppliers: new Set() };
      prev.freq++;
      prev.last_seen = maxDate(prev.last_seen, date);
      if (supplier) prev.suppliers.add(supplier);
      stats.set(name, prev);
    }
  }

  return { stats, purchasingCount };
}

function buildClusters(clusterableNames) {
  const n = clusterableNames.length;
  const uf = new UnionFind(n);
  /** @type {Array<{a:number,b:number,confidence:string,reason:string}>} */
  const pairEdges = [];

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const evalResult = pairMergeEval(clusterableNames[i], clusterableNames[j]);
      if (!evalResult.merge) continue;
      uf.union(i, j);
      pairEdges.push({
        a: i,
        b: j,
        confidence: evalResult.confidence,
        reason: evalResult.reason,
      });
    }
  }

  /** @type {Map<number, number[]>} */
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  }

  return { groups, pairEdges };
}

function formatMember(name, stat) {
  return {
    name,
    freq: stat.freq,
    last_seen: stat.last_seen,
    suppliers: [...stat.suppliers].sort((a, b) => a.localeCompare(b, "id")),
  };
}

async function main() {
  loadEnvLocal();
  const { bizId } = parseArgs(process.argv.slice(2));

  console.log(`\n🔍 Scan alias barang — business_id: ${bizId}\n`);

  const admin = getAdmin();
  const data = await loadAppStateDoc(admin, bizId);
  const { stats, purchasingCount } = collectNamesFromTransactions(data.transactions || []);

  const allNames = [...stats.keys()];
  const clusterableNames = allNames.filter((n) => !isSkippedForClustering(n));
  const skippedNames = allNames.filter((n) => isSkippedForClustering(n));

  console.log(`  Transaksi purchasing : ${purchasingCount.toLocaleString("id-ID")}`);
  console.log(`  Nama unik (total)    : ${allNames.length.toLocaleString("id-ID")}`);
  console.log(`  Masuk clustering     : ${clusterableNames.length.toLocaleString("id-ID")}`);
  console.log(`  Skip (generik/pendek): ${skippedNames.length.toLocaleString("id-ID")}\n`);

  const { groups, pairEdges } = buildClusters(clusterableNames);

  /** @type {Array<object>} */
  const clusters = [];
  /** @type {Array<object>} */
  const suspects = [];
  const namesInClusters = new Set();
  const demotedToStandalone = new Set();
  let clusterId = 0;
  let suspectId = 0;

  for (const indices of groups.values()) {
    if (indices.length < 2) continue;

    const allMembers = indices
      .map((i) => clusterableNames[i])
      .map((name) => formatMember(name, stats.get(name)))
      .sort((a, b) => b.freq - a.freq);

    const indexSet = new Set(indices);
    const internalEdges = pairEdges.filter((e) => indexSet.has(e.a) && indexSet.has(e.b));
    const edgeConfidences = internalEdges.map((e) => e.confidence);
    const reasons = [...new Set(internalEdges.map((e) => e.reason).filter(Boolean))];
    const reason = reasons.length === 1 ? reasons[0] : reasons.slice(0, 3).join(" | ");

    const rawMemberCount = allMembers.length;
    const rawTotalFreq = allMembers.reduce((s, m) => s + m.freq, 0);
    const isSuspect =
      rawTotalFreq > SUSPECT_FREQ_THRESHOLD || rawMemberCount > SUSPECT_MEMBER_THRESHOLD;

    const canonical = allMembers[0].name;
    const base = {
      canonical_suggestion: canonical,
      total_freq: rawTotalFreq,
      confidence: clusterConfidence(edgeConfidences),
      reason,
      suspect: isSuspect,
      raw_member_count: rawMemberCount,
    };

    if (isSuspect) {
      suspectId++;
      for (const m of allMembers) namesInClusters.add(m.name);
      suspects.push({
        ...base,
        suspect_id: suspectId,
        members: allMembers,
      });
      continue;
    }

    const kept = allMembers.slice(0, MAX_CLUSTER_MEMBERS);
    const overflow = allMembers.slice(MAX_CLUSTER_MEMBERS);
    for (const m of overflow) demotedToStandalone.add(m.name);
    if (kept.length < 2) continue;

    clusterId++;
    for (const m of kept) namesInClusters.add(m.name);
    clusters.push({
      ...base,
      cluster_id: clusterId,
      members: kept,
      total_freq: kept.reduce((s, m) => s + m.freq, 0),
      trimmed_overflow: overflow.length,
    });
  }

  clusters.sort((a, b) => b.total_freq - a.total_freq);
  suspects.sort((a, b) => b.total_freq - a.total_freq);

  const standalone = allNames
    .filter((n) => !namesInClusters.has(n) || demotedToStandalone.has(n))
    .map((name) => formatMember(name, stats.get(name)))
    .sort((a, b) => b.freq - a.freq);

  const output = {
    generatedAt: new Date().toISOString(),
    businessId: bizId,
    summary: {
      total_unique_names: allNames.length,
      total_transactions: purchasingCount,
      candidate_clusters: clusters.length,
      suspect_clusters: suspects.length,
      names_in_clusters: namesInClusters.size,
      names_standalone: standalone.length,
      skipped_from_clustering: skippedNames.length,
      demoted_from_cluster_cap: demotedToStandalone.size,
    },
    clusters,
    suspects,
    standalone,
    skipped: skippedNames.map((name) => formatMember(name, stats.get(name))).sort((a, b) => b.freq - a.freq),
  };

  const outPath = join(ROOT, "scripts", "output", `item-aliases-scan-${Date.now()}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

  console.log("── Summary ──────────────────────────────────────");
  console.log(`  Nama unik              : ${output.summary.total_unique_names.toLocaleString("id-ID")}`);
  console.log(`  Transaksi purchasing   : ${output.summary.total_transactions.toLocaleString("id-ID")}`);
  console.log(`  Cluster kandidat       : ${output.summary.candidate_clusters.toLocaleString("id-ID")}`);
  console.log(`  Suspect cluster        : ${output.summary.suspect_clusters.toLocaleString("id-ID")}`);
  console.log(`  Nama dalam cluster     : ${output.summary.names_in_clusters.toLocaleString("id-ID")}`);
  console.log(`  Demoted (cap 8)        : ${output.summary.demoted_from_cluster_cap.toLocaleString("id-ID")}`);
  console.log(`  Nama standalone        : ${output.summary.names_standalone.toLocaleString("id-ID")}`);
  console.log(`  Output JSON            : ${outPath}\n`);

  console.log("── Top 20 cluster kandidat (untuk review Sam) ───");
  const top20 = clusters.slice(0, 20);
  if (!top20.length) {
    console.log("  (tidak ada cluster ditemukan)\n");
  } else {
    for (const c of top20) {
      const trimNote = c.trimmed_overflow ? ` (+${c.trimmed_overflow} demoted)` : "";
      console.log(
        `\n  #${c.cluster_id} [${c.confidence}] total_freq=${c.total_freq}${trimNote} → "${c.canonical_suggestion}"`
      );
      console.log(`     reason: ${c.reason}`);
      for (const m of c.members) {
        const sup = m.suppliers.length ? m.suppliers.slice(0, 3).join(", ") : "(tanpa supplier)";
        console.log(`     · ${m.freq}x  "${m.name}"  last=${m.last_seen || "?"}  sup: ${sup}`);
      }
    }
    console.log("");
  }

  if (suspects.length) {
    console.log(`── Suspect clusters (${suspects.length}) — review manual ───`);
    for (const s of suspects.slice(0, 5)) {
      console.log(
        `\n  suspect #${s.suspect_id} raw_members=${s.raw_member_count} total_freq=${s.total_freq} → "${s.canonical_suggestion}"`
      );
      console.log(`     reason: ${s.reason}`);
      console.log(`     top: ${s.members.slice(0, 5).map((m) => `${m.freq}x "${m.name}"`).join(", ")}`);
    }
    if (suspects.length > 5) console.log(`\n  … +${suspects.length - 5} suspect lainnya (lihat JSON)\n`);
    else console.log("");
  }
}

main().catch((e) => {
  console.error("\n❌", e.message || e);
  process.exit(1);
});
