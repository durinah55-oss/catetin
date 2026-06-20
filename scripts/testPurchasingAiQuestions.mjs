#!/usr/bin/env node
/**
 * Test 3 pertanyaan Asisten Purchasing terhadap data app_state nyata.
 *   node scripts/testPurchasingAiQuestions.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { buildPurchasingAiContext, fallbackPurchasingAdvice } from "../lib/purchasingAiContext.js";
import { isPurchasingTx } from "../lib/purchasingExpense.js";

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, "..");
const BIZ = "e23ed572-234c-4995-acad-fa6bff7c58d2";
const QUESTIONS = [
  "ayam paha fillet beli di mana?",
  "berapa harga terakhir gas ijo?",
  "thermal gede supplier siapa?",
];

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

function findItemInTx(transactions, needle) {
  const n = needle.toLowerCase();
  const hits = [];
  for (const t of transactions || []) {
    if (!isPurchasingTx(t)) continue;
    const items = t.meta?.items || [];
    const names = items.length
      ? items.map((i) => i.name)
      : [t.desc || t.description].filter(Boolean);
    for (const raw of names) {
      if (String(raw).toLowerCase().includes(n)) {
        hits.push({
          date: t.date,
          supplier: t.supplier,
          outlet: t.outlet,
          amount: t.amount,
          item: raw,
          unitPrice: items.find((i) => i.name === raw)?.unitPrice,
        });
      }
    }
  }
  hits.sort((a, b) => b.date.localeCompare(a.date));
  return hits;
}

async function callClaude(context, question) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{
        role: "user",
        content: `Kamu asisten purchasing F&B warung/kafe Indonesia. Jawab HANYA berdasarkan data JSON di bawah. Jangan mengarang angka di luar data. Jika pertanyaan di luar scope purchasing atau data tidak cukup, katakan jujur.

Aturan:
- Bahasa Indonesia, singkat & praktis (max ~200 kata jawaban)
- Fokus kendala belanja: item, supplier, outlet, kategori, pola pengeluaran
- Jangan bahas omset kasir, SDM outlet, atau keuangan non-purchasing
- Role penanya: owner

Data purchasing (ringkas, ${context.period?.days || 90} hari):
${JSON.stringify(context, null, 0)}

Pertanyaan: ${question}

Balas HANYA JSON tanpa markdown:
{
  "answer": "<jawaban utuh>",
  "highlights": ["<poin penting 1>", "<poin 2>"],
  "actionHint": "<1 langkah praktis opsional, atau string kosong>"
}`,
      }],
    }),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const raw = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/```json|```/g, "")
    .trim();
  return JSON.parse(raw);
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Env Supabase wajib");

  const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await admin.from("app_state").select("data").eq("business_id", BIZ).maybeSingle();
  if (error) throw error;
  const txs = data?.data?.transactions || [];

  const context = buildPurchasingAiContext({
    transactions: txs,
    categories: data?.data?.categories || [],
    days: 90,
    outlet: "all",
  });

  console.log(`\nData: ${context.summary.transactionCount} tx purchasing (90 hari)\n`);

  const needles = ["ayam paha fillet", "gas ijo", "thermal"];
  for (const n of needles) {
    const hits = findItemInTx(txs, n).slice(0, 3);
    console.log(`── Raw data "${n}" (top ${hits.length}) ──`);
    for (const h of hits) {
      console.log(`  ${h.date} | ${h.item} | sup: ${h.supplier || "—"} | Rp ${h.amount}${h.unitPrice ? ` (unit ${h.unitPrice})` : ""}`);
    }
    console.log("");
  }

  for (const q of QUESTIONS) {
    console.log(`\n${"=".repeat(60)}\nQ: ${q}\n${"=".repeat(60)}`);
    try {
      let result;
      if (process.env.ANTHROPIC_API_KEY) {
        result = await callClaude(context, q);
      } else {
        result = fallbackPurchasingAdvice(context, q);
      }
      console.log("A:", result.answer);
      if (result.highlights?.length) console.log("Highlights:", result.highlights.join(" | "));
      if (result.actionHint) console.log("Hint:", result.actionHint);
    } catch (e) {
      console.error("ERR:", e.message);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
