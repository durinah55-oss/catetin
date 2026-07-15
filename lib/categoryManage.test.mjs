import test from "node:test";
import assert from "node:assert/strict";
import { ensurePurchasingCategories } from "./purchasingCategories.js";
import {
  buildNewCategory,
  applyRemoveCategory,
  categoryNameTaken,
} from "./categoryManage.js";

test("ensurePurchasingCategories does not re-activate hidden purchasing category", () => {
  const cats = ensurePurchasingCategories([
    { id: "cp10", name: "Promosi", type: "out", role: "purchasing", active: false },
  ]);
  const promosi = cats.find((c) => c.name === "Promosi");
  assert.equal(promosi?.active, false);
});

test("buildNewCategory rejects duplicate names", () => {
  const r = buildNewCategory({
    name: "Bahan Baku",
    type: "out",
    user: { role: "admin" },
    categories: [{ id: "x", name: "Bahan Baku", type: "out" }],
  });
  assert.equal(r.ok, false);
});

test("applyRemoveCategory hides category used by transactions", () => {
  const draft = {
    categories: [{ id: "c1", name: "Test", type: "in", active: true }],
    transactions: [{ id: "t1", categoryId: "c1", amount: 100 }],
  };
  const plan = applyRemoveCategory(draft, "c1");
  assert.equal(plan.mode, "hidden");
  assert.equal(draft.categories[0].active, false);
  assert.equal(draft.categories.length, 1);
});

test("applyRemoveCategory removes unused category", () => {
  const draft = {
    categories: [{ id: "c2", name: "Baru", type: "in", active: true }],
    transactions: [],
  };
  const plan = applyRemoveCategory(draft, "c2");
  assert.equal(plan.mode, "removed");
  assert.equal(draft.categories.length, 0);
});

test("categoryNameTaken is case insensitive", () => {
  assert.equal(
    categoryNameTaken([{ id: "a", name: "Modal Masuk", type: "in" }], "modal masuk", "in"),
    true
  );
});
