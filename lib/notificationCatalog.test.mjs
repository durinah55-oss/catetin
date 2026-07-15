// node lib/notificationCatalog.test.mjs
import {
  NOTIFICATION_CATALOG,
  hydrateNotificationPrefs,
  getStaffMessageAction,
  getMessageKind,
} from "./notificationCatalog.js";
import { createPurchasingFundMessage, prependStaffMessage } from "./staffMessages.js";

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log("✓", msg); }
  else { failed++; console.error("✗", msg); }
}

ok(NOTIFICATION_CATALOG.length >= 7, "catalog has notification types");

const prefs = hydrateNotificationPrefs({ purchasing_fund: false });
ok(prefs.purchasing_fund === false && prefs.revision_request !== false, "hydrate prefs");

const fund = createPurchasingFundMessage({ amount: 500000, fromWalletName: "Kas Besar", author: { name: "Admin", role: "admin" }, transactionId: "t1" });
ok(getMessageKind(fund) === "purchasing_fund", "purchasing fund kind");
const action = getStaffMessageAction(fund, { role: "purchasing" });
ok(action?.type === "catatBelanja", "purchasing tap action");

const blocked = prependStaffMessage([], fund, prefs);
ok(blocked.length === 0, "prepend respects disabled pref");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
