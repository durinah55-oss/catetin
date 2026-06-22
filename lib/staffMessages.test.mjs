// node lib/staffMessages.test.mjs
import {
  createRevisionRequestMessage,
  isRevisionRequestMessage,
  messageForUser,
  markRevisionMessagesRead,
  applyRevisionNoticesFromMessages,
  revisionMessageReportDate,
  revisionNoteForReport,
  findRevisionMessageForReport,
  revisionStillPending,
  resolveRevisionMessages,
} from "./staffMessages.js";

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("✓", msg); }
  else { failed++; console.error("✗", msg); }
}

const report = {
  id: "dr1",
  outlet: "KBU",
  date: "2026-06-21",
  status: "revision_requested",
  revisionNote: "ulang",
};

const msg = createRevisionRequestMessage({
  report,
  note: "ulang",
  author: { id: "a1", name: "Admin NF", role: "admin" },
});

ok(isRevisionRequestMessage(msg), "revision message kind");
ok(msg.target.type === "outlet" && msg.target.value === "KBU", "target kasir KBU");
ok(msg.title.includes("KBU") && msg.body.includes("ulang"), "title/body revision");
ok(messageForUser(msg, { role: "kasir", outlet: "KBU" }), "KBU kasir menerima");
ok(!messageForUser(msg, { role: "kasir", outlet: "KSM" }), "KSM kasir tidak menerima");

const marked = markRevisionMessagesRead([msg], "dr1", "u_kasir");
ok(marked[0].readBy.includes("u_kasir"), "mark revision read after kirim revisi");

const patched = applyRevisionNoticesFromMessages(
  [{ id: "dr1", outlet: "KBU", date: "2026-06-21", status: "submitted", total: 100 }],
  [msg]
);
ok(patched[0].status === "revision_requested", "applyRevisionNoticesFromMessages unlocks submitted");

ok(isRevisionRequestMessage({ title: "⚠ Revisi laporan omset KBU · 21 Jun" }), "legacy title detected as revision");
ok(revisionMessageReportDate(msg) === "2026-06-21", "reportDate from meta");
ok(revisionMessageReportDate({ title: "⚠ Revisi laporan omset KBU · 21 Jun" })?.endsWith("-06-21"), "reportDate parsed from title");

const note = revisionNoteForReport(
  { id: "dr2", date: "2026-06-21", outlet: "KBU" },
  [msg],
  "KBU"
);
ok(note === "ulang", "revisionNoteForReport from staff message");

const found = findRevisionMessageForReport([msg], { reportDate: "2026-06-21", outlet: "KBU" });
ok(found?.id === msg.id, "findRevisionMessageForReport by date");

ok(revisionStillPending(report, [msg], "KBU"), "revision pending before kirim ulang");
const resubmitted = {
  id: "dr1",
  outlet: "KBU",
  date: "2026-06-21",
  status: "submitted",
  resubmittedAt: "2026-06-22T13:00:00.000Z",
  total: 7486000,
};
ok(!revisionStillPending(resubmitted, [msg], "KBU"), "revision selesai setelah resubmittedAt");
const patched2 = applyRevisionNoticesFromMessages([resubmitted], [msg]);
ok(patched2[0].status === "submitted", "applyRevision tidak reopen setelah resubmittedAt");
const resolved = resolveRevisionMessages([msg], "dr1", "u_kasir", "2026-06-21");
ok(resolved[0].meta?.fulfilledAt, "resolveRevisionMessages sets fulfilledAt");
ok(!revisionStillPending(resubmitted, resolved, "KBU"), "fulfilledAt clears pending");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
