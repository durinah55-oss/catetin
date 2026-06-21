import test from "node:test";
import assert from "node:assert/strict";
import { mergeAppStateData } from "./appState.js";

test("deleted transactions stay deleted after cloud merge", () => {
  const remote = {
    transactions: [
      { id: "t1", type: "out", amount: 100000, module: "purchasing" },
      { id: "t2", type: "out", amount: 50000 },
    ],
    deletedTransactionIds: [],
  };
  const local = {
    transactions: [{ id: "t2", type: "out", amount: 50000 }],
    deletedTransactionIds: ["t1"],
  };
  const merged = mergeAppStateData(remote, local);
  assert.equal(merged.transactions.some((t) => t.id === "t1"), false);
  assert.equal(merged.transactions.some((t) => t.id === "t2"), true);
  assert.ok(merged.deletedTransactionIds.includes("t1"));
});
