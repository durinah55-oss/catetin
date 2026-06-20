import test from "node:test";
import assert from "node:assert/strict";
import {
  getDayType,
  getComparisonDate,
  getPeriodComparison,
  groupTransactionsByDayOfWeek,
} from "./analysisDateLogic.js";

test("getDayType weekend vs weekday", () => {
  assert.equal(getDayType(new Date(2025, 5, 7)), "weekend"); // Sat
  assert.equal(getDayType(new Date(2025, 5, 9)), "weekday"); // Mon
});

test("getPeriodComparison shifts compare window 7 days back", () => {
  const { current, compare, note } = getPeriodComparison(7);
  const diffDays = (current.from - compare.from) / (1000 * 60 * 60 * 24);
  assert.equal(diffDays, 7);
  assert.ok(note.includes("minggu"));
});

test("groupTransactionsByDayOfWeek pairs same weekday", () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastWeek = new Date(today);
  lastWeek.setDate(today.getDate() - 7);

  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const txs = [
    { date: fmt(today), type: "in", amount: 1000000, outlet: "KBU" },
    { date: fmt(lastWeek), type: "in", amount: 800000, outlet: "KBU" },
  ];

  const period = getPeriodComparison(1);
  const out = groupTransactionsByDayOfWeek(txs, period.current, period.compare);
  assert.match(out, /▲25%/);
});

test("getComparisonDate labels same weekday", () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const r = getComparisonDate(d);
  assert.ok(r.compareLabel);
  assert.ok(r.reason.includes("hari yang sama") || r.reason.includes("minggu lalu"));
});
