import test from "node:test";
import assert from "node:assert/strict";
import { buildBusinessAnalysis, topRepeatedLines, todayISO, isoOffset, fallbackBusinessAdvice } from "./businessAnalysis.js";

test("topRepeatedLines counts duplicates", () => {
  const r = topRepeatedLines(["Menu habis", "menu habis", "Antri"], 2);
  assert.equal(r[0].text, "menu habis");
  assert.equal(r[0].count, 2);
});

test("buildBusinessAnalysis omset vs SDM insight", () => {
  const state = {
    dailyReports: [
      { outlet: "KBU", date: todayISO(), total: 3000000, dailyTargetAtSubmit: 5000000 },
      { outlet: "KBU", date: isoOffset(-1), total: 2800000, dailyTargetAtSubmit: 5000000 },
    ],
    sdmReports: [
      { outlet: "KBU", date: todayISO(), targetOmset: 5000000, ratio: 22, statusKey: "bahaya" },
      { outlet: "KBU", date: isoOffset(-1), targetOmset: 5000000, ratio: 21, statusKey: "bahaya" },
    ],
    sosmedReports: [
      {
        outlet: "KBU",
        date: todayISO(),
        submittedAt: new Date().toISOString(),
        complaints: ["Antri lama", "Antri lama"],
        topQuestions: ["Jam buka?", "Menu vegan?", "Parkir?"],
        wellDone: false,
        dm: { instagram: 5 },
        comments: { instagram: 2 },
        googleReviews: { star1: 1, star5: 0 },
        replied: { instagram: false },
      },
    ],
    voidLogs: [],
  };
  const a = buildBusinessAnalysis(state, { days: 7 });
  assert.ok(a.insights.some((i) => i.id === "omset_low_KBU"));
  assert.ok(a.insights.some((i) => i.id === "sdm_ratio_KBU"));
  assert.ok(a.insights.some((i) => i.id === "komplain_KBU"));
  assert.equal(a.kpis.totalComplaints, 2);
});

test("fallbackBusinessAdvice produces decisions", () => {
  const state = {
    dailyReports: [{ outlet: "KBU", date: todayISO(), total: 3000000, dailyTargetAtSubmit: 5000000 }],
    sdmReports: [{ outlet: "KBU", date: todayISO(), targetOmset: 5000000, ratio: 22, statusKey: "bahaya" }],
    sosmedReports: [{
      outlet: "KBU", date: todayISO(), submittedAt: new Date().toISOString(),
      complaints: ["Antri lama"], topQuestions: [], wellDone: false,
      dm: {}, comments: {}, googleReviews: {}, replied: {},
    }],
    voidLogs: [],
  };
  const biz = buildBusinessAnalysis(state, { days: 7 });
  const fb = fallbackBusinessAdvice(biz);
  assert.ok(fb.executiveSummary);
  assert.ok(fb.decisions.length >= 1);
  assert.equal(fb.source, "fallback");
});
