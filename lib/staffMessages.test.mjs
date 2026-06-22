// node lib/staffMessages.test.mjs
import {
  createRevisionRequestMessage,
  isRevisionRequestMessage,
  messageForUser,
  markRevisionMessagesRead,
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
