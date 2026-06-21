import test from "node:test";
import assert from "node:assert/strict";
import {
  hydrateReportChannels,
  getReportChannels,
  FACTORY_REPORT_CHANNELS,
} from "./reportChannels.js";

test("KSM factory channels match KBU count and groups", () => {
  assert.equal(FACTORY_REPORT_CHANNELS.KSM.length, FACTORY_REPORT_CHANNELS.KBU.length);
  assert.ok(FACTORY_REPORT_CHANNELS.KSM.some((c) => c.id === "gofood" && c.group === "Online"));
});

test("hydrate upgrades old KSM 4-channel config to KBU form", () => {
  const oldKsm = [
    { id: "tunai", label: "Tunai", role: "cash", order: 1, active: true },
    { id: "ojek_online", label: "Ojek Online", role: "channel", order: 2, active: true },
    { id: "qris_bca", label: "QRIS BCA", role: "channel", order: 3, active: true },
    { id: "grab", label: "Grab", role: "channel", order: 4, active: true },
  ];
  const hydrated = hydrateReportChannels({ KSM: oldKsm, KBU: FACTORY_REPORT_CHANNELS.KBU });
  assert.equal(hydrated.KSM.length, FACTORY_REPORT_CHANNELS.KBU.length);
  assert.ok(hydrated.KSM.some((c) => c.id === "tf_bca" && c.group === "Transfer Bank"));
  assert.ok(!hydrated.KSM.some((c) => c.id === "ojek_online"));
});

test("getReportChannels for SMT uses KBU layout", () => {
  const state = {
    reportChannels: hydrateReportChannels({
      SMT: [{ id: "tunai", role: "cash", active: true, order: 1 }],
    }),
  };
  const ch = getReportChannels(state, "SMT");
  assert.ok(ch.some((c) => c.id === "edc_bca"));
  assert.ok(ch.some((c) => c.id === "shopefood"));
});
