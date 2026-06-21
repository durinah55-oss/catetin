import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_BUSINESS_ID,
  filterBusinessesForUi,
  pickDefaultBusinessId,
} from "./canonicalBusiness.js";

const CANONICAL = { id: CANONICAL_BUSINESS_ID, slug: "nusa-food", name: "Nusa Food", type: "fnb", role: "owner" };
const FISHING = { id: "fish-001", slug: "nusa-fishing", name: "Nusa Fishing", type: "ecommerce", role: "owner" };
const DUP_FNB = { id: "dup-fnb", slug: "nf-fnb", name: "NF F&B", type: "fnb", role: "owner" };

test("filter keeps Nusa Fishing when user has canonical", () => {
  const visible = filterBusinessesForUi([CANONICAL, FISHING, DUP_FNB]);
  assert.equal(visible.length, 2);
  assert.ok(visible.some((b) => b.id === CANONICAL_BUSINESS_ID));
  assert.ok(visible.some((b) => b.id === "fish-001"));
  assert.ok(!visible.some((b) => b.id === "dup-fnb"));
});

test("pickDefaultBusinessId honors ?biz= for Nusa Fishing", () => {
  const list = [CANONICAL, FISHING];
  assert.equal(
    pickDefaultBusinessId(list, { bizParam: "fish-001" }),
    "fish-001"
  );
});

test("pickDefaultBusinessId defaults to canonical without param", () => {
  const list = [CANONICAL, FISHING];
  assert.equal(pickDefaultBusinessId(list), CANONICAL_BUSINESS_ID);
});
