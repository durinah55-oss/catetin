// lib/notificationReminders.js — pengingat harian otomatis (sosmed, SDM)

import { hydrateNotificationPrefs } from "./notificationCatalog.js";
import { createSosmedReminderMessage, createSdmReminderMessage, prependStaffMessage } from "./staffMessages.js";
import { todaySosmedReport, isSosmedEnabled, hydrateSosmedConfig } from "./sosmedReport.js";
import { todaySdmReport, OUTLETS } from "./sdmHarian.js";

/** Kumpulkan pesan pengingat yang perlu dikirim hari ini. */
export function collectDailyReminderMessages(state, dateStr, now = new Date()) {
  const prefs = hydrateNotificationPrefs(state?.notificationPrefs);
  const hour = now.getHours();
  const out = [];
  const sosmedCfg = hydrateSosmedConfig(state?.sosmedConfig);

  if (prefs.sosmed_reminder !== false && hour >= (prefs.sosmedReminderHour ?? 20)) {
    for (const outlet of sosmedCfg.enabledOutlets || []) {
      if (!isSosmedEnabled(sosmedCfg, outlet)) continue;
      const rep = todaySosmedReport(state?.sosmedReports, outlet, dateStr);
      if (rep?.submittedAt) continue;
      out.push(createSosmedReminderMessage({ outlet, date: dateStr }));
    }
  }

  if (prefs.sdm_reminder !== false && hour >= (prefs.sdmReminderHour ?? 10) && hour < 15) {
    for (const outlet of OUTLETS) {
      if (todaySdmReport(state?.sdmReports, outlet, dateStr)) continue;
      out.push(createSdmReminderMessage({ outlet, date: dateStr }));
    }
  }

  return out;
}

/** Sisipkan pengingat ke doc (tanpa duplikat). */
export function mergeDailyRemindersIntoDoc(doc, dateStr, now = new Date()) {
  if (!doc) return doc;
  const incoming = collectDailyReminderMessages(doc, dateStr, now);
  if (!incoming.length) return doc;
  let staffMessages = doc.staffMessages || [];
  let changed = false;
  for (const msg of incoming) {
    const next = prependStaffMessage(staffMessages, msg, doc.notificationPrefs);
    if (next !== staffMessages) {
      staffMessages = next;
      changed = true;
    }
  }
  return changed ? { ...doc, staffMessages } : doc;
}
