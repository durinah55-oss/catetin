"use client";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Home, BarChart3, Sparkles, User, Mic, Bell, Inbox, Cloud, Eye, EyeOff, Plus, Wallet, ChevronRight, ChevronLeft, ChevronUp, ChevronDown, Pencil, Trash2, ShoppingCart, Users, Zap, Store, PiggyBank, MoreHorizontal, Check, X, ArrowLeft, ScanLine, Keyboard, Fingerprint, Star, ShieldCheck, Monitor, RefreshCw, Sun, Moon, Smartphone, Copy, AlertTriangle, ClipboardList, ClipboardPaste, TrendingUp, TrendingDown, Loader2, Banknote, Filter, Ban, Share2, LogOut, Tags, MessageCircle, ArrowLeftRight, Upload } from "lucide-react";
import PurchasingForm from "../../../components/PurchasingForm";
import KategoriPurchasing from "../../../components/KategoriPurchasing";
import LaporanPurchasing from "../../../components/LaporanPurchasing";
import AsistenPurchasing from "../../../components/AsistenPurchasing";
import PurchasingAliasesReview from "../../../components/PurchasingAliasesReview";
import { loadAppState, saveAppState, mergeAppStateData, mergeCategoriesFromDb, cleanCategoryList, ensurePurchasingCategories, dedupeTransactionsById, aiParse, fetchBusinessAnalysis } from "../../../lib/appState";
import { checkPurchasingFloor } from "../../../lib/purchasingExpense";
import { normalizeTransaction, normalizeTransactions, resolveWalletId, resolveTransferIds } from "../../../lib/transactionNormalize";
import { canDo, visibleWallets, visibleCategories, visibleTransactions, ROLE_LABEL, PURCHASING_WALLET_IDS, showPurchasingAsistenTab, showPurchasingAsistenBeranda, canUsePurchasingAsisten, canManageTransactions, isKasKecilWallet } from "../../../lib/rbac";
import { resolveBusinessDisplayName } from "../../../lib/canonicalBusiness";
import {
  businessFeatures,
  visibleWalletsForBusiness,
  visibleTransactionsForBusiness,
  isOverlayAllowedForBusiness,
  fnbFeatureLabel,
  findCanonicalInList,
  CANONICAL_DISPLAY_NAME,
  businessTypeLabel,
  isFnBOnlyWallet,
} from "../../../lib/businessFeatures";
import { resolveAuthMembership } from "../../../lib/membershipResolve";
import { walletOptionLabel, walletBalanceDisplay, walletsForSaldoTotal, shouldHideWalletBalance } from "../../../lib/walletDisplay";
import { getAccountUi, navConfig } from "../../../lib/accountUi";
import {
  getPeriodBounds, shiftAnchor, filterTransactions, buildCashflowChart,
  sumInOut, formatPeriodLabel, localISO,
} from "../../../lib/laporanKeuangan";
import { submitDailyReport, resubmitDailyReport, settleDailyReport, verifyDailyReportAdmin, requestDailyReportRevision, deleteDailyReport, pendingReports, reportsAwaitingVerify, reportsReadyToSettle, reportsAwaitingRevision, findPendingRevisionReport, reportAwaitingKasirRevision, reportCashAmount, reportSettleUrgency, reportSettleDeadlineLabel, reconcileDailyReports, LACI_BY_OUTLET, LACI_FLOOR } from "../../../lib/kasirHarian";
import { submitVoidLog, pendingVoidLogs, reviewVoidLog, visibleVoidLogs, VOID_TYPES } from "../../../lib/voidLog";
import {
  submitSdmReport, buildSdmSnapshot, getOutletConfig, todaySdmReport,
  OUTLET_LABEL, SDM_HINT, parseHeadcountInput, OUTLETS,
  calcDailyOmsetTarget, formatTargetFormula,
  defaultOutletConfig, hydrateOutletConfig, factoryOutletConfig, DEFAULT_OMSET_PER_PERSON, DEFAULT_DAILY_WAGE,
} from "../../../lib/sdmHarian";
import {
  getReportChannels, getAllReportChannels, getReportUi, groupChannels, cashChannel,
  SETTLE_WALLET_OPTIONS, hydrateReportChannels, hydrateReportUi,
  factoryChannelsForOutlet, factoryUiForOutlet, createChannelId, appendCustomReportChannel,
} from "../../../lib/reportChannels";
import {
  createStaffMessage, createRevisionRequestMessage, visibleStaffMessages, unreadStaffCount,
  markStaffMessageRead, markRevisionMessagesRead, resolveRevisionMessages, cancelRevisionMessagesForReport, isRevisionRequestMessage,
  applyRevisionNoticesFromMessages, formatMessageTime, revisionMessageReportDate, revisionNoteForReport,
  prependStaffMessage, createPurchasingFundMessage, createDailyReportSubmittedMessage,
  createRevisionSubmittedAckMessage,
  createVoidPendingMessage, createDailyReportVerifiedMessage,
} from "../../../lib/staffMessages";
import {
  NOTIFICATION_CATALOG, hydrateNotificationPrefs, getStaffMessageAction,
  getMessageKind, isActionableStaffMessage, notificationKindLabel,
} from "../../../lib/notificationCatalog";
import { mergeDailyRemindersIntoDoc } from "../../../lib/notificationReminders";
import {
  submitSosmedReport, todaySosmedReport, canInputSosmed, resolveSosmedOutlet,
  isSosmedEnabled, hydrateSosmedConfig, sosmedDisplayName, parseLines, linesToText,
  DM_PLATFORMS, SOCIAL_PLATFORMS, STAR_KEYS, SOSMED_OUTLETS, defaultSosmedConfig, emptyReport,
} from "../../../lib/sosmedReport";
import { buildBusinessAnalysis } from "../../../lib/businessAnalysis";
import {
  openWhatsAppShare, formatSosmedWa, formatSosmedFormWa, formatSdmWa,
  formatOmsetWa, formatKeuanganWa, formatVoidWa,
} from "../../../lib/shareWa";
import { pairPageUrl } from "../../../lib/appUrl.js";
import { compressWalletLogo, walletHasLogo } from "../../../lib/walletLogo.js";
import { patchWalletCatalog, sortWallets, migrateReportChannelSettles } from "../../../lib/wallets.js";
import {
  NF_FNB_WALLETS,
  getWalletCatalogForBusiness,
  resolveWalletMergeMode,
  createWalletSetupSeed,
  createSharedWalletLink,
  rebuildWalletsWithShared,
} from "../../../lib/walletPresets.js";
import {
  filterShareableRemoteWallets,
  isCrossBusinessShareableWallet,
  SHARED_WALLET_POLICY_HINT,
} from "../../../lib/sharedWalletPolicy.js";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import PwaInstallBanner, { registerServiceWorker } from "../../../components/PwaInstallBanner";
import NF3Assistant from "../../../components/NF3Assistant";
import TransactionEditSheet from "../../../components/TransactionEditSheet";
import { getTransactionEditPolicy, validateTransactionUpdate, applyTransactionDelete } from "../../../lib/transactionEdit";
import { isPurchasingTx } from "../../../lib/purchasingExpense";
import { purchasingTxTitle, purchasingTxSubtitle } from "../../../lib/purchasingItems";
import { showActionToast } from "../../../lib/actionToast";
import { applyBalanceAdjustment, computeBalanceAdjustment } from "../../../lib/adjustSaldo";
import { playRevisionAlertSound, playNotificationPing, unlockNotificationAudio } from "../../../lib/notificationSound";
import ActionToast from "../../../components/ActionToast";

/** Interval muat ulang awan — jangan terlalu sering (ganggu input staf). */
const CLOUD_POLL_MS = 3 * 60 * 1000;

function isUserTypingInForm() {
  if (typeof document === "undefined") return false;
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/* ============================================================
   NF3 — self-hosted, tampilan mengikuti asli (violet theme)
   ============================================================ */

const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --bg:#F0F0F8;--surface:#FFFFFF;--surface2:#F0F0F8;--line:#E8E8F0;
  --brand:#6366F1;--brand-dark:#4F46E5;--brand-soft:#EEF2FF;--brand-text:#4338CA;
  --ink:#1A1A2E;--ink2:#6B7280;--ink3:#9CA3AF;
  --in:#22C55E;--in-soft:#DCFCE7;--in-text:#15803D;
  --out:#EF4444;--out-soft:#FEE2E2;--out-text:#B91C1C;
  --amber:#F59E0B;--amber-soft:#FEF3C7;
}
[data-theme=dark]{
  --bg:#0F0F1A;--surface:#1A1A2E;--surface2:#252540;--line:#2D2D50;
  --brand:#818CF8;--brand-dark:#6366F1;--brand-soft:#1E1B4B;--brand-text:#A5B4FC;
  --ink:#F1F5F9;--ink2:#94A3B8;--ink3:#64748B;
  --in:#4ADE80;--in-soft:#14532D;--in-text:#86EFAC;
  --out:#F87171;--out-soft:#7F1D1D;--out-text:#FCA5A5;
  --amber:#FCD34D;--amber-soft:#78350F;
}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);}
.scroll-hide::-webkit-scrollbar{display:none}
.scroll-hide{-ms-overflow-style:none;scrollbar-width:none}
.animate-spin{animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.money{font-variant-numeric:tabular-nums;letter-spacing:-0.02em;}
@keyframes pulse-ring{0%{transform:scale(1);opacity:.6}70%{transform:scale(2.2);opacity:0}100%{opacity:0}}
.pulse-ring{animation:pulse-ring 1.4s cubic-bezier(.4,0,.6,1) infinite}
.nf3-shell{min-height:100dvh;background:var(--bg);display:flex;justify-content:center}
.nf3-shell-inner{position:relative;width:100%;min-height:100dvh;background:var(--bg);overflow:hidden}
.nf3-scroll{height:100dvh;overflow-y:auto;padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))}
.nf3-bottom-nav-wrap{position:fixed;bottom:0;left:0;right:0;display:flex;justify-content:center;z-index:10;pointer-events:none}
.nf3-bottom-nav{pointer-events:auto;width:100%;background:var(--surface);border-top:1px solid var(--line);padding-bottom:calc(8px + env(safe-area-inset-bottom,0px))}
@keyframes task-pulse-border{0%,100%{box-shadow:0 2px 12px rgba(99,102,241,.12)}50%{box-shadow:0 2px 18px rgba(99,102,241,.28)}}
@keyframes task-urgent-pulse{0%,100%{box-shadow:0 2px 10px rgba(245,158,11,.18)}50%{box-shadow:0 4px 20px rgba(245,158,11,.38)}}
@keyframes task-check-pop{0%{transform:scale(.55);opacity:0}65%{transform:scale(1.12)}100%{transform:scale(1);opacity:1}}
@keyframes task-progress{from{width:0}to{width:var(--prog,0%)}}
.task-row-pending{animation:task-pulse-border 2.2s ease-in-out infinite}
.task-row-urgent{animation:task-urgent-pulse 2s ease-in-out infinite}
.task-row-done{border-left:4px solid var(--in)!important;transition:border-color .25s,background .25s,opacity .25s}
.task-check-pop{animation:task-check-pop .4s cubic-bezier(.34,1.56,.64,1)}
.task-progress-fill{animation:task-progress .6s ease-out}
.task-row-inner{display:flex;align-items:center;gap:12px;width:100%}
@media(max-width:400px){.task-row-meta{align-items:flex-start!important}.task-row-action-col{margin-top:2px}}
.nf3-bottom-nav-inner{display:flex;align-items:center;height:70px;position:relative}
.nf3-pwa-banner{position:fixed;left:0;right:0;bottom:calc(70px + env(safe-area-inset-bottom,0px) + 8px);z-index:9;display:flex;justify-content:center;padding:0 12px;pointer-events:none}
.nf3-pwa-banner-inner{pointer-events:auto;width:100%;max-width:416px;background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:12px 14px;box-shadow:0 -4px 24px rgba(0,0,0,.12)}
.nf3-pwa-banner-text{margin:0 0 10px;font-size:13px;line-height:1.45;color:var(--ink);font-weight:600}
.nf3-pwa-banner-actions{display:flex;gap:8px;flex-wrap:wrap}
.nf3-pwa-btn{border:none;border-radius:10px;padding:8px 14px;font-size:13px;font-weight:700;cursor:pointer}
.nf3-pwa-btn-primary{background:#185FA5;color:#fff}
.nf3-pwa-btn-ghost{background:var(--surface2);color:var(--ink2)}
`;

const fmtMoney = (n, cur = "IDR", sign = false) => {
  const syms = { IDR: "Rp", USD: "$", MYR: "RM" };
  const locales = { IDR: "id-ID", USD: "en-US", MYR: "ms-MY" };
  const num = Math.round(Number(n) || 0);
  const abs = Math.abs(num);
  const s = new Intl.NumberFormat(locales[cur] || "id-ID").format(abs);
  const sym = syms[cur] || "Rp";
  let prefix = "";
  if (sign === "+") prefix = "+";
  else if (sign === "−" || sign === "-") prefix = "−";
  else if (sign === true && num >= 0) prefix = "+";
  else if (num < 0) prefix = "−";
  if (cur === "IDR") return `${prefix}${sym}${s}`;
  return `${prefix}${sym} ${s}`;
};

const fmtTxAmount = (amount, type, cur = "IDR") => {
  if (type === "in") return fmtMoney(amount, cur, "+");
  if (type === "out") return fmtMoney(amount, cur, "−");
  return fmtMoney(amount, cur);
};

/** Label peringatan saldo vs floor dompet. */
const walletFloorHint = (bal, floor) => {
  if (!floor || floor <= 0) return null;
  const b = Math.round(bal);
  const f = Math.round(floor);
  if (b === f) return "Di batas minimum";
  if (b <= f * 1.2) return "Mendekati minimum";
  return null;
};
const today = () => localISO(new Date());
const dayLabel = (d) => new Date(d + "T12:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (d) => new Date(d + "T12:00:00").toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
const isoOffset = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return localISO(d); };

/** Label waktu singkat untuk bar sync (WIB = jam lokal perangkat). */
const formatSyncClock = (iso) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

/** Kode singkat revisi data — bandingkan antar akun (owner vs purchasing). */
const syncRevisionCode = (doc) => {
  const txs = doc?.transactions?.length || 0;
  const cloudAt = doc?._cloudUpdatedAt || "";
  let h = txs * 997;
  for (let i = 0; i < cloudAt.length; i++) h = ((h << 5) - h + cloudAt.charCodeAt(i)) | 0;
  return `${txs}tx·${Math.abs(h).toString(36).slice(0, 4)}`;
};

const buildSyncMeta = (doc, prevDoc, pulledAt = new Date().toISOString()) => {
  const cloudAt = doc?._cloudUpdatedAt || null;
  const code = syncRevisionCode(doc);
  let hint = null;
  if (prevDoc) {
    const dTx = (doc?.transactions?.length || 0) - (prevDoc?.transactions?.length || 0);
    const cloudChanged = cloudAt && prevDoc?._cloudUpdatedAt && cloudAt !== prevDoc._cloudUpdatedAt;
    if (dTx > 0) hint = `+${dTx} transaksi dari awan`;
    else if (dTx < 0) hint = `${dTx} transaksi`;
    else if (cloudChanged) hint = "Data awan diperbarui";
    else hint = "Sudah versi terbaru";
  }
  return { cloudAt, pulledAt, code, hint };
};

// ─── Storage ───────────────────────────────────────────────
// State disimpan sbg dokumen JSONB per bisnis di Supabase (lib/appState).

// helper saldo dompet
const walletBalance = (walletId, wallets, transactions) => {
  const w = wallets.find(x => x.id === walletId);
  if (!w) return 0;
  const txs = transactions.filter(t => {
    if (t.type === "transfer") {
      const { from, to } = resolveTransferIds(t);
      return from === walletId || to === walletId;
    }
    return resolveWalletId(t) === walletId;
  });
  return (w.opening || 0) + txs.reduce((a, t) => {
    if (t.type === "transfer") {
      const { to } = resolveTransferIds(t);
      return a + (to === walletId ? t.amount : -t.amount);
    }
    return a + (t.type === "in" ? t.amount : -t.amount);
  }, 0);
};

const defaultState = () => ({
  // user aktif (demo: owner)
  currentUser: { id: "u1", name: "Sam", role: "owner", outlet: null },
  // semua user yang bisa login
  users: [
    { id: "u1", name: "Sam", role: "owner", outlet: null },
    { id: "u2", name: "Admin NF3", role: "admin", outlet: null },
    { id: "u3", name: "Kasir KBU", role: "kasir", outlet: "KBU" },
    { id: "u4", name: "Kasir KSM", role: "kasir", outlet: "KSM" },
    { id: "u5", name: "Kasir SMT", role: "kasir", outlet: "SMT" },
    { id: "u6", name: "Purchasing", role: "purchasing", outlet: null },
  ],
  profile: { name: "Nf3", type: "Usaha", currency: "IDR", theme: "light", email: "sampriatna@gmail.com", pin: "aktif", biometric: true },
  automation: { autoImport: true, replyNotif: true, revisionAlertSound: true },
  notificationPrefs: hydrateNotificationPrefs(null),
  wallets: NF_FNB_WALLETS.map((w) => ({ ...w })),
  categories: [
    { id: "ci1", name: "Penjualan Makanan", type: "in", active: true, role: null },
    { id: "ci2", name: "Penjualan Minuman", type: "in", active: true, role: null },
    { id: "ci3", name: "Takeaway / Grab", type: "in", active: true, role: null },
    { id: "ci_tunai", name: "Penjualan Tunai", type: "in", active: true, role: "kasir" },
    { id: "ci_qris_bca", name: "Penjualan QRIS BCA", type: "in", active: true, role: null },
    { id: "ci_qris_bri", name: "Penjualan QRIS BRI", type: "in", active: true, role: null },
    { id: "ci_gojek", name: "Penjualan Gojek", type: "in", active: true, role: null },
    { id: "ci4", name: "Modal Masuk", type: "in", active: true, role: null },
    { id: "ci5", name: "Lain-lain", type: "in", active: true, role: null },
    { id: "cp1", name: "Bahan Baku", type: "out", active: true, role: "purchasing", icon: "shopping-bag", color: "#1D9E75", sort: 1, accounting_group: "hpp", description: "Ayam, beras, sayur, bumbu, susu, kopi, minyak. Bisa habis untuk membuat menu." },
    { id: "cp2", name: "Kemasan", type: "out", active: true, role: "purchasing", icon: "box", color: "#0F6E56", sort: 2, accounting_group: "hpp", description: "Cup, mangkuk, plastik, paper bag, sendok takeaway. Dipakai membungkus pesanan." },
    { id: "cp3", name: "Gas LPG", type: "out", active: true, role: "purchasing", icon: "flame", color: "#D85A30", sort: 3, accounting_group: "hpp", description: "Pembelian tabung gas LPG untuk memasak." },
    { id: "cp4", name: "Listrik, Air & Internet", type: "out", active: true, role: "purchasing", icon: "bolt", color: "#378ADD", sort: 4, accounting_group: "beban_operasional", description: "Tagihan listrik, air, WiFi, token listrik." },
    { id: "cp5", name: "Gaji & Upah", type: "out", active: true, role: "purchasing", icon: "users", color: "#085041", sort: 5, accounting_group: "beban_operasional", description: "Gaji staf, upah harian, tunjangan." },
    { id: "cp6", name: "Sewa Tempat", type: "out", active: true, role: "purchasing", icon: "building", color: "#5F5E5A", sort: 6, accounting_group: "beban_operasional", description: "Sewa ruko, kontrakan outlet, sewa tempat usaha." },
    { id: "cp7", name: "Kebutuhan Operasional", type: "out", active: true, role: "purchasing", icon: "settings", color: "#7F77DD", sort: 7, accounting_group: "beban_operasional", description: "Sabun, tisu, alat kebersihan, ATK, galon, kebutuhan outlet sehari-hari." },
    { id: "cp8", name: "Transport & Ongkos Belanja", type: "out", active: true, role: "purchasing", icon: "truck", color: "#BA7517", sort: 8, accounting_group: "beban_operasional", description: "Bensin, parkir, ongkir, ongkos mengambil barang." },
    { id: "cp9", name: "Peralatan & Perbaikan", type: "out", active: true, role: "purchasing", icon: "tools", color: "#993C1D", sort: 9, accounting_group: "beban_operasional", description: "Pisau, baskom, gelas, kabel, servis kompor, servis keran. Barang kecil dipakai berulang." },
    { id: "cp10", name: "Promosi", type: "out", active: true, role: "purchasing", icon: "speakerphone", color: "#D4537E", sort: 10, accounting_group: "beban_operasional", description: "Iklan, cetak banner, endorse, diskon promosi." },
    { id: "cp11", name: "Pembelian Aset", type: "out", active: true, role: "purchasing", icon: "device-laptop", color: "#534AB7", sort: 11, accounting_group: "aset", description: "Kulkas, freezer, AC, mesin kopi, laptop, tablet, meja besar. Barang mahal dan tahan lama." },
    { id: "cp12", name: "Keperluan Owner", type: "out", active: true, role: "purchasing", icon: "user", color: "#888780", sort: 12, accounting_group: "pribadi", description: "Pengambilan atau pembelian untuk kebutuhan pribadi owner. Bukan biaya usaha." },
    { id: "cp13", name: "Lain-lain", type: "out", active: true, role: "purchasing", icon: "dots", color: "#B4B2A9", sort: 13, accounting_group: "lain", description: "Wajib isi keterangan di kolom catatan." },
  ],
  transactions: [],
  dailyReports: [],
  sdmReports: [],
  voidLogs: [],
  outletConfig: defaultOutletConfig(),
  reportChannels: hydrateReportChannels(null),
  reportUi: hydrateReportUi(null),
  hiddenInsights: [],
  pairCode: "WARUNG-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
  rawInbox: [],
  staffMessages: [],
  sosmedReports: [],
  sosmedConfig: defaultSosmedConfig(),
});

// Validasi floor sebelum simpan transaksi keluar (PayLater/hutang boleh minus)
const isPaylaterWallet = (w) => w?.type === "paylater" || w?.liability === true;
const walletAllowNegative = (w) => isPaylaterWallet(w) || w?.allowNegative === true;

const formatWalletBal = (w, bal, cur, user) => walletBalanceDisplay(w, bal, cur, user, fmtMoney) ?? "—";

function patchPurchasingWallet(w) {
  if (!w) return w;
  const out = { ...w };
  const kasKecilName = /kas\s*kecil/i.test(w.name || "");

  if (PURCHASING_WALLET_IDS.has(w.id) || w.purchasingUse === true || kasKecilName) {
    out.purchasingUse = true;
  }
  if (w.id === "w_shopee_paylater") {
    out.type = out.type || "paylater";
    out.liability = true;
    out.allowNegative = true;
  }
  if (w.type === "rekening" && w.id !== "w_owner") {
    out.hide_balance = out.hide_balance ?? true;
  }
  return out;
}

const checkFloor = (walletId, amount, wallets, transactions, user) => {
  const w = wallets.find(x => x.id === walletId);
  if (!w || walletAllowNegative(w)) return null;
  const bal = walletBalance(walletId, wallets, transactions);
  const hidden = shouldHideWalletBalance(w, user);
  if (!w.floor && bal - amount < 0) {
    return hidden
      ? `Saldo ${w.name} tidak cukup untuk transaksi ini.`
      : `Saldo tidak cukup. Saldo saat ini: ${new Intl.NumberFormat("id-ID").format(bal)}`;
  }
  if (!w.floor) return null;
  if (bal - amount < w.floor) {
    return hidden
      ? `Saldo ${w.name} tidak cukup untuk transaksi ini.`
      : `Saldo tidak cukup. Minimum saldo: ${new Intl.NumberFormat("id-ID").format(w.floor)} · Saldo saat ini: ${new Intl.NumberFormat("id-ID").format(bal)}`;
  }
  return null;
};

/** Gabung dompet default + patch flag purchasing (BCA/BRI/Mandiri/BNI dll). */
function mergeWallets(defaults, saved, { mode = "canonical" } = {}) {
  if (mode === "saved-only") {
    return sortWallets((saved || []).map((w) => patchPurchasingWallet({ ...w })));
  }
  const savedList = saved || [];
  const byId = new Map(savedList.map((w) => [w.id, w]));
  const merged = (defaults || []).map((def) => {
    const ex = byId.get(def.id);
    if (!ex) return patchPurchasingWallet({ ...def });
    return patchPurchasingWallet({
      ...def,
      ...ex,
      logoUrl: ex.logoUrl ?? def.logoUrl ?? null,
      sort: ex.sort ?? def.sort ?? null,
      purchasingUse: def.purchasingUse === true ? true : (ex.purchasingUse ?? def.purchasingUse ?? false),
      hide_balance: def.hide_balance === true ? true : (ex.hide_balance ?? def.hide_balance ?? false),
      liability: ex.liability ?? def.liability ?? false,
      allowNegative: ex.allowNegative ?? def.allowNegative ?? false,
      type: ex.type || def.type,
    });
  });
  const defaultIds = new Set((defaults || []).map((d) => d.id));
  savedList.filter((w) => !defaultIds.has(w.id)).forEach((w) => merged.push(patchPurchasingWallet(w)));
  if (mode === "canonical") return patchWalletCatalog(merged);
  return sortWallets(merged);
}

async function loadState(bizId, { businessType } = {}) {
  const saved = await loadAppState(bizId);
  if (saved && Object.keys(saved).length) {
    const { _cloudUpdatedAt, currentUser: _cu, users: _u, ...savedClean } = saved;
    const base = defaultState();
    const walletSetup = savedClean.walletSetup || saved.walletSetup || null;
    const resolvedType = walletSetup?.businessType || savedClean.profile?.businessType || saved.profile?.businessType || businessType;
    const mergeMode = resolveWalletMergeMode(bizId, savedClean);
    const catalog = getWalletCatalogForBusiness(bizId, resolvedType);
    const mergedWallets = mergeWallets(
      mergeMode === "saved-only" ? [] : catalog,
      savedClean.wallets || saved.wallets,
      { mode: mergeMode }
    );
    const wallets = rebuildWalletsWithShared(mergedWallets, walletSetup);
      const txs = dedupeTransactionsById(savedClean.transactions || saved.transactions || []);
    return {
      ...base,
      ...savedClean,
      _cloudUpdatedAt,
      _cloudLoaded: true,
      walletSetup,
      wallets,
      categories: ensurePurchasingCategories(
        cleanCategoryList(
          mergeCategoriesFromDb(base.categories, savedClean.categories || saved.categories || [])
        ),
        cleanCategoryList
      ),
      transactions: txs,
      profile: { ...base.profile, ...(savedClean.profile || saved.profile) },
      automation: { ...base.automation, ...(savedClean.automation || saved.automation) },
      dailyReports: savedClean.dailyReports || saved.dailyReports || base.dailyReports,
      sdmReports: savedClean.sdmReports || saved.sdmReports || base.sdmReports,
      voidLogs: savedClean.voidLogs || saved.voidLogs || base.voidLogs,
      staffMessages: savedClean.staffMessages || saved.staffMessages || base.staffMessages,
      notificationPrefs: hydrateNotificationPrefs(savedClean.notificationPrefs || saved.notificationPrefs || base.notificationPrefs),
      sosmedReports: savedClean.sosmedReports || saved.sosmedReports || base.sosmedReports,
      sosmedConfig: hydrateSosmedConfig(savedClean.sosmedConfig || saved.sosmedConfig),
      outletConfig: hydrateOutletConfig({ ...base.outletConfig, ...(savedClean.outletConfig || saved.outletConfig || {}) }),
      reportChannels: migrateReportChannelSettles(hydrateReportChannels(savedClean.reportChannels || saved.reportChannels)),
      reportUi: hydrateReportUi(savedClean.reportUi || saved.reportUi),
      hiddenInsights: Array.isArray(savedClean.hiddenInsights)
        ? savedClean.hiddenInsights
        : (Array.isArray(saved.hiddenInsights) ? saved.hiddenInsights : base.hiddenInsights),
      rawInbox: stripDemoInbox(savedClean.rawInbox ?? saved.rawInbox ?? base.rawInbox),
    };
  }
  return { ...defaultState(), _cloudLoaded: true };
}
async function saveState(bizId, s) {
  const { currentUser, users, _systemThemeTick, _cloudUpdatedAt, _cloudLoaded, ...data } = s || {};
  if (data.categories) data.categories = cleanCategoryList(data.categories);
  await saveAppState(bizId, data);
}

/** Identitas login — satu-satunya sumber permission (bukan state tersimpan). */
function sessionUser(authUser) {
  if (!authUser?.id) return { id: "", name: "", role: "kasir", outlet: null };
  const resolved = resolveAuthMembership({
    role: authUser.role,
    outlet: authUser.outlet,
    email: authUser.email,
  });
  return {
    id: authUser.id,
    name: authUser.name,
    role: resolved.role,
    outlet: resolved.outlet,
  };
}

function withReconciledReports(doc) {
  if (!doc) return doc;
  let dailyReports = reconcileDailyReports(doc.dailyReports || [], doc.transactions || []);
  dailyReports = applyRevisionNoticesFromMessages(dailyReports, doc.staffMessages);
  const prev = doc.dailyReports || [];
  const changed =
    dailyReports.length !== prev.length
    || dailyReports.some((r, i) => r.status !== prev[i]?.status || r.revisionNote !== prev[i]?.revisionNote);
  return changed ? { ...doc, dailyReports } : { ...doc, dailyReports };
}

function withSessionUser(s, authUser) {
  if (!s) return s;
  return { ...withReconciledReports(s), currentUser: sessionUser(authUser) };
}

// ─── Inbox: demo strip + paste parser ───────────────────────
const DEMO_INBOX_IDS = new Set(["n1", "n2", "n3", "n4"]);

function isDemoInboxItem(n) {
  if (!n) return false;
  if (DEMO_INBOX_IDS.has(n.id)) return true;
  const title = (n.title || "").toLowerCase();
  return n.src === "ShopeePay" && (
    title.includes("raih koin") || title.includes("bonus s.d") || title.includes("canva pro gratis")
  );
}

function stripDemoInbox(rawInbox) {
  return (rawInbox || []).filter(n => !isDemoInboxItem(n));
}

const NOTIF_SRC_RULES = [
  { re: /shopee\s*pay|shopeepay|seller center/i, src: "ShopeePay" },
  { re: /gojek|gopay|go\s*food/i, src: "GoPay" },
  { re: /grab/i, src: "GrabPay" },
  { re: /bca|klikbca|mybca/i, src: "BCA" },
  { re: /bri|brimo/i, src: "BRI" },
  { re: /mandiri|livin/i, src: "Mandiri" },
  { re: /bni/i, src: "BNI" },
  { re: /dana\b/i, src: "DANA" },
  { re: /ovo\b/i, src: "OVO" },
];

function detectNotifSrc(text) {
  for (const { re, src } of NOTIF_SRC_RULES) {
    if (re.test(text)) return src;
  }
  return "Notifikasi";
}

function parsePastedNotif(raw) {
  const text = (raw || "").trim();
  if (!text) return null;
  const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
  const src = detectNotifSrc(text);
  let title = lines[0] || text.slice(0, 100);
  let body = lines.length > 1 ? lines.slice(1).join(" · ") : text;
  if (lines.length > 1 && lines[0].length <= 24 && NOTIF_SRC_RULES.some(r => r.re.test(lines[0]))) {
    title = lines[1] || lines[0];
    body = lines.slice(2).join(" · ") || lines.slice(1).join(" · ");
  }
  return {
    id: "n" + Date.now() + Math.random().toString(36).slice(2, 5),
    src,
    title,
    body,
  };
}

function walletForNotifSrc(src, wallets) {
  const s = (src || "").toLowerCase();
  const map = [
    [/shopee/, "w_shopeepay"],
    [/gojek|gopay|go pay/, "w_gojek"],
    [/grab/, "w_nf"],
    [/bca/, "w_bca"],
    [/bri/, "w_bri"],
    [/mandiri/, "w_mandiri"],
    [/bni/, "w_bni"],
  ];
  for (const [re, id] of map) {
    if (re.test(s)) {
      const w = wallets.find(x => x.id === id && x.active !== false);
      if (w) return w;
    }
  }
  return wallets.find(w => w.active !== false) || wallets[0];
}

// ─── Classifier ────────────────────────────────────────────
const SPAM = ["raih koin","kumpulkan","bonus s.d","gratis","voucher","diskon","promo","flash sale","klaim","hadiah","s.d.","kupon","berhadiah"];
const REAL = ["saldo penjual diperbarui","pesanan","telah selesai","pembayaran berhasil","transfer berhasil","dana masuk","pencairan","withdraw","topup berhasil","settlement","diterima dari"];
function classifyNotif(n) {
  const t = (n.title + " " + n.body).toLowerCase();
  const amt = Math.max(0, ...[...t.matchAll(/rp\s*([0-9][0-9.,]*)/gi)].map(m => parseInt(m[1].replace(/[.,]/g, ""), 10)).filter(Boolean));
  let score = 0;
  SPAM.forEach(h => { if (t.includes(h)) score -= 2; });
  REAL.forEach(h => { if (t.includes(h)) score += 3; });
  if (/pesanan\s+[a-z0-9]{8,}/i.test(t)) score += 2;
  if (amt > 0 && amt < 5) score -= 3;
  return { amount: amt, score, verdict: score >= 3 ? "legit" : "promo" };
}

// ─── AI helpers ────────────────────────────────────────────
async function aiParseText(text, cats) {
  // Diproses di server route /api/parse — ANTHROPIC_API_KEY tetap di server.
  return aiParse({ mode: "text", text, categories: cats });
}
async function aiParseReceipt(b64, mime, cats) {
  return aiParse({ mode: "receipt", image: b64, media: mime, categories: cats });
}

// ─── Primitives ────────────────────────────────────────────
const Card = ({ children, style, className = "", onClick }) => (
  <div onClick={onClick} style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 16, ...style }} className={className}>{children}</div>
);
const Pill = ({ children, active, onClick, color }) => (
  <button onClick={onClick} style={{ padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600, border: active ? "none" : "1px solid var(--line)", background: active ? "var(--brand)" : "var(--surface)", color: active ? "#fff" : "var(--ink2)", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", cursor: "pointer" }}>
    {color && <span style={{ width: 8, height: 8, borderRadius: 99, background: color, display: "inline-block" }} />}{children}
  </button>
);
const Tog = ({ on, onToggle }) => (
  <button onClick={onToggle} style={{ width: 48, height: 28, borderRadius: 999, background: on ? "var(--brand)" : "var(--line)", padding: 3, display: "flex", alignItems: "center", justifyContent: on ? "flex-end" : "flex-start", border: "none", cursor: "pointer", transition: "background .2s", flexShrink: 0 }}>
    <span style={{ width: 22, height: 22, borderRadius: 999, background: "#fff", display: "block" }} />
  </button>
);
const Lbl = ({ children }) => <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--brand)", marginBottom: 10 }}>{children}</div>;

function Sheet({ title, onClose, children }) {
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 1000, background: "var(--bg)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "14px 16px", background: "var(--surface)", borderBottom: "1px solid var(--line)", flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 99, background: "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink)" }}><ArrowLeft size={18} /></button>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{title}</span>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }} className="scroll-hide">{children}</div>
    </div>
  );
}

function ShareWaBtn({ text, phone, label = "Bagikan ke WhatsApp", compact, style: extraStyle }) {
  if (!text) return null;
  return (
    <button type="button" onClick={() => openWhatsAppShare(text, phone)}
      style={{
        width: compact ? "auto" : "100%",
        marginTop: compact ? 0 : 10,
        padding: compact ? "8px 12px" : "13px 14px",
        borderRadius: compact ? 10 : 14,
        border: "none",
        background: "#25D366",
        color: "#fff",
        fontWeight: 700,
        fontSize: compact ? 12 : 14,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...extraStyle,
      }}>
      <Share2 size={compact ? 14 : 18} />
      {label}
    </button>
  );
}

const catIconMap = { "Bahan Baku": ShoppingCart, "Gaji & Upah": Users, "Operasional": Zap, "Penjualan": Store, "Modal Masuk": PiggyBank, "Listrik & Internet": Zap };
const getCatIcon = (cat) => catIconMap[cat?.name] || MoreHorizontal;

/** Klasifikasi visual transaksi omset: tunai, QRIS, digital, geser laci. */
function resolveTxVisual(tx, cat, wallets) {
  const desc = (tx.desc || "").toLowerCase();
  const catName = (cat?.name || "").toLowerCase();
  const ch = (tx.reportChannelId || "").toLowerCase();
  const blob = `${desc} ${catName} ${ch}`;

  if (tx.type === "transfer") {
    const from = (wallets || []).find(w => w.id === tx.fromWalletId);
    const to = (wallets || []).find(w => w.id === tx.toWalletId);
    const fromLaci = /laci/i.test(from?.name || "") || /^w_laci_/.test(tx.fromWalletId || "");
    const toKasBesar = /kas besar/i.test(to?.name || "") || tx.toWalletId === "w_kas_besar";
    if (fromLaci && toKasBesar || /setoran tunai|geser laci|→ kas besar/i.test(desc)) {
      return { kind: "laci", bg: "#EDE9FE", color: "#6D28D9", badge: "Laci" };
    }
    return { kind: "transfer", bg: "var(--brand-soft)", color: "var(--brand)", badge: "Trf" };
  }

  if (tx.type === "in") {
    if (/omset tunai|penjualan tunai/.test(blob) || (/\btunai\b/.test(blob) && !/qris|gojek|online|shopee|grab|edc|debit/.test(blob))) {
      return { kind: "cash", bg: "#DCFCE7", color: "#15803D", badge: "Tunai" };
    }
    if (/qris|edc|debit/.test(blob)) {
      if (/bri|debit bri|edc bri/.test(blob)) return { kind: "qris", bg: "#FEE2E2", color: "#DC2626", badge: "BRI" };
      if (/bca|edc bca|mandiri/.test(blob)) return { kind: "qris", bg: "#DBEAFE", color: "#1D4ED8", badge: "BCA" };
      return { kind: "qris", bg: "#EEF2FF", color: "#4338CA", badge: "QRIS" };
    }
    if (/shopee|shopefood/.test(blob)) return { kind: "digital", bg: "#FFEDD5", color: "#EA580C", badge: "Shopee" };
    if (/gojek|gofood|ojek/.test(blob)) return { kind: "digital", bg: "#DCFCE7", color: "#00AA13", badge: "Gojek" };
    if (/grab/.test(blob)) return { kind: "digital", bg: "#D1FAE5", color: "#00B14F", badge: "Grab" };
    if (/online/.test(blob)) return { kind: "digital", bg: "#E0F2FE", color: "#0284C7", badge: "Online" };
  }

  const isIn = tx.type === "in";
  return { kind: "default", bg: isIn ? "var(--in-soft)" : "var(--out-soft)", color: isIn ? "var(--in-text)" : "var(--out-text)", cat };
}

function TxRowIcon({ visual, size = 40 }) {
  const { kind, bg, color, badge, cat } = visual;
  const shell = {
    width: size, height: size, borderRadius: 12, background: bg, flexShrink: 0,
    display: "grid", placeItems: "center", border: `1.5px solid ${color}28`,
  };

  if (kind === "qris") {
    return (
      <div style={shell} title={`QRIS ${badge}`}>
        <div style={{ textAlign: "center", lineHeight: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color, letterSpacing: "-0.04em" }}>QR</div>
          <div style={{ fontSize: 7, fontWeight: 800, color, opacity: 0.9, marginTop: 1 }}>{badge === "QRIS" ? "IS" : badge}</div>
        </div>
      </div>
    );
  }
  if (kind === "digital") {
    return (
      <div style={shell} title={badge}>
        <div style={{ fontSize: badge.length > 5 ? 9 : 10, fontWeight: 900, color, letterSpacing: "-0.03em", textAlign: "center", padding: "0 2px" }}>
          {badge}
        </div>
      </div>
    );
  }
  if (kind === "cash") {
    return (
      <div style={shell} title="Omset tunai">
        <Banknote size={19} color={color} strokeWidth={2.2} />
      </div>
    );
  }
  if (kind === "laci") {
    return (
      <div style={shell} title="Geser laci → Kas Besar">
        <ArrowLeftRight size={19} color={color} strokeWidth={2.2} />
      </div>
    );
  }

  const Ic = kind === "transfer" ? RefreshCw : getCatIcon(cat);
  return (
    <div style={{ ...shell, border: "none", color }}>
      <Ic size={16} />
    </div>
  );
}

function WalletIcon({ wallet, size = 40 }) {
  const r = Math.round(size * 0.3);
  if (walletHasLogo(wallet)) {
    return (
      <div style={{
        width: size, height: size, borderRadius: r, overflow: "hidden", flexShrink: 0,
        background: (wallet.color || "#6366F1") + "18",
        border: `1.5px solid ${(wallet.color || "#6366F1")}33`,
        boxShadow: "0 1px 4px rgba(0,0,0,.06)",
      }}>
        <img src={wallet.logoUrl} alt="" loading="lazy" decoding="async"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: r, flexShrink: 0,
      background: (wallet?.color || "#6366F1") + "22",
      display: "grid", placeItems: "center", color: wallet?.color || "#6366F1",
    }}>
      <Wallet size={Math.round(size * 0.45)} />
    </div>
  );
}

function DailyTaskRow({ step, title, subtitle, done, blocked, urgent, count, optional, onClick }) {
  const rowClass = [
    "task-row-inner",
    done ? "task-row-done" : urgent ? "task-row-urgent" : !blocked && !optional ? "task-row-pending" : "",
  ].filter(Boolean).join(" ");
  const badgeLabel = done ? "Selesai" : blocked ? "Tunggu" : urgent ? (count ? `${count} pending` : "Perlu aksi") : optional ? "Opsional" : "Wajib isi";
  const badgeBg = done ? "var(--in-soft)" : blocked ? "var(--surface2)" : urgent ? "#FEE2E2" : optional ? "var(--surface2)" : "#FEF3C7";
  const badgeColor = done ? "var(--in-text)" : blocked ? "var(--ink3)" : urgent ? "var(--out-text)" : optional ? "var(--ink3)" : "#B45309";
  const actionLabel = done ? "Lihat" : urgent ? "Proses" : optional ? "Buka" : "Isi";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={blocked}
      style={{
        width: "100%",
        padding: "14px 14px 14px 12px",
        borderRadius: 16,
        border: done ? "1px solid var(--line)" : urgent ? "2px solid #F59E0B" : optional ? "1px dashed var(--line)" : "2px solid var(--brand)",
        background: done ? "var(--surface)" : urgent ? "var(--amber-soft)" : optional ? "var(--surface2)" : "var(--brand-soft)",
        cursor: blocked ? "not-allowed" : "pointer",
        textAlign: "left",
        opacity: blocked ? 0.55 : done ? 0.92 : 1,
        boxShadow: done || optional ? "none" : urgent ? undefined : "0 2px 12px rgba(99,102,241,.12)",
        transition: "transform .15s ease, opacity .25s ease",
      }}
      className={done ? "task-row-done" : urgent ? "task-row-urgent" : !blocked && !optional ? "task-row-pending" : undefined}
      onMouseDown={e => { if (!blocked) e.currentTarget.style.transform = "scale(0.985)"; }}
      onMouseUp={e => { e.currentTarget.style.transform = ""; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
    >
      <div className={rowClass}>
        <div
          className={done ? "task-check-pop" : undefined}
          style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: done ? "var(--in-soft)" : urgent ? "#F59E0B" : optional ? "var(--line)" : "var(--brand)",
            color: done ? "var(--in-text)" : optional ? "var(--ink3)" : "#fff",
            display: "grid", placeItems: "center", fontWeight: 800, fontSize: done ? 18 : 15,
          }}
        >
          {done ? <Check size={20} strokeWidth={3} /> : optional ? "★" : step}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)", lineHeight: 1.3, textDecoration: done ? "none" : "none" }}>{title}</div>
          <div style={{ fontSize: 12, color: done ? "var(--ink3)" : "var(--ink2)", marginTop: 3, lineHeight: 1.45 }}>{subtitle}</div>
        </div>
        <div className="task-row-action-col" style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span style={{
            fontSize: 10, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase",
            padding: "3px 8px", borderRadius: 99, background: badgeBg, color: badgeColor,
            whiteSpace: "nowrap",
          }}>
            {badgeLabel}
          </span>
          {!blocked && (
            <span style={{ fontSize: 12, fontWeight: 700, color: done ? "var(--ink3)" : urgent ? "#B45309" : "var(--brand)", display: "flex", alignItems: "center", gap: 2 }}>
              {actionLabel} <ChevronRight size={14} />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function RoleDailyChecklist({ tasks, accentGradient, headerLabel = "Checklist Harian", headerHint }) {
  const activeTasks = tasks.filter(t => !t.optional);
  const doneCount = activeTasks.filter(t => t.done).length;
  const total = activeTasks.length;
  const allDone = total > 0 && doneCount === total;
  const urgentCount = activeTasks.filter(t => !t.done && t.urgent).length;
  const pendingCount = total - doneCount;

  const statusLine = allDone
    ? "Semua tugas selesai ✓"
    : urgentCount > 0
      ? `${urgentCount} perlu ditindaklanjuti`
      : `${pendingCount} tugas belum selesai`;

  return (
    <div style={{ padding: "0 16px", marginBottom: 16 }}>
      <div style={{
        borderRadius: 20, padding: "16px 16px 14px", marginBottom: 12,
        background: accentGradient || "linear-gradient(135deg,#6366F1,#4F46E5)",
        color: "#fff",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.85 }}>{headerLabel}</div>
            <div style={{ fontWeight: 800, fontSize: 17, marginTop: 4, lineHeight: 1.3 }}>{statusLine}</div>
            {headerHint && <div style={{ fontSize: 12, opacity: 0.82, marginTop: 4, lineHeight: 1.4 }}>{headerHint}</div>}
          </div>
          {total > 0 && (
            <div style={{
              minWidth: 44, height: 44, borderRadius: 14, flexShrink: 0,
              background: allDone ? "rgba(74,222,128,.35)" : "rgba(255,255,255,.18)",
              display: "grid", placeItems: "center", fontWeight: 800, fontSize: 15,
              transition: "background .3s",
            }}>
              {doneCount}/{total}
            </div>
          )}
        </div>
        {total > 0 && (
          <div style={{ marginTop: 12, height: 5, borderRadius: 99, background: "rgba(255,255,255,.25)", overflow: "hidden" }}>
            <div
              className="task-progress-fill"
              style={{
                width: `${(doneCount / total) * 100}%`, height: "100%",
                background: allDone ? "#4ADE80" : "#fff", borderRadius: 99,
                transition: "width .45s ease, background .3s",
                ["--prog"]: `${(doneCount / total) * 100}%`,
              }}
            />
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tasks.map((t, i) => {
          const step = t.optional ? "★" : tasks.slice(0, i).filter(x => !x.optional).length + 1;
          return <DailyTaskRow key={t.id} step={step} {...t} />;
        })}
      </div>
    </div>
  );
}

// ─── Konteks bisnis (F&B vs e-commerce) ───────────────────
function BusinessContextBanner({ business, businesses, switchBusiness, features }) {
  const canonical = findCanonicalInList(businesses || []);
  const multi = (businesses?.length || 0) > 1;

  if (features.isFnB) {
    if (!multi) return null;
    return (
      <div style={{ margin: "0 16px 14px", padding: "10px 14px", background: "var(--brand-soft)", border: "1px solid var(--line)", borderRadius: 12, fontSize: 12, color: "var(--brand-text)", lineHeight: 1.45 }}>
        <span style={{ fontWeight: 800 }}>{CANONICAL_DISPLAY_NAME}</span> — resto KBU/KSM/SMT. Ganti bisnis lain lewat tab <b>Atur</b>.
      </div>
    );
  }

  return (
    <div style={{ margin: "0 16px 14px", padding: "12px 14px", background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 12 }}>
      <div style={{ fontWeight: 800, fontSize: 13, color: "#1D4ED8" }}>
        {resolveBusinessDisplayName(business)} · {features.label}
      </div>
      <div style={{ fontSize: 12, color: "#1E3A8A", marginTop: 6, lineHeight: 1.5 }}>
        Anda sedang di bisnis <b>e-commerce/UMKM</b> — dompet kas & operasional terpisah dari resto.
        Hanya <b>rekening bank</b> yang boleh dihubungkan antar bisnis; NF Cash & laci outlet hanya di {CANONICAL_DISPLAY_NAME}.
      </div>
      {canonical && switchBusiness && (
        <button
          type="button"
          onClick={() => switchBusiness(canonical.id)}
          style={{
            marginTop: 10,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: "#2563EB",
            color: "#fff",
            fontWeight: 700,
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Buka {CANONICAL_DISPLAY_NAME} (F&B)
        </button>
      )}
    </div>
  );
}

function FnbGateSheet({ target, onClose, onSwitch, canonicalName }) {
  return (
    <Sheet title="Fitur khusus Nusa Food" onClose={onClose}>
      <div style={{ padding: "8px 4px 24px", fontSize: 14, lineHeight: 1.55, color: "var(--ink2)" }}>
        <p style={{ margin: "0 0 12px" }}>
          <b>{fnbFeatureLabel(target)}</b> hanya untuk resto F&B (KBU, KSM, SMT) — bukan untuk bisnis e-commerce/UMKM yang sedang aktif.
        </p>
        <p style={{ margin: "0 0 16px" }}>
          Pindah ke <b>{canonicalName || CANONICAL_DISPLAY_NAME}</b> untuk settle omset, purchasing, atau tugas outlet.
        </p>
        <button
          type="button"
          onClick={onSwitch}
          style={{
            width: "100%",
            padding: "13px 14px",
            borderRadius: 12,
            border: "none",
            background: "var(--brand)",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Pindah ke {canonicalName || CANONICAL_DISPLAY_NAME}
        </button>
      </div>
    </Sheet>
  );
}

// ─── Beranda ───────────────────────────────────────────────
function Beranda({ s, setTab, setOverlay, onOpenLaporan, hide, setHide, onCloudSync, cloudSyncState, syncInfo, bizId, session, businessDisplayName, onCatat, business, businesses, switchBusiness, features }) {
  const cur = s.profile.currency;
  const prefix = today().slice(0, 7);
  const user = s.currentUser || { role: "kasir" };
  const myWallets = visibleWalletsForBusiness(s.wallets, user, business);
  const scopedTx = visibleTransactionsForBusiness(s.transactions, s.wallets, user, business);
  const monthIn = scopedTx.filter(t => t.type === "in" && t.date.startsWith(prefix)).reduce((a, b) => a + b.amount, 0);
  const monthOut = scopedTx.filter(t => t.type === "out" && t.date.startsWith(prefix)).reduce((a, b) => a + b.amount, 0);
  const totalSaldo = user.role === "purchasing"
    ? walletBalance("w_kas_kecil", s.wallets, s.transactions)
    : walletsForSaldoTotal(myWallets, user).reduce((a, w) => a + walletBalance(w.id, s.wallets, s.transactions), 0);
  const inboxCount = canDo(user.role, "inputIncome") ? (s.rawInbox || []).length : 0;
  const notifCount = unreadStaffCount(s.staffMessages, user);
  const scopeLabel = user.role === "kasir" ? `Laci ${user.outlet}` : user.role === "purchasing" ? "Dompet belanja" : "Seluruh dompet";
  const waitingSettle = features.settleLaci && canDo(user.role, "settleLaci") ? pendingReports(s.dailyReports, s.transactions) : [];
  const awaitingVerify = features.settleLaci && canDo(user.role, "settleLaci") ? reportsAwaitingVerify(s.dailyReports, s.transactions) : [];
  const readyToSettle = features.settleLaci && canDo(user.role, "settleLaci") ? reportsReadyToSettle(s.dailyReports, s.transactions) : [];
  const overdueSettle = waitingSettle.filter(r => reportSettleUrgency(r) === "overdue").length;
  const todayReport = user.role === "kasir"
    ? (s.dailyReports || []).find(r => r.outlet === user.outlet && r.date === today() && r.status !== "settled")
    : null;
  const pendingRevisionReport = user.role === "kasir"
    ? findPendingRevisionReport(s.dailyReports, user.outlet, s.staffMessages)
    : null;
  const needsRevision = pendingRevisionReport || (todayReport?.status === "revision_requested" ? todayReport : null);
  const todaySdm = user.role === "kasir" ? todaySdmReport(s.sdmReports, user.outlet, today()) : null;
  const showSosmed = features.sosmedReports && canInputSosmed(user, s.sosmedConfig);
  const sosmedOutlet = user.role === "kasir" ? user.outlet : (SOSMED_OUTLETS.find(o => isSosmedEnabled(s.sosmedConfig, o)) || "KBU");
  const todaySosmed = showSosmed && sosmedOutlet && isSosmedEnabled(s.sosmedConfig, sosmedOutlet)
    ? todaySosmedReport(s.sosmedReports, sosmedOutlet, today()) : null;
  const ui = getAccountUi(user, business);
  const dailyTarget = todaySdm?.targetOmset || 0;
  const pendingVoids = canDo(user.role, "reviewVoidLog") ? pendingVoidLogs(s.voidLogs).length : 0;
  const todayOutTx = scopedTx.filter(t => t.type === "out" && t.date === today());
  const todayOutTotal = todayOutTx.reduce((a, t) => a + t.amount, 0);
  const adminSosmedEnabled = showSosmed && user.role !== "kasir" && sosmedOutlet && isSosmedEnabled(s.sosmedConfig, sosmedOutlet);

  return (
    <div style={{ padding: "0 0 90px" }}>
      {/* header */}
      <div style={{ padding: "16px 20px 12px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: "var(--ink)" }}>{businessDisplayName || s.profile.name}</div>
            <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99, background: ui.badgeBg, color: ui.badgeColor }}>
              {ui.roleLabel}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>{dayLabel(today())}</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink2)", marginTop: 6 }}>{ui.homeTitle}</div>
          {ui.homeSubtitle && (
            <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2, lineHeight: 1.35 }}>{ui.homeSubtitle}</div>
          )}
          {syncInfo?.code && (
            <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 6, lineHeight: 1.45 }}>
              Kode data{" "}
              <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700, color: "var(--ink2)" }} title="Bandingkan dengan akun lain — harus sama jika data sudah sinkron">
                {syncInfo.code}
              </span>
              {" · "}Awan {formatSyncClock(syncInfo.cloudAt)}
              {" · "}HP {formatSyncClock(syncInfo.pulledAt)}
              {cloudSyncState === "syncing" && <span style={{ color: "var(--brand)" }}> · menyinkronkan…</span>}
              {cloudSyncState === "ok" && syncInfo.hint && (
                <span style={{ color: "var(--in-text)", fontWeight: 600 }}> · {syncInfo.hint}</span>
              )}
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <IconBtn title={cloudSyncState === "syncing" ? "Menyinkronkan…" : cloudSyncState === "ok" ? "Data diperbarui dari awan" : "Muat ulang dari awan"} onClick={onCloudSync}>
            {cloudSyncState === "syncing" ? <Loader2 size={20} className="animate-spin" /> : cloudSyncState === "ok" ? <Check size={20} color="var(--in-text)" /> : <Cloud size={20} />}
          </IconBtn>
          {canDo(user.role, "inputIncome") && (
            <IconBtn title="Inbox draf bank/e-wallet" onClick={() => setOverlay("inbox")} badge={inboxCount}><Inbox size={20} /></IconBtn>
          )}
          <IconBtn title="Pengumuman staf" onClick={() => setOverlay("notif")} badge={notifCount}><Bell size={20} /></IconBtn>
        </div>
      </div>

      <BusinessContextBanner
        business={business}
        businesses={businesses}
        switchBusiness={switchBusiness}
        features={features}
      />

      {/* saldo card */}
      <div style={{ margin: "0 16px 20px" }}>
        <div style={{ background: ui.saldoGradient, borderRadius: 24, padding: "24px 24px 20px", position: "relative", overflow: "hidden", color: "#fff" }}>
          <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "rgba(255,255,255,.08)", top: -60, right: -40 }} />
          <div style={{ position: "absolute", width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,.05)", bottom: -30, right: 60 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", position: "relative" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", opacity: .8 }}>TOTAL SALDO</span>
            <button onClick={() => setHide(v => !v)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.85)", cursor: "pointer" }}>{hide ? <EyeOff size={20} /> : <Eye size={20} />}</button>
          </div>
          <div className="money" style={{ fontSize: 38, fontWeight: 800, marginTop: 8, position: "relative" }}>{hide ? "••••••••" : fmtMoney(totalSaldo, cur)}</div>
          <div style={{ fontSize: 13, opacity: .7, marginTop: 4, position: "relative" }}>{scopeLabel} · {new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" })}</div>
          <div style={{ height: 1, background: "rgba(255,255,255,.2)", margin: "16px 0", position: "relative" }} />
          <div style={{ display: "flex", justifyContent: "space-between", position: "relative" }}>
            <div><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: .8 }}><span style={{ width: 8, height: 8, borderRadius: 99, background: "#4ADE80", display: "inline-block" }} />Pemasukan</div><div className="money" style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{hide ? "••••" : fmtMoney(monthIn, cur, "+")}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, opacity: .8, justifyContent: "flex-end" }}>Pengeluaran<span style={{ width: 8, height: 8, borderRadius: 99, background: "#F87171", display: "inline-block" }} /></div><div className="money" style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: "#FCA5A5" }}>{hide ? "••••" : fmtMoney(monthOut, cur, "−")}</div></div>
          </div>
        </div>
      </div>

      {/* dompet */}
      <div style={{ padding: "0 20px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{ui.walletSectionTitle}</span>
        {canDo(user.role, "kelolaDompet") && (
          <button onClick={() => setOverlay("wallets")} style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", background: "none", border: "none", cursor: "pointer" }}>Kelola dompet</button>
        )}
      </div>
      <div style={{ paddingLeft: 16, display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4, paddingRight: 16, marginBottom: 24 }} className="scroll-hide">
        {myWallets.map(w => {
          const bal = walletBalance(w.id, s.wallets, s.transactions);
          const floorHint = !isPaylaterWallet(w) ? walletFloorHint(bal, w.floor) : null;
          const nearFloor = !!floorHint;
          const paylaterDebt = isPaylaterWallet(w) && bal < 0;
          const balHidden = shouldHideWalletBalance(w, user);
          return (
            <Card key={w.id} style={{ minWidth: 150, padding: 16, position: "relative", overflow: "hidden", flexShrink: 0, border: paylaterDebt ? "1px solid #FDE68A" : undefined }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: w.color }} />
              <div style={{ marginBottom: 12 }}><WalletIcon wallet={w} size={40} /></div>
              <div style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                {w.name}
                {isPaylaterWallet(w) && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "#FEF3C7", color: "#B45309", fontWeight: 800 }}>Hutang</span>}
                {balHidden && <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 99, background: "var(--surface2)", color: "var(--ink3)", fontWeight: 700 }}>Rekening</span>}
                {w.outlet && <span style={{ fontSize: 10, padding: "1px 5px", borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)", fontWeight: 700 }}>{w.outlet}</span>}
              </div>
              {balHidden ? (
                <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 6, fontWeight: 600 }}>Saldo disembunyikan</div>
              ) : (
                <div className="money" style={{ fontSize: 17, fontWeight: 700, color: paylaterDebt ? "#B45309" : nearFloor ? "var(--out-text)" : bal < 0 ? "var(--out-text)" : "var(--ink)", marginTop: 2 }}>{hide ? "•••" : formatWalletBal(w, bal, cur, user)}</div>
              )}
              {paylaterDebt && <div style={{ fontSize: 10, color: "#B45309", fontWeight: 700, marginTop: 3 }}>⚠ Wajib dibayar</div>}
              {floorHint && <div style={{ fontSize: 10, color: "var(--out-text)", fontWeight: 700, marginTop: 3 }}>⚠ {floorHint}</div>}
            </Card>
          );
        })}
      </div>

      {/* Checklist harian — semua role */}
      {(() => {
        const role = user.role;

        if (role === "kasir" && features.kasirDaily && canDo(role, "inputLaporanHarian")) {
          const kasirSosmed = showSosmed && isSosmedEnabled(s.sosmedConfig, user.outlet);
          const tasks = [
            {
              id: "sdm",
              title: "SDM Pagi",
              subtitle: todaySdm
                ? `${todaySdm.headcount} orang masuk · target ${fmtMoney(todaySdm.targetOmset, cur)}`
                : `Berapa orang masuk kerja? ${SDM_HINT[user.outlet] || "Isi angka saja"}`,
              done: !!todaySdm,
              onClick: () => setOverlay("sdmHarian"),
            },
            {
              id: "omset",
              title: "Laporan Omset",
              subtitle: needsRevision
                ? `Revisi wajib (${shortDate(needsRevision.date)}) — ${needsRevision.revisionNote || "perbaiki sesuai catatan admin"}`
                : todayReport
                  ? todayReport.status === "admin_verified"
                    ? `Total ${fmtMoney(todayReport.total, cur)} · menunggu settle owner/admin`
                    : todayReport.status === "submitted"
                      ? `Total ${fmtMoney(todayReport.total, cur)} · menunggu verifikasi admin pagi`
                      : `Total ${fmtMoney(todayReport.total, cur)} · tercatat`
                  : todaySdm
                    ? `Target ${fmtMoney(dailyTarget, cur)} · isi per channel pembayaran`
                    : "Tap untuk isi · backfill tanggal lalu boleh",
              done: !!todayReport && !needsRevision,
              urgent: !!needsRevision,
              blocked: false,
              onClick: () => (onOpenLaporan ? onOpenLaporan(needsRevision?.date || null) : setOverlay("laporanHarian")),
            },
          ];
          if (kasirSosmed) {
            tasks.push({
              id: "sosmed",
              title: "Report Sosmed",
              subtitle: todaySosmed
                ? `${sosmedDisplayName(user.outlet)} · sudah dilaporkan hari ini`
                : `${sosmedDisplayName(user.outlet)} · DM, komentar, review, komplain`,
              done: !!todaySosmed,
              onClick: () => setOverlay("sosmedHarian"),
            });
          }
          return (
            <RoleDailyChecklist
              tasks={tasks}
              accentGradient={ui.saldoGradient}
              headerHint="Wajib setiap hari sebelum tutup shift"
            />
          );
        }

        if (role === "purchasing" && features.purchasingModule) {
          const tasks = [
            {
              id: "belanja",
              title: "Catat Belanja Hari Ini",
              subtitle: todayOutTx.length
                ? `${todayOutTx.length} transaksi · total ${fmtMoney(todayOutTotal, cur)}`
                : "Belum ada belanja tercatat — tap untuk catat pengeluaran",
              done: todayOutTx.length > 0,
              onClick: () => onCatat?.(),
            },
            {
              id: "asisten",
              title: "Asisten Purchasing",
              subtitle: "Tanya AI soal kendala belanja & stok dari data transaksi",
              done: false,
              optional: true,
              onClick: () => setTab("asisten"),
            },
          ];
          return (
            <RoleDailyChecklist
              tasks={tasks}
              accentGradient={ui.saldoGradient}
              headerHint="Catat setiap belanja ke dompet yang dipakai"
            />
          );
        }

        if ((role === "admin" || role === "owner") && features.settleLaci) {
          const tasks = [
            {
              id: "verify",
              title: "Verifikasi Laporan Kasir",
              subtitle: awaitingVerify.length
                ? `${awaitingVerify.length} laporan · cek fisik laci & nota pagi`
                : "Semua laporan sudah diverifikasi",
              done: awaitingVerify.length === 0,
              urgent: awaitingVerify.length > 0,
              count: awaitingVerify.length || undefined,
              onClick: () => setOverlay("settleLaporan"),
            },
            {
              id: "settle",
              title: "Settle Laporan Omset",
              subtitle: readyToSettle.length
                ? `${readyToSettle.length} siap settle · batas ${reportSettleDeadlineLabel(readyToSettle[0]?.date) || "esok 17:00"}`
                : waitingSettle.length === 0
                  ? "Semua laporan omset sudah disettle"
                  : "Verifikasi dulu sebelum settle",
              done: waitingSettle.length === 0,
              urgent: readyToSettle.length > 0 || overdueSettle > 0,
              count: readyToSettle.length || undefined,
              onClick: () => setOverlay("settleLaporan"),
            },
          ];
          if (role === "admin") {
            tasks.push({
              id: "void",
              title: "Review Void Kasir",
              subtitle: pendingVoids
                ? `${pendingVoids} void menunggu review sebelum settle omset`
                : "Tidak ada void pending dari kasir outlet",
              done: pendingVoids === 0,
              urgent: pendingVoids > 0,
              count: pendingVoids || undefined,
              onClick: () => setOverlay("voidReview"),
            });
          }
          if (canDo(role, "inputIncome")) {
            tasks.push({
              id: "inbox",
              title: "Inbox Bank / E-wallet",
              subtitle: inboxCount
                ? `${inboxCount} draf notifikasi belum diproses jadi transaksi`
                : "Inbox kosong — semua draf sudah diproses",
              done: inboxCount === 0,
              urgent: inboxCount > 0,
              count: inboxCount || undefined,
              onClick: () => setOverlay("inbox"),
            });
          }
          if (adminSosmedEnabled) {
            tasks.push({
              id: "sosmed",
              title: "Report Sosmed",
              subtitle: todaySosmed
                ? `${sosmedDisplayName(sosmedOutlet)} · sudah dilaporkan hari ini`
                : `${sosmedDisplayName(sosmedOutlet)} · DM, komentar, Google review, komplain`,
              done: !!todaySosmed,
              onClick: () => setOverlay("sosmedHarian"),
            });
          }
          if (showPurchasingAsistenBeranda(role) && features.purchasingModule) {
            tasks.push({
              id: "asisten",
              title: "Tanya Purchasing",
              subtitle: "AI bantu jawab kendala belanja dari data transaksi",
              done: false,
              optional: true,
              onClick: () => setOverlay("asisten"),
            });
          }
          return (
            <RoleDailyChecklist
              tasks={tasks}
              accentGradient={ui.saldoGradient}
              headerLabel={role === "owner" ? "Prioritas Owner" : "Prioritas Admin Keuangan"}
              headerHint="Verifikasi pagi · settle siang s/d esok 17:00 · yang terlambat berkedip"
            />
          );
        }

        if ((role === "admin" || role === "owner") && !features.settleLaci) {
          const tasks = [
            {
              id: "catat",
              title: "Catat Transaksi",
              subtitle: todayOutTx.length
                ? `${todayOutTx.length} pengeluaran hari ini · ${fmtMoney(todayOutTotal, cur)}`
                : "Pemasukan/pengeluaran bisnis ini — terpisah dari resto F&B",
              done: todayOutTx.length > 0,
              onClick: () => onCatat?.(),
            },
          ];
          if (canDo(role, "inputIncome")) {
            tasks.push({
              id: "inbox",
              title: "Inbox Bank / E-wallet",
              subtitle: inboxCount
                ? `${inboxCount} draf notifikasi belum diproses`
                : "Inbox kosong",
              done: inboxCount === 0,
              urgent: inboxCount > 0,
              count: inboxCount || undefined,
              onClick: () => setOverlay("inbox"),
            });
          }
          return (
            <RoleDailyChecklist
              tasks={tasks}
              accentGradient={ui.saldoGradient}
              headerLabel={features.label}
              headerHint="Dompet & transaksi hanya untuk bisnis aktif — bukan KBU/KSM/SMT"
            />
          );
        }

        return null;
      })()}

      {/* transaksi terbaru */}
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Transaksi Terbaru</span>
        <button type="button" onClick={() => setTab("laporan")} style={{ fontSize: 13, fontWeight: 600, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>Lihat Semua</button>
      </div>
      {(() => {
        const recent = [...scopedTx].sort((a, b) => (b.date + b.id).localeCompare(a.date + a.id)).slice(0, 10);
        if (recent.length === 0) return (
          <div style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: "var(--surface2)", display: "grid", placeItems: "center", margin: "0 auto 16px", color: "var(--ink3)" }}><ClipboardList size={30} /></div>
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16 }}>Belum ada transaksi</div>
            <div style={{ color: "var(--ink3)", fontSize: 13, marginTop: 4 }}>Mulai catat transaksi pertama Anda</div>
          </div>
        );
        return (
          <Card style={{ margin: "12px 16px 0", overflow: "hidden" }}>
            {recent.map((t, i) => {
              const isTrf = t.type === "transfer";
              const cat = s.categories.find(c => c.id === t.categoryId);
              const w = s.wallets.find(x => x.id === (isTrf ? t.fromWalletId : t.walletId));
              const visual = resolveTxVisual(t, cat, s.wallets);
              const col = isTrf ? "var(--brand)" : t.type === "in" ? "var(--in-text)" : "var(--out-text)";
              return (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  <TxRowIcon visual={visual} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {isTrf ? `${s.wallets.find(x => x.id === t.fromWalletId)?.name} → ${s.wallets.find(x => x.id === t.toWalletId)?.name}` : (isPurchasingTx(t) ? purchasingTxTitle(t) : (t.desc || cat?.name))}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{isTrf ? "Geser laci" : cat?.name} · {w?.name} · {shortDate(t.date)}</div>
                  </div>
                  <div className="money" style={{ fontSize: 14, fontWeight: 700, color: col, flexShrink: 0 }}>
                    {hide ? "•••" : (isTrf ? "⇄ " : "") + (isTrf ? fmtMoney(t.amount, cur) : fmtTxAmount(t.amount, t.type, cur))}
                  </div>
                </div>
              );
            })}
          </Card>
        );
      })()}
    </div>
  );
}

function IconBtn({ children, onClick, badge, title }) {
  return (
    <button onClick={onClick} title={title} style={{ width: 38, height: 38, borderRadius: 99, background: "none", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink2)", position: "relative" }}>
      {children}
      {badge > 0 && <span style={{ position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 99, background: "var(--out)", color: "#fff", fontSize: 10, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 3px" }}>{badge}</span>}
    </button>
  );
}

// ─── Laporan ───────────────────────────────────────────────
function Laporan({ s, mutate, onOpenPair, onOpenPurchasingReport, business, features }) {
  const cur = s.profile.currency;
  const user = s.currentUser || { role: "kasir" };
  const role = user.role || "kasir";
  const canManageTx = canManageTransactions(user.role);
  const [editTx, setEditTx] = useState(null);
  const showExport = canDo(user.role, "hubungkanWeb");
  const myWallets = visibleWallets(s.wallets, user);
  const scopedBase = visibleTransactionsForBusiness(s.transactions, s.wallets, user, business);
  const [range, setRange] = useState("Harian");
  const [anchorDate, setAnchorDate] = useState(today());
  const [customStart, setCustomStart] = useState(isoOffset(-6));
  const [customEnd, setCustomEnd] = useState(today());
  const [walletId, setWalletId] = useState("all");
  const [catIn, setCatIn] = useState("all");
  const [catOut, setCatOut] = useState("all");

  const bounds = useMemo(
    () => getPeriodBounds(range, anchorDate, { customStart, customEnd }),
    [range, anchorDate, customStart, customEnd]
  );

  const tx = useMemo(
    () => filterTransactions(scopedBase, {
      start: bounds.start,
      end: bounds.end,
      walletId,
      catIn,
      catOut,
    }),
    [scopedBase, bounds, walletId, catIn, catOut]
  );

  const { inSum, outSum, net, count } = useMemo(() => sumInOut(tx), [tx]);

  const chart = useMemo(
    () => buildCashflowChart(tx, bounds.start, bounds.end, shortDate),
    [tx, bounds.start, bounds.end]
  );

  const periodLabel = useMemo(() => formatPeriodLabel(range, bounds), [range, bounds]);

  const canShift = range !== "Custom";

  const goPrev = () => {
    if (!canShift) return;
    setAnchorDate(shiftAnchor(range, anchorDate, -1));
  };
  const goNext = () => {
    if (!canShift) return;
    const next = shiftAnchor(range, anchorDate, 1);
    if (next <= today()) setAnchorDate(next);
  };
  const canGoNext = bounds.end < today();

  const inCats = visibleCategories(s.categories, user, "in");
  const outCats = visibleCategories(s.categories, user, "out");

  const txDetail = useMemo(
    () => filterTransactions(scopedBase, {
      start: bounds.start,
      end: bounds.end,
      walletId,
      catIn,
      catOut,
      includeTransfer: canManageTx,
    }),
    [scopedBase, bounds, walletId, catIn, catOut, canManageTx]
  );

  const txSorted = useMemo(
    () => [...txDetail].sort((a, b) => b.date.localeCompare(a.date) || (b.id > a.id ? 1 : -1)),
    [txDetail]
  );

  const scopeLabel = user.role === "kasir"
    ? (OUTLET_LABEL[user.outlet] || user.outlet)
    : walletId !== "all"
      ? (myWallets.find(w => w.id === walletId)?.name || "Dompet")
      : "Semua dompet";
  const ui = getAccountUi(user, business);

  const waKeuangan = useMemo(() => formatKeuanganWa({
    periodLabel,
    inSum,
    outSum,
    net,
    count,
    scopeLabel,
  }), [periodLabel, inSum, outSum, net, count, scopeLabel]);

  return (
    <div style={{ padding: "0 0 90px" }}>
      <div style={{ padding: "16px 20px 12px" }}>
        <span style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>{ui.laporanTitle}</span>
      </div>

      {(role === "purchasing" || canDo(role, "kelolaKategoriSemua")) && features?.purchasingModule && (
        <div style={{ margin: "0 16px 12px" }}>
          <Card onClick={onOpenPurchasingReport} style={{ padding: "12px 14px", background: "#FEF3C7", border: "1px solid #FDE68A", cursor: "pointer" }}>
            <div style={{ fontWeight: 500, color: "var(--ink)" }}>Laporan Purchasing</div>
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Pengeluaran belanja per outlet & periode</div>
          </Card>
        </div>
      )}

      {showExport && (
        <div style={{ margin: "0 16px 16px" }}>
          <Card onClick={onOpenPair} style={{ padding: "12px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <Monitor size={20} color="#16A34A" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A" }}>Export PDF & Excel lengkap via PC</div>
              <div style={{ fontSize: 12, color: "#4B5563" }}>Tap untuk hubungkan Web Dashboard NF3</div>
            </div>
            <ChevronRight size={16} color="var(--ink3)" />
          </Card>
        </div>
      )}

      <div style={{ margin: "0 16px 12px", display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, background: "var(--surface2)", borderRadius: 12, padding: 4 }}>
        {["Harian", "Mingguan", "Bulanan", "Custom"].map(r => (
          <button key={r} onClick={() => {
            setRange(r);
            if (r === "Custom") {
              setCustomEnd(today());
              setCustomStart(isoOffset(-6));
            } else {
              setAnchorDate(today());
            }
          }} style={{ padding: "9px 0", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", background: range === r ? "var(--brand)" : "transparent", color: range === r ? "#fff" : "var(--ink2)" }}>{r}</button>
        ))}
      </div>

      {range === "Custom" ? (
        <div style={{ padding: "8px 16px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <Fld label="Dari tanggal">
            <input type="date" value={customStart} max={customEnd || today()} onChange={e => setCustomStart(e.target.value)}
              style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14 }} />
          </Fld>
          <Fld label="Sampai tanggal">
            <input type="date" value={customEnd} min={customStart} max={today()} onChange={e => setCustomEnd(e.target.value)}
              style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14 }} />
          </Fld>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "8px 16px 12px" }}>
          <button onClick={goPrev} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
            <ChevronLeft size={22} color="var(--brand)" />
          </button>
          <div style={{ textAlign: "center", flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.35 }}>{periodLabel}</div>
            <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{count} transaksi tercatat</div>
          </div>
          <button onClick={goNext} disabled={!canGoNext} style={{ background: "none", border: "none", cursor: canGoNext ? "pointer" : "default", padding: 4, display: "grid", placeItems: "center", opacity: canGoNext ? 1 : .35 }}>
            <ChevronRight size={22} color="var(--brand)" />
          </button>
        </div>
      )}

      {range === "Custom" && (
        <div style={{ padding: "0 16px 12px", textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>{periodLabel}</div>
          <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{count} transaksi tercatat</div>
        </div>
      )}

      <div style={{ padding: "6px 16px", display: "flex", gap: 8, overflowX: "auto" }} className="scroll-hide">
        <Pill active={walletId === "all"} onClick={() => setWalletId("all")}>Semua dompet</Pill>
        {myWallets.map(w => <Pill key={w.id} active={walletId === w.id} onClick={() => setWalletId(w.id)} color={w.color}>{w.name}</Pill>)}
      </div>
      <div style={{ padding: "6px 16px", display: "flex", gap: 8, overflowX: "auto" }} className="scroll-hide">
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", alignSelf: "center", flexShrink: 0 }}>Masuk</span>
        <Pill active={catIn === "all"} onClick={() => setCatIn("all")}>Semua</Pill>
        {inCats.map(c => <Pill key={c.id} active={catIn === c.id} onClick={() => setCatIn(c.id)}>{c.name}</Pill>)}
      </div>
      <div style={{ padding: "6px 16px 12px", display: "flex", gap: 8, overflowX: "auto" }} className="scroll-hide">
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink3)", alignSelf: "center", flexShrink: 0 }}>Keluar</span>
        <Pill active={catOut === "all"} onClick={() => setCatOut("all")}>Semua</Pill>
        {outCats.map(c => <Pill key={c.id} active={catOut === c.id} onClick={() => setCatOut(c.id)}>{c.name}</Pill>)}
      </div>

      <div style={{ padding: "0 16px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink2)", marginBottom: 8 }}>Tren Alur Kas (Pemasukan vs Pengeluaran)</div>
        <Card style={{ padding: "12px 8px 4px" }}>
          {chart.every(p => p.in === 0 && p.out === 0) ? (
            <div style={{ height: 180, display: "grid", placeItems: "center", color: "var(--ink3)", fontSize: 13, textAlign: "center", padding: 16 }}>
              Tidak ada transaksi pada periode ini.
            </div>
          ) : (
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22C55E" stopOpacity={.35} /><stop offset="100%" stopColor="#22C55E" stopOpacity={0} /></linearGradient>
                    <linearGradient id="go" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#EF4444" stopOpacity={.3} /><stop offset="100%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--ink3)" }} axisLine={false} tickLine={false} interval={chart.length > 14 ? Math.floor(chart.length / 7) : 0} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--ink3)" }} axisLine={false} tickLine={false} width={38} tickFormatter={v => v >= 1000000 ? v / 1000000 + "jt" : v >= 1000 ? v / 1000 + "k" : v} />
                  <Tooltip formatter={(v, n) => [fmtMoney(v, cur), n === "in" ? "Masuk" : "Keluar"]} labelFormatter={(_, payload) => payload?.[0]?.payload?.iso ? dayLabel(payload[0].payload.iso) : ""} contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 12, background: "var(--surface)" }} />
                  <Area type="monotone" dataKey="in" stroke="#22C55E" strokeWidth={2} fill="url(#gi)" />
                  <Area type="monotone" dataKey="out" stroke="#EF4444" strokeWidth={2} fill="url(#go)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <div style={{ margin: "12px 16px 0" }}>
        <Card style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            <div style={{ padding: "14px 16px", borderRight: "1px solid var(--line)" }}>
              <div style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 4 }}><TrendingUp size={13} color="var(--in)" /> Pemasukan</div>
              <div className="money" style={{ fontSize: 20, fontWeight: 800, color: "var(--in-text)", marginTop: 4 }}>{fmtMoney(inSum, cur)}</div>
            </div>
            <div style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: 12, color: "var(--ink2)", display: "flex", alignItems: "center", gap: 4 }}><TrendingDown size={13} color="var(--out)" /> Pengeluaran</div>
              <div className="money" style={{ fontSize: 20, fontWeight: 800, color: "var(--out-text)", marginTop: 4 }}>{fmtMoney(outSum, cur)}</div>
            </div>
          </div>
          <div style={{ padding: "12px 16px", borderTop: "1px solid var(--line)", background: "var(--surface2)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, color: "var(--ink)" }}>Laba Bersih</span>
            <span className="money" style={{ fontSize: 20, fontWeight: 800, color: net >= 0 ? "var(--in-text)" : "var(--out-text)" }}>
              {net >= 0 ? "▲ " : "▼ "}{fmtMoney(Math.abs(net), cur)}
            </span>
          </div>
        </Card>
        <ShareWaBtn text={waKeuangan} />
        <div style={{ fontSize: 11, color: "var(--ink3)", textAlign: "center", marginTop: 8, lineHeight: 1.4 }}>
          Kirim ringkasan ke grup WA — tidak perlu ketik ulang.
        </div>
      </div>

      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 10 }}>
          Rincian transaksi ({txSorted.length})
          {canManageTx && (
            <span style={{ fontWeight: 500, color: "var(--ink3)", fontSize: 11, marginLeft: 6 }}>· tap untuk edit/hapus</span>
          )}
        </div>
        {txSorted.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ink3)", fontSize: 13, padding: "24px 0" }}>
            Belum ada transaksi pada periode ini.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {txSorted.slice(0, 50).map(t => {
              const cat = s.categories.find(c => c.id === t.categoryId);
              const w = s.wallets.find(x => x.id === t.walletId);
              const isTrf = t.type === "transfer";
              const isIn = t.type === "in";
              const visual = resolveTxVisual(t, cat, s.wallets);
              const policy = canManageTx ? getTransactionEditPolicy(t) : null;
              const { from, to } = isTrf ? resolveTransferIds(t) : {};
              const fromW = isTrf ? s.wallets.find(x => x.id === from) : null;
              const toW = isTrf ? s.wallets.find(x => x.id === to) : null;
              return (
                <Card key={t.id} onClick={canManageTx && policy?.canEdit ? () => setEditTx(t) : undefined}
                  style={{ padding: "12px 14px", cursor: canManageTx && policy?.canEdit ? "pointer" : "default", opacity: policy && !policy.canEdit ? 0.72 : 1 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <TxRowIcon visual={visual} size={36} />
                    <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                          {isPurchasingTx(t) ? purchasingTxTitle(t) : (t.desc || cat?.name || (isTrf ? "Transfer" : "Transaksi"))}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3 }}>
                          {isTrf
                            ? `${fromW?.name || "—"} → ${toW?.name || "—"}`
                            : isPurchasingTx(t)
                              ? `${purchasingTxSubtitle(t, cat, w)}`
                              : `${cat?.name || "—"} · ${w?.name || "—"}`}
                          {" · "}{shortDate(t.date)}
                          {t.source && <span> · {t.source}</span>}
                        </div>
                        {canManageTx && policy && !policy.canEdit && (
                          <div style={{ fontSize: 11, color: "var(--amber)", marginTop: 4 }}>Terkunci — {policy.reason}</div>
                        )}
                      </div>
                      <div className="money" style={{ fontWeight: 800, fontSize: 14, color: isTrf ? "var(--brand)" : isIn ? "var(--in-text)" : "var(--out-text)", flexShrink: 0 }}>
                        {isTrf ? "⇄ " : ""}{fmtMoney(t.amount, cur)}
                      </div>
                    </div>
                    {canManageTx && policy?.canEdit && <ChevronRight size={16} color="var(--ink3)" style={{ flexShrink: 0, marginTop: 4 }} />}
                  </div>
                </Card>
              );
            })}
            {txSorted.length > 50 && (
              <div style={{ fontSize: 12, color: "var(--ink3)", textAlign: "center", padding: 8 }}>
                +{txSorted.length - 50} transaksi lainnya — export via PC untuk lihat semua
              </div>
            )}
          </div>
        )}
      </div>

      {editTx && (
        <TransactionEditSheet
          tx={editTx}
          s={s}
          onClose={() => setEditTx(null)}
          onSave={(id, patch) => {
            const existing = (s.transactions || []).find((t) => t.id === id);
            if (!existing) {
              showActionToast("Transaksi tidak ditemukan.", "error");
              return false;
            }
            const errMsg = validateTransactionUpdate(existing, patch, { wallets: s.wallets, transactions: s.transactions });
            if (errMsg) {
              showActionToast(errMsg, "error");
              return false;
            }
            mutate((st) => {
              const i = st.transactions.findIndex((t) => t.id === id);
              if (i >= 0) st.transactions[i] = normalizeTransaction({ ...st.transactions[i], ...patch });
            });
            showActionToast("Perubahan transaksi disimpan.", "success");
            setEditTx(null);
            return true;
          }}
          onDelete={(id) => {
            const existing = (s.transactions || []).find((t) => t.id === id);
            if (!existing || !getTransactionEditPolicy(existing).canDelete) {
              showActionToast("Transaksi ini tidak bisa dihapus.", "error");
              return false;
            }
            mutate((st) => {
              applyTransactionDelete(st, id);
            });
            showActionToast("Transaksi dihapus · saldo dompet sudah disesuaikan.", "success");
            setEditTx(null);
            return true;
          }}
        />
      )}
    </div>
  );
}

// ─── Analisis ──────────────────────────────────────────────
const INSIGHT_COLORS = {
  danger: { bg: "#FEF9C3", border: "#FDE047", ic: "#CA8A04" },
  warn: { bg: "#FFF7ED", border: "#FED7AA", ic: "#D97706" },
  ok: { bg: "#F0FDF4", border: "#BBF7D0", ic: "#16A34A" },
  info: { bg: "#EFF6FF", border: "#BFDBFE", ic: "#2563EB" },
};

function InsightCard({ it, onHide }) {
  const colors = INSIGHT_COLORS[it.tone] || INSIGHT_COLORS.warn;
  return (
    <div style={{ background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 16, padding: "14px 16px", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 38, height: 38, borderRadius: 99, background: "#fff", display: "grid", placeItems: "center", flexShrink: 0 }}>
        <AlertTriangle size={18} color={colors.ic} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: colors.ic }}>{it.title}</div>
        <div style={{ fontSize: 14, color: "var(--ink)", marginTop: 4, lineHeight: 1.5 }}>{it.body}</div>
      </div>
      {onHide && (
        <button type="button" onClick={() => onHide(it.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink3)" }}>
          <X size={16} />
        </button>
      )}
    </div>
  );
}

function Analisis({ s, hideInsight }) {
  const cur = s.profile.currency;
  const user = s.currentUser || { role: "kasir" };
  const [days, setDays] = useState(7);
  const [aiState, setAiState] = useState("idle");
  const [aiAdvice, setAiAdvice] = useState(null);
  const [aiErr, setAiErr] = useState("");

  const biz = useMemo(() => buildBusinessAnalysis(s, { days }), [s, days]);

  const financeInsights = useMemo(() => {
    const tx = visibleTransactions(s.transactions, s.wallets, user).filter(t => t.type !== "transfer");
    const list = [];
    const last3 = [today(), isoOffset(-1), isoOffset(-2)];
    if (canDo(user.role, "inputIncome") && tx.filter(t => t.type === "in" && last3.includes(t.date)).length === 0)
      list.push({ id: "no_inc", category: "keuangan", tone: "warn", title: "Perhatian", body: "📋 Belum ada pencatatan pemasukan 3 hari ini. Jangan sampai ada transaksi yang terlewat ya!" });
    const wNow = tx.filter(t => t.type === "out" && t.date >= isoOffset(-6)).reduce((a, b) => a + b.amount, 0);
    const wPrev = tx.filter(t => t.type === "out" && t.date >= isoOffset(-13) && t.date < isoOffset(-6)).reduce((a, b) => a + b.amount, 0);
    if (wPrev > 0 && wNow > wPrev * 1.25)
      list.push({ id: "spike", category: "keuangan", tone: "warn", title: "Pengeluaran naik", body: `🔺 Pengeluaran minggu ini naik ${Math.round((wNow / wPrev - 1) * 100)}% dibanding minggu lalu.` });
    const m = today().slice(0, 7);
    const mIn = tx.filter(t => t.type === "in" && t.date.startsWith(m)).reduce((a, b) => a + b.amount, 0);
    const mOut = tx.filter(t => t.type === "out" && t.date.startsWith(m)).reduce((a, b) => a + b.amount, 0);
    if (canDo(user.role, "inputIncome") && mIn > 0 && mOut > mIn)
      list.push({ id: "neg", category: "keuangan", tone: "danger", title: "Arus kas negatif", body: `⚠️ Pengeluaran bulan ini melebihi pemasukan ${fmtMoney(mOut - mIn, cur)}.` });
    return list.filter(x => !(s.hiddenInsights || []).includes(x.id));
  }, [s, user, cur]);

  const handlePeriodeChange = (d) => {
    setDays(d);
    setAiState("idle");
    setAiAdvice(null);
    setAiErr("");
  };

  const handleAnalisis = useCallback(async () => {
    setAiState("loading");
    setAiErr("");
    try {
      const tx = visibleTransactions(s.transactions, s.wallets, user).filter(t => t.type !== "transfer");
      const result = await fetchBusinessAnalysis({
        analysis: biz,
        financeInsights,
        role: user.role,
        transactions: tx,
      });
      setAiAdvice(result);
      setAiState("done");
    } catch (e) {
      setAiErr(e.message || "Gagal memuat saran AI");
      setAiState("error");
    }
  }, [biz, financeInsights, user.role, s.transactions, s.wallets, user]);

  const allInsights = useMemo(() => {
    const merged = [
      ...financeInsights,
      ...biz.insights.filter(x => !(s.hiddenInsights || []).includes(x.id)),
    ];
    if (merged.length === 0) {
      merged.push({ id: "ok", category: "keuangan", tone: "ok", title: "Semua aman", body: "✅ Data operasional terpantau baik. Pertahankan disiplin input harian." });
    }
    return merged;
  }, [financeInsights, biz.insights, s.hiddenInsights]);

  const fmtRp = (n) => fmtMoney(n, cur);
  const priColor = { tinggi: "#DC2626", sedang: "#D97706", rendah: "#2563EB" };
  const healthColor = aiAdvice?.healthLabel === "Sehat" ? "#16A34A" : aiAdvice?.healthLabel === "Waspada" ? "#D97706" : "#DC2626";

  return (
    <div style={{ padding: "0 0 90px" }}>
      <div style={{ padding: "16px 20px 4px" }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)" }}>Analisis Usaha</div>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 2 }}>
          AI keputusan · komplain · omset vs SDM · {biz.period.from} s/d {biz.period.to}
        </div>
      </div>

      <div style={{ padding: "8px 16px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        {[7, 14, 30, 90, 365].map(d => (
          <button key={d} type="button" onClick={() => handlePeriodeChange(d)}
            style={{ padding: "8px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12,
              background: days === d ? "#6366F1" : "var(--surface)", color: days === d ? "#fff" : "var(--ink2)",
              boxShadow: days === d ? "0 2px 8px rgba(99,102,241,.35)" : "none" }}>
            {d === 365 ? "1 tahun" : `${d} hari`}
          </button>
        ))}
      </div>

      {/* Rekomendasi AI — manual trigger, tidak auto-generate */}
      <div style={{ padding: "0 16px 12px" }}>
        <Card style={{ padding: 0, overflow: "hidden", border: "1px solid #C7D2FE" }}>
          <div style={{ background: "linear-gradient(135deg,#5B5BD6,#7C7CF8)", padding: "16px 18px", color: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Sparkles size={22} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>Rekomendasi Keputusan</div>
                <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>
                  {aiState === "loading"
                    ? "Memuat…"
                    : aiState === "idle"
                      ? `Tap untuk analisis ${days} hari terakhir`
                      : aiAdvice?.source === "ai"
                        ? "Claude AI · bantu prioritaskan langkah"
                        : aiAdvice
                          ? "Cadangan otomatis (AI offline / tanpa key)"
                          : aiState === "error"
                            ? "Gagal memuat analisis"
                            : ""}
                </div>
              </div>
              {aiState === "done" && aiAdvice?.healthScore != null && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 22, fontWeight: 800 }}>{aiAdvice.healthScore}/10</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: healthColor, background: "#fff", padding: "2px 8px", borderRadius: 99, marginTop: 2 }}>
                    {aiAdvice.healthLabel}
                  </div>
                </div>
              )}
              {aiState === "idle" && (
                <button type="button" onClick={handleAnalisis}
                  style={{ padding: "8px 14px", borderRadius: 99, border: "none", cursor: "pointer", fontWeight: 700, fontSize: 12, background: "#fff", color: "#5B5BD6", flexShrink: 0 }}>
                  Analisis →
                </button>
              )}
              {aiState === "done" && (
                <button type="button" onClick={handleAnalisis} title="Refresh analisis"
                  style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "#fff", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 15, flexShrink: 0 }}>
                  ↺
                </button>
              )}
            </div>
          </div>
          <div style={{ padding: "16px 18px" }}>
            {aiState === "loading" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink3)", fontSize: 14 }}>
                <Loader2 size={18} style={{ animation: "spin 1s linear infinite" }} /> Claude menganalisis data…
              </div>
            )}
            {aiState === "error" && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 10 }}>{aiErr || "Gagal menghubungi AI"}</div>
                <button type="button" onClick={handleAnalisis}
                  style={{ padding: "8px 14px", borderRadius: 99, border: "1px solid var(--line)", cursor: "pointer", fontWeight: 700, fontSize: 12, background: "var(--surface)", color: "var(--ink2)" }}>
                  Coba lagi
                </button>
              </div>
            )}
            {aiState === "idle" && (
              <div style={{ fontSize: 13, color: "var(--ink3)", lineHeight: 1.5 }}>
                Tekan <strong style={{ color: "var(--ink2)" }}>Analisis →</strong> untuk minta Claude mengevaluasi data {days} hari terakhir. Perbandingan omset memakai hari yang sama minggu lalu (Sabtu vs Sabtu, dll).
              </div>
            )}
            {aiState === "done" && aiAdvice && (
              <>
                <div style={{ fontSize: 14, color: "var(--ink)", lineHeight: 1.55, marginBottom: 14 }}>{aiAdvice.executiveSummary}</div>
                {(aiAdvice.decisions || []).length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink2)", marginBottom: 8, letterSpacing: "0.04em" }}>KEPUTUSAN PRIORITAS</div>
                    {(aiAdvice.decisions || []).map((d, i) => (
                      <div key={i} style={{ padding: "10px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, color: "#fff", background: priColor[d.priority] || "#6B7280" }}>
                            {(d.priority || "sedang").toUpperCase()}
                          </span>
                          {d.outlet && <span style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 700 }}>{OUTLET_LABEL[d.outlet] || d.outlet}</span>}
                        </div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>{d.title}</div>
                        <div style={{ fontSize: 13, color: "var(--brand)", marginTop: 4, fontWeight: 600 }}>→ {d.action}</div>
                        {d.reason && d.reason !== d.action && (
                          <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4, lineHeight: 1.4 }}>{d.reason}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {aiAdvice.risks?.length > 0 && (
                  <div style={{ fontSize: 13, marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, color: "#DC2626" }}>Risiko: </span>
                    <span style={{ color: "var(--ink2)" }}>{aiAdvice.risks.join(" · ")}</span>
                  </div>
                )}
                {aiAdvice.opportunities?.length > 0 && (
                  <div style={{ fontSize: 13 }}>
                    <span style={{ fontWeight: 800, color: "#16A34A" }}>Peluang: </span>
                    <span style={{ color: "var(--ink2)" }}>{aiAdvice.opportunities.join(" · ")}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* KPI ringkas */}
      <div style={{ padding: "0 16px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          ["Omset vs target", biz.kpis.globalAchievement != null ? `${biz.kpis.globalAchievement}%` : "—", biz.kpis.pairedDays ? `${biz.kpis.underTargetDays}/${biz.kpis.pairedDays} hari under` : "Belum ada pasangan omset+SDM"],
          ["Komplain", String(biz.kpis.totalComplaints), biz.kpis.wellDoneDays ? `${biz.kpis.wellDoneDays} hari Well-done ✅` : "dari laporan sosmed"],
          ["Pertanyaan", String(biz.kpis.totalQuestions), "topik sering ditanya pelanggan"],
          ["Omset total", biz.kpis.totalOmset ? fmtRp(biz.kpis.totalOmset) : "—", `${days} hari · semua outlet`],
        ].map(([label, val, sub]) => (
          <Card key={label} style={{ padding: "12px 14px" }}>
            <div style={{ fontSize: 11, color: "var(--ink3)", fontWeight: 600 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--ink)", marginTop: 4 }}>{val}</div>
            <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2, lineHeight: 1.35 }}>{sub}</div>
          </Card>
        ))}
      </div>

      {/* Per outlet */}
      <div style={{ padding: "4px 16px 8px" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Per outlet</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {OUTLETS.map(o => {
            const st = biz.outletStats[o];
            if (!st || st.dataDays === 0) return (
              <Card key={o} style={{ padding: "14px 16px", opacity: .75 }}>
                <div style={{ fontWeight: 800, color: "var(--ink)" }}>{st?.label || o}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>Belum ada input omset/SDM/sosmed {days} hari terakhir.</div>
              </Card>
            );
            return (
              <Card key={o} style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)" }}>{st.label}</div>
                  {st.avgAchievement != null && (
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 99,
                      background: st.avgAchievement >= 95 ? "#DCFCE7" : st.avgAchievement >= 85 ? "#FEF3C7" : "#FEE2E2",
                      color: st.avgAchievement >= 95 ? "#15803D" : st.avgAchievement >= 85 ? "#D97706" : "#DC2626" }}>
                      {st.avgAchievement}% target
                    </span>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10, fontSize: 12 }}>
                  <div><span style={{ color: "var(--ink3)" }}>Omset rata-rata</span><div style={{ fontWeight: 700, color: "var(--ink)" }}>{st.avgOmset ? fmtRp(st.avgOmset) : "—"}</div></div>
                  <div><span style={{ color: "var(--ink3)" }}>Rasio SDM</span><div style={{ fontWeight: 700, color: st.sdmWarningDays ? "#DC2626" : "var(--ink)" }}>{st.avgSdmRatio != null ? `${st.avgSdmRatio.toFixed(1).replace(".", ",")}%` : "—"}</div></div>
                  <div><span style={{ color: "var(--ink3)" }}>Komplain</span><div style={{ fontWeight: 700, color: st.complaintCount ? "#DC2626" : "var(--ink)" }}>{st.complaintCount}</div></div>
                  <div><span style={{ color: "var(--ink3)" }}>Pertanyaan</span><div style={{ fontWeight: 700, color: "var(--ink)" }}>{st.questionCount}</div></div>
                </div>
                {st.reviewAvg != null && (
                  <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8 }}>Google review rata-rata {st.reviewAvg.toFixed(1)}★ · {st.reviewBad} buruk / {st.reviewGood} bagus</div>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* Suara pelanggan */}
      {(biz.customerVoice.topComplaints.length > 0 || biz.customerVoice.topQuestions.length > 0) && (
        <div style={{ padding: "12px 16px 8px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 8 }}>Suara pelanggan</div>
          {biz.customerVoice.topComplaints.length > 0 && (
            <Card style={{ padding: "14px 16px", marginBottom: 8 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#DC2626", marginBottom: 8 }}>Komplain sering</div>
              {biz.customerVoice.topComplaints.map((c, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--ink)", padding: "6px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  {c.text} <span style={{ color: "var(--ink3)", fontSize: 11 }}>({c.count}×)</span>
                </div>
              ))}
            </Card>
          )}
          {biz.customerVoice.topQuestions.length > 0 && (
            <Card style={{ padding: "14px 16px" }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: "#2563EB", marginBottom: 8 }}>Pertanyaan sering</div>
              {biz.customerVoice.topQuestions.map((q, i) => (
                <div key={i} style={{ fontSize: 13, color: "var(--ink)", padding: "6px 0", borderTop: i ? "1px solid var(--line)" : "none" }}>
                  {q.text} <span style={{ color: "var(--ink3)", fontSize: 11 }}>({q.count}×)</span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Insight */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 10 }}>{allInsights.length} insight</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {allInsights.map(it => (
            <InsightCard key={it.id} it={it} onHide={hideInsight} />
          ))}
        </div>
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink3)", marginTop: 32 }}>
          NF3 · Claude AI + cadangan otomatis · omset, SDM, sosmed & keuangan
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}

// ─── Catat Transaksi ───────────────────────────────────────
const MAX_SCAN_NOTA = 4;
const scanNotaStorageKey = (bizId, userId) => `nf3_scan_nota_${bizId || "local"}_${userId || "anon"}_${today()}`;

function getScanNotaUsed(bizId, userId) {
  if (typeof window === "undefined") return 0;
  return Math.min(MAX_SCAN_NOTA, parseInt(localStorage.getItem(scanNotaStorageKey(bizId, userId)) || "0", 10) || 0);
}

function bumpScanNotaUsed(bizId, userId) {
  const next = Math.min(MAX_SCAN_NOTA, getScanNotaUsed(bizId, userId) + 1);
  localStorage.setItem(scanNotaStorageKey(bizId, userId), String(next));
  return next;
}

function CatatTransaksi({ s, bizId, onSave, onClose }) {
  const role = s.currentUser?.role || "kasir";
  const isKasir = role === "kasir";
  const expenseOnly = isKasir || role === "purchasing";
  const [mode, setMode] = useState(isKasir ? "manual" : "voice");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState(null);
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const userId = s.currentUser?.id || "";
  const [scanUsed, setScanUsed] = useState(() => getScanNotaUsed(bizId, userId));
  const scanFull = scanUsed >= MAX_SCAN_NOTA;
  const scanLabel = `Scan Nota (${scanUsed}/${MAX_SCAN_NOTA})`;

  const runText = async (text) => {
    setErr(""); setBusy(true);
    try {
      const r = await aiParseText(text, s.categories);
      const txType = expenseOnly ? "out" : r.type;
      const cats = visibleCategories(s.categories, s.currentUser, txType);
      const cat = cats.find(c => c.name.toLowerCase() === (r.category || "").toLowerCase()) || cats[0];
      const myW = visibleWallets(s.wallets, s.currentUser);
      setDraft({ type: txType, categoryId: cat?.id, amount: r.amount, desc: r.desc, walletId: myW[0]?.id, date: today(), source: text });
    } catch { setErr("Gagal memahami. Coba lagi."); }
    setBusy(false);
  };
  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setErr("Browser ini belum support voice. Ketik manual."); return; }
    const rec = new SR(); recRef.current = rec; rec.lang = "id-ID"; rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onerror = () => { setListening(false); setErr("Suara tidak terdengar. Coba ketik."); };
    rec.onend = () => setListening(false);
    rec.onresult = (e) => { setListening(false); runText(e.results[0][0].transcript); };
    rec.start();
  };
  const onPhoto = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (scanFull) {
      setErr(`Batas scan nota hari ini (${MAX_SCAN_NOTA}x) sudah habis. Gunakan manual${role !== "purchasing" ? " atau bicara" : ""}.`);
      e.target.value = "";
      return;
    }
    setBusy(true); setErr("");
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result.split(",")[1]); r.onerror = rej; r.readAsDataURL(f); });
      const r = await aiParseReceipt(b64, f.type, s.categories);
      const txType = expenseOnly ? "out" : (r.type || "out");
      const cats = visibleCategories(s.categories, s.currentUser, txType);
      const cat = cats.find(c => c.name.toLowerCase() === (r.category || "").toLowerCase()) || cats[0];
      const myW = visibleWallets(s.wallets, s.currentUser);
      setScanUsed(bumpScanNotaUsed(bizId, userId));
      setDraft({ type: txType, categoryId: cat?.id, amount: r.amount, desc: r.desc, walletId: myW[0]?.id, date: r.date || today(), source: "Scan nota" });
    } catch { setErr("Nota tidak terbaca. Coba foto ulang."); }
    setBusy(false);
    e.target.value = "";
  };

  if (draft) return (
    <Sheet title="Tinjau & Simpan" onClose={() => setDraft(null)}>
      <div style={{ padding: "20px 16px" }}>
        <Card style={{ padding: 20, textAlign: "center" }}>
          {draft.type === "transfer" ? (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--brand)", textTransform: "uppercase" }}>Transfer</div>
              <div className="money" style={{ fontSize: 36, fontWeight: 800, color: "var(--brand)", margin: "8px 0" }}>{fmtMoney(draft.amount, s.profile.currency)}</div>
              <div style={{ fontSize: 14, color: "var(--ink2)" }}>
                {s.wallets.find(w => w.id === draft.fromWalletId)?.name}
                {" → "}
                {s.wallets.find(w => w.id === draft.toWalletId)?.name}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: draft.type === "in" ? "var(--in-text)" : "var(--out-text)", textTransform: "uppercase" }}>{draft.type === "in" ? "Pemasukan" : "Pengeluaran"}</div>
              <div className="money" style={{ fontSize: 36, fontWeight: 800, color: draft.type === "in" ? "var(--in-text)" : "var(--out-text)", margin: "8px 0" }}>{fmtMoney(draft.amount, s.profile.currency)}</div>
              <div style={{ fontWeight: 600, color: "var(--ink)" }}>{draft.desc}</div>
              <div style={{ fontSize: 13, color: "var(--ink3)", marginTop: 4 }}>{s.categories.find(c => c.id === draft.categoryId)?.name} · {s.wallets.find(w => w.id === draft.walletId)?.name}</div>
            </>
          )}
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
          <button onClick={() => setDraft(null)} style={{ padding: 14, borderRadius: 14, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>← Edit lagi</button>
          <button onClick={() => {
            const ok = onSave(draft);
            if (ok) onClose();
            else setErr(isKasir ? "Hanya pengeluaran laci. Omset lewat Laporan Omset." : "Transaksi tidak diizinkan untuk role Anda.");
          }} style={{ padding: 14, borderRadius: 14, border: "none", background: "var(--brand)", fontWeight: 700, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><Check size={18} />Simpan</button>
        </div>
        {err && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>{err}</div>}
      </div>
    </Sheet>
  );

  return (
    <Sheet title="Catat Transaksi" onClose={onClose}>
      <div style={{ padding: "20px 16px 120px" }}>
        {role === "purchasing" && (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "#FEF3C7", fontSize: 12, color: "#92400E", lineHeight: 1.45 }}>
            Belanja real — saldo dompet berkurang. Gunakan <b>suara</b> atau isi manual. Scan AI nota tidak tersedia untuk purchasing.
          </div>
        )}
        {isKasir && (
          <div style={{ marginBottom: 14, padding: "10px 12px", borderRadius: 10, background: "var(--brand-soft)", fontSize: 12, color: "var(--brand-text)", lineHeight: 1.45 }}>
            Isi pengeluaran laci di bawah. <b>Omset harian</b> lewat kartu <b>Laporan Omset</b> di Beranda — bukan di sini.
          </div>
        )}
        {mode === "voice" && (
          <Card style={{ padding: 20, background: "var(--surface2)", border: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)" }}><Sparkles size={20} /></div>
              <span style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Coba ucapkan…</span>
            </div>
            {[["Kulakan bahan setengah juta", ShoppingCart], ["Token listrik 50 ribu", Zap], ["Beli kemasan 200 ribu", ShoppingCart], ...(expenseOnly ? [] : [["Jual nasi bungkus 15 ribu", Store]])].map(([ex, Ic], i, arr) => (
              <button key={i} onClick={() => runText(ex)} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 0", background: "none", border: "none", borderBottom: i < arr.length - 1 ? `1px solid var(--line)` : "none", cursor: "pointer", textAlign: "left" }}>
                <div style={{ width: 36, height: 36, borderRadius: 99, background: "var(--surface)", display: "grid", placeItems: "center", color: "var(--ink2)" }}><Ic size={16} /></div>
                <span style={{ color: "var(--ink)", fontWeight: 500 }}>"{ex}"</span>
              </button>
            ))}
            <div style={{ fontSize: 13, color: "var(--brand)", fontWeight: 600, marginTop: 14 }}>Tips: Sebutkan barang + nominal uangnya.</div>
          </Card>
        )}
        {mode === "manual" && <ManualForm s={s} onReady={setDraft} />}
        {mode === "scan" && role !== "purchasing" && !isKasir && (
          <Card style={{ padding: 40, textAlign: "center", background: "var(--surface2)", border: "none" }}>
            <ScanLine size={44} color="var(--brand)" style={{ margin: "0 auto 12px" }} />
            <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 16, marginBottom: 6 }}>Foto / pilih nota</div>
            <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 20 }}>
              {scanFull
                ? `Kuota scan hari ini habis (${MAX_SCAN_NOTA}/${MAX_SCAN_NOTA}). Reset besok.`
                : "Claude akan baca total, merchant, dan tanggal."}
            </div>
            <label style={{ display: "inline-block", padding: "11px 24px", borderRadius: 99, background: scanFull ? "var(--line)" : "var(--brand)", color: scanFull ? "var(--ink3)" : "#fff", fontWeight: 700, cursor: scanFull ? "not-allowed" : "pointer", fontSize: 14, opacity: scanFull ? 0.7 : 1 }}>
              Pilih gambar<input type="file" accept="image/*" capture="environment" disabled={scanFull} style={{ display: "none" }} onChange={onPhoto} />
            </label>
          </Card>
        )}
        {mode === "voice" && (
          <div style={{ marginTop: 16 }}>
            <input placeholder="…atau ketik di sini lalu Enter"
              onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) runText(e.target.value.trim()); }}
              style={{ width: "100%", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
          </div>
        )}
        {busy && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, color: "var(--brand)", marginTop: 20, fontWeight: 600 }}><Loader2 size={18} className="animate-spin" />Membaca…</div>}
        {err && <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13, fontWeight: 500 }}>{err}</div>}
        <div style={{ textAlign: "center", fontSize: 12, color: "var(--ink3)", marginTop: 20 }}>Powered by NF3</div>
      </div>

      {!isKasir && (
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        background: "var(--surface)", borderTop: "1px solid var(--line)",
        padding: "12px 24px 24px",
        display: "grid",
        gridTemplateColumns: role === "purchasing" ? "1fr auto" : "1fr auto 1fr",
        alignItems: "flex-end",
      }}>
        <div style={{ justifySelf: "start" }}>
          <ModeBtn active={mode === "manual"} onClick={() => { setMode("manual"); setErr(""); }} Icon={Keyboard} label="Manual" />
        </div>
        {role !== "purchasing" && (
          <div style={{ justifySelf: "center" }}>
            <button onClick={() => { setMode("voice"); startVoice(); }} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", marginBottom: -6 }}>
              {listening && <span className="pulse-ring" style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--brand)", width: 60, height: 60, top: -6 }} />}
              <span style={{ width: 60, height: 60, borderRadius: 99, background: "linear-gradient(135deg,var(--brand),var(--brand-dark))", display: "grid", placeItems: "center", color: "#fff", position: "relative", boxShadow: "0 4px 16px rgba(99,102,241,.4)" }}><Mic size={26} /></span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)" }}>Bicara</span>
            </button>
          </div>
        )}
        {role === "purchasing" ? (
          <div style={{ justifySelf: "end" }}>
            <button
              type="button"
              onClick={() => { setMode("voice"); startVoice(); }}
              style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: "pointer", marginBottom: -6 }}
            >
              {listening && <span className="pulse-ring" style={{ position: "absolute", inset: 0, borderRadius: 99, background: "var(--brand)", width: 60, height: 60, top: -6 }} />}
              <span style={{ width: 60, height: 60, borderRadius: 99, background: "linear-gradient(135deg,var(--brand),var(--brand-dark))", display: "grid", placeItems: "center", color: "#fff", position: "relative", boxShadow: "0 4px 16px rgba(99,102,241,.4)" }}><Mic size={26} /></span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)" }}>Bicara</span>
            </button>
          </div>
        ) : (
        <div style={{ justifySelf: "end" }}>
          <ModeBtn
            active={mode === "scan"}
            disabled={scanFull}
            onClick={() => {
              if (scanFull) { setErr(`Batas scan nota hari ini (${MAX_SCAN_NOTA}x) sudah habis.`); return; }
              setMode("scan"); setErr("");
            }}
            Icon={ScanLine}
            label={scanLabel}
          />
        </div>
        )}
      </div>
      )}
    </Sheet>
  );
}

const ModeBtn = ({ active, onClick, Icon, label, disabled }) => (
  <button onClick={onClick} disabled={disabled} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "none", border: "none", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}>
    <span style={{ width: 46, height: 46, borderRadius: 99, background: active ? "var(--brand-soft)" : "var(--surface2)", display: "grid", placeItems: "center", color: active ? "var(--brand)" : "var(--ink3)" }}><Icon size={20} /></span>
    <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: active ? "var(--brand)" : "var(--ink3)", textAlign: "center", maxWidth: 88, lineHeight: 1.2 }}>{label}</span>
  </button>
);

function ManualForm({ s, onReady }) {
  const role = s.currentUser?.role || "kasir";
  const myWallets = visibleWallets(s.wallets, s.currentUser);

  const allowedTypes = [];
  if (canDo(role, "inputIncome")) allowedTypes.push(["in", "Pemasukan"]);
  if (canDo(role, "inputExpense")) allowedTypes.push(["out", "Pengeluaran"]);
  if (canDo(role, "transfer")) allowedTypes.push(["transfer", "Transfer"]);
  if (allowedTypes.length === 0) allowedTypes.push(["out", "Pengeluaran"]);

  const [type, setType] = useState(allowedTypes[0][0]);
  const [amt, setAmt] = useState("");
  const [catId, setCatId] = useState("");
  const [walletId, setWalletId] = useState(myWallets[0]?.id || "");
  const [toWalletId, setToWalletId] = useState(myWallets[1]?.id || "");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(today());
  const [floorErr, setFloorErr] = useState("");

  const cats = visibleCategories(s.categories, s.currentUser, type === "transfer" ? "out" : type);
  useEffect(() => { setCatId(cats[0]?.id || ""); }, [type]);

  const checkAndReady = () => {
    if (type === "transfer") {
      const err = checkFloor(walletId, +amt, s.wallets, s.transactions, s.currentUser);
      if (err) { setFloorErr(err); return; }
      onReady({ type: "transfer", amount: +amt, fromWalletId: walletId, toWalletId, desc, date, source: "Manual" });
    } else {
      if (type === "out") {
        const err = checkFloor(walletId, +amt, s.wallets, s.transactions, s.currentUser);
        if (err) { setFloorErr(err); return; }
      }
      onReady({ type, amount: +amt, categoryId: catId, walletId, desc, date, source: "Manual" });
    }
    setFloorErr("");
  };

  const typeColors = { in: "var(--in)", out: "var(--out)", transfer: "var(--brand)" };
  const ready = amt && (type === "transfer" ? (walletId && toWalletId && walletId !== toWalletId) : catId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* tipe selector */}
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${allowedTypes.length},1fr)`, gap: 2, background: "var(--surface2)", borderRadius: 12, padding: 4 }}>
        {allowedTypes.map(([v, l]) => (
          <button key={v} onClick={() => { setType(v); setFloorErr(""); }} style={{ padding: 11, borderRadius: 9, fontSize: 13, fontWeight: 700, border: "none", cursor: "pointer", background: type === v ? typeColors[v] : "transparent", color: type === v ? "#fff" : "var(--ink2)" }}>{l}</button>
        ))}
      </div>

      {/* nominal */}
      <Fld label="Nominal">
        <div style={{ display: "flex", alignItems: "center", border: `1px solid ${floorErr ? "var(--out)" : "var(--line)"}`, borderRadius: 12, background: "var(--surface)" }}>
          <span style={{ padding: "0 12px", color: "var(--ink3)", fontWeight: 700 }}>Rp</span>
          <input inputMode="numeric" value={amt ? new Intl.NumberFormat("id-ID").format(amt) : ""} onChange={e => { setAmt(e.target.value.replace(/\D/g, "")); setFloorErr(""); }} placeholder="0"
            style={{ flex: 1, padding: "13px 0 13px 4px", background: "none", border: "none", fontSize: 16, fontWeight: 700, color: "var(--ink)", outline: "none" }} />
        </div>
        {floorErr && (
          <div style={{ marginTop: 6, padding: "8px 12px", borderRadius: 8, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 12, fontWeight: 600 }}>
            ⚠ {floorErr}
          </div>
        )}
      </Fld>

      {/* transfer: pilih from & to */}
      {type === "transfer" ? (
        <>
          <Fld label="Dari dompet">
            <select value={walletId} onChange={e => { setWalletId(e.target.value); setFloorErr(""); }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }}>
              {myWallets.map(w => {
                const bal = walletBalance(w.id, s.wallets, s.transactions);
                return <option key={w.id} value={w.id}>{walletOptionLabel(w, bal, s.profile.currency, s.currentUser, fmtMoney)}</option>;
              })}
            </select>
          </Fld>
          <Fld label="Ke dompet">
            <select value={toWalletId} onChange={e => setToWalletId(e.target.value)}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }}>
              {myWallets.filter(w => w.id !== walletId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Fld>
          {walletId && amt && (() => {
            const w = s.wallets.find(x => x.id === walletId);
            const bal = walletBalance(walletId, s.wallets, s.transactions);
            const after = bal - +amt;
            if (w?.floor && after < w.floor) return null; // sudah tampil di floorErr
            return (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--surface2)", fontSize: 12, color: "var(--ink2)" }}>
                Saldo setelah transfer: <b>Rp {new Intl.NumberFormat("id-ID").format(bal - +amt)}</b>
              </div>
            );
          })()}
        </>
      ) : (
        <>
          <Fld label="Kategori">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {cats.map(c => <Pill key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>{c.name}</Pill>)}
            </div>
          </Fld>
          <Fld label="Dompet">
            <select value={walletId} onChange={e => { setWalletId(e.target.value); setFloorErr(""); }}
              style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }}>
              {myWallets.map(w => {
                const bal = walletBalance(w.id, s.wallets, s.transactions);
                return <option key={w.id} value={w.id}>{walletOptionLabel(w, bal, s.profile.currency, s.currentUser, fmtMoney)}</option>;
              })}
            </select>
            {(() => {
              const w = s.wallets.find(x => x.id === walletId);
              if (!isPaylaterWallet(w)) return null;
              const bal = walletBalance(walletId, s.wallets, s.transactions);
              const after = amt ? bal - +amt : bal;
              return (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: "#FEF3C7", fontSize: 12, color: "#92400E", lineHeight: 1.45 }}>
                  PayLater = hutang wajib bayar. {amt ? `Setelah belanja: ${after < 0 ? `hutang ${fmtMoney(Math.abs(after), s.profile.currency)}` : fmtMoney(after, s.profile.currency)}` : "Belanja akan menambah hutang jika saldo habis."}
                </div>
              );
            })()}
          </Fld>
        </>
      )}

      {/* tanggal & catatan */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Fld label="Tanggal"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} /></Fld>
        <Fld label="Catatan"><input value={desc} onChange={e => setDesc(e.target.value)} placeholder="opsional" style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} /></Fld>
      </div>

      <button disabled={!ready} onClick={checkAndReady}
        style={{ padding: 14, borderRadius: 14, border: "none", background: ready ? typeColors[type] : "var(--ink3)", opacity: ready ? 1 : .5, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        Lanjut tinjau →
      </button>
    </div>
  );
}
const Fld = ({ label, children }) => <div><div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink3)", marginBottom: 6 }}>{label}</div>{children}</div>;

// ─── Daily Report Sosmed ───────────────────────────────────
function SosNumRow({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
      <span style={{ fontSize: 14, color: "var(--ink)" }}>{label}</span>
      <input inputMode="numeric" value={value === 0 ? "" : String(value)} placeholder="0"
        onChange={e => onChange(parseInt(e.target.value.replace(/\D/g, "") || "0", 10) || 0)}
        style={{ width: 72, padding: "8px 10px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 16, fontWeight: 700, textAlign: "center", color: "var(--ink)", outline: "none" }} />
    </div>
  );
}

function SosCheckRow({ label, checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--line)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{label}</span>
      <span style={{ fontSize: 18 }}>{checked ? "✅" : "⬜"}</span>
    </button>
  );
}

function SosmedHarianScreen({ s, mutate, onClose, user }) {
  const role = user?.role || "kasir";
  const enabled = hydrateSosmedConfig(s.sosmedConfig).enabledOutlets;
  const [pickOutlet, setPickOutlet] = useState(resolveSosmedOutlet(user, enabled[0]));
  const outlet = resolveSosmedOutlet(user, pickOutlet);
  const display = sosmedDisplayName(outlet);

  const [date, setDate] = useState(today());
  const existing = useMemo(() => todaySosmedReport(s.sosmedReports, outlet, date), [s.sosmedReports, outlet, date]);

  const [dm, setDm] = useState(() => ({ ...existing?.dm }));
  const [comments, setComments] = useState(() => ({ ...existing?.comments }));
  const [googleReviews, setGoogleReviews] = useState(() => ({ ...existing?.googleReviews }));
  const [replied, setReplied] = useState(() => ({ ...existing?.replied }));
  const [wellDone, setWellDone] = useState(existing?.wellDone || false);
  const [complaintsText, setComplaintsText] = useState(linesToText(existing?.complaints));
  const [questionsText, setQuestionsText] = useState(linesToText(existing?.topQuestions));
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const draftDirtyRef = useRef(false);
  const syncKeyRef = useRef(`${outlet}:${date}`);

  useEffect(() => {
    draftDirtyRef.current =
      wellDone
      || !!complaintsText.trim()
      || !!questionsText.trim()
      || Object.values(dm).some(v => String(v || "").trim() !== "")
      || Object.values(comments).some(v => String(v || "").trim() !== "")
      || Object.values(googleReviews).some(v => String(v || "").trim() !== "")
      || Object.values(replied).some(v => String(v || "").trim() !== "");
  }, [dm, comments, googleReviews, replied, wellDone, complaintsText, questionsText]);

  useEffect(() => {
    const key = `${outlet}:${date}`;
    const keyChanged = syncKeyRef.current !== key;
    if (keyChanged) {
      syncKeyRef.current = key;
      draftDirtyRef.current = false;
    }
    if (!keyChanged && draftDirtyRef.current) return;

    const ex = todaySosmedReport(s.sosmedReports, outlet, date);
    const blank = emptyReport(outlet, date);
    setDm({ ...blank.dm, ...ex?.dm });
    setComments({ ...blank.comments, ...ex?.comments });
    setGoogleReviews({ ...blank.googleReviews, ...ex?.googleReviews });
    setReplied({ ...blank.replied, ...ex?.replied });
    setWellDone(!!ex?.wellDone);
    setComplaintsText(linesToText(ex?.complaints));
    setQuestionsText(linesToText(ex?.topQuestions));
    setOk("");
  }, [outlet, date, s.sosmedReports]);

  const setDmKey = (k, v) => setDm(prev => ({ ...prev, [k]: v }));
  const setCommentKey = (k, v) => setComments(prev => ({ ...prev, [k]: v }));
  const setStarKey = (k, v) => setGoogleReviews(prev => ({ ...prev, [k]: v }));
  const setRepliedKey = (k, v) => setReplied(prev => ({ ...prev, [k]: v }));

  const save = () => {
    setErr(""); setOk("");
    try {
      const { reports } = submitSosmedReport(s, {
        id: existing?.id,
        outlet, date, dm, comments, googleReviews, replied, wellDone,
        complaintsText, topQuestionsText: questionsText,
      }, user);
      mutate(d => { d.sosmedReports = reports; });
      setOk("Laporan sosmed tersimpan.");
    } catch (e) {
      setErr(e.message || "Gagal menyimpan");
    }
  };

  const waText = useMemo(() => formatSosmedFormWa({
    outlet, date, dm, comments, googleReviews, replied, wellDone,
    complaintsText, topQuestionsText: questionsText,
    submittedByName: user?.name || existing?.submittedByName,
  }), [outlet, date, dm, comments, googleReviews, replied, wellDone, complaintsText, questionsText, user?.name, existing?.submittedByName]);

  if (!outlet || !isSosmedEnabled(s.sosmedConfig, outlet)) {
    return (
      <Sheet title="Daily Report Sosmed" onClose={onClose}>
        <div style={{ padding: 24, textAlign: "center", color: "var(--ink3)", fontSize: 14 }}>
          Belum ada outlet aktif untuk Daily Report Sosmed. Admin bisa aktifkan di Pengaturan → Operasional.
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={`Daily Report Sosmed · ${display}`} onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 14, padding: "12px 14px", background: "var(--brand-soft)", borderRadius: 12, lineHeight: 1.5 }}>
          Isi angka kosong = 0. Komplain & pertanyaan: <b>satu baris = satu poin</b> (contoh: <i>sayur asem 6x</i>).
        </div>

        {role !== "kasir" && enabled.length > 1 && (
          <Fld label="Outlet">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {enabled.map(o => (
                <button key={o} type="button" onClick={() => setPickOutlet(o)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${pickOutlet === o ? "var(--brand)" : "var(--line)"}`, background: pickOutlet === o ? "var(--brand-soft)" : "var(--surface)", color: pickOutlet === o ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>
                  {sosmedDisplayName(o)}
                </button>
              ))}
            </div>
          </Fld>
        )}

        <Fld label="Tanggal">
          <input type="date" value={date} max={today()} onChange={e => setDate(e.target.value)}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)" }} />
          <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>{dayLabel(date)}</div>
        </Fld>

        <div style={{ marginTop: 16 }}><Lbl>DM masuk</Lbl></div>
        <Card style={{ padding: "4px 14px", marginBottom: 16 }}>
          {DM_PLATFORMS.map(p => (
            <SosNumRow key={p.key} label={p.label} value={dm[p.key] || 0} onChange={v => setDmKey(p.key, v)} />
          ))}
        </Card>

        <Lbl>Komentar postingan</Lbl>
        <Card style={{ padding: "4px 14px", marginBottom: 16 }}>
          {SOCIAL_PLATFORMS.map(p => (
            <SosNumRow key={p.key} label={p.label} value={comments[p.key] || 0} onChange={v => setCommentKey(p.key, v)} />
          ))}
        </Card>

        <Lbl>Google review masuk</Lbl>
        <Card style={{ padding: "4px 14px", marginBottom: 16 }}>
          {STAR_KEYS.map(s => (
            <SosNumRow key={s.key} label={s.label} value={googleReviews[s.key] || 0} onChange={v => setStarKey(s.key, v)} />
          ))}
        </Card>

        <Lbl>Sudah dibalas</Lbl>
        <Card style={{ padding: "4px 14px", marginBottom: 16 }}>
          {SOCIAL_PLATFORMS.map(p => (
            <SosCheckRow key={p.key} label={p.label} checked={!!replied[p.key]} onChange={v => setRepliedKey(p.key, v)} />
          ))}
        </Card>

        <Card style={{ padding: "14px 16px", marginBottom: 16 }}>
          <SosCheckRow label="Well-done ✅" checked={wellDone} onChange={setWellDone} />
        </Card>

        <Fld label="Komplain yang perlu di-follow up (satu per baris)">
          <textarea value={complaintsText} onChange={e => setComplaintsText(e.target.value)} rows={4} placeholder={"Contoh:\nAC dingin kurang\nMeja kotor area depan"}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none", resize: "vertical", lineHeight: 1.45 }} />
        </Fld>

        <div style={{ height: 12 }} />
        <Fld label="Pertanyaan customer terbanyak (satu per baris)">
          <textarea value={questionsText} onChange={e => setQuestionsText(e.target.value)} rows={8} placeholder={"Contoh:\nsayur asem 6x\npisang coklat 3x\nJUS 18x"}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none", resize: "vertical", lineHeight: 1.45 }} />
        </Fld>

        {err && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>{err}</div>}
        {ok && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--in-soft)", color: "var(--in-text)", fontSize: 13 }}>{ok}</div>}

        <button type="button" onClick={save} style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 14, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
          Simpan laporan sosmed
        </button>
        <ShareWaBtn text={waText} />
        {ok && (
          <button type="button" onClick={onClose} style={{ width: "100%", marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink2)", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
            Tutup
          </button>
        )}
      </div>
    </Sheet>
  );
}

function SosmedConfigScreen({ s, mutate, onClose }) {
  const enabled = new Set(hydrateSosmedConfig(s.sosmedConfig).enabledOutlets);
  const toggle = (o) => {
    mutate(d => {
      const cfg = hydrateSosmedConfig(d.sosmedConfig);
      const set = new Set(cfg.enabledOutlets);
      if (set.has(o)) set.delete(o); else set.add(o);
      d.sosmedConfig = { enabledOutlets: SOSMED_OUTLETS.filter(x => set.has(x)) };
    });
  };
  return (
    <Sheet title="Sosmed — Aktifkan Outlet" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 14, lineHeight: 1.5 }}>
          Pilih outlet yang wajib isi <b>Daily Report Sosmed</b> setiap hari. Saat ini BURI UMAH (KBU) aktif.
        </div>
        {SOSMED_OUTLETS.map(o => (
          <Card key={o} style={{ padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontWeight: 700, color: "var(--ink)" }}>{sosmedDisplayName(o)}</div>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>Kode: {o}</div>
            </div>
            <Tog on={enabled.has(o)} onToggle={() => toggle(o)} />
          </Card>
        ))}
      </div>
    </Sheet>
  );
}

// ─── Input SDM Pagi (kasir) ────────────────────────────────
function SdmHarianScreen({ s, mutate, onClose }) {
  const user = s.currentUser;
  const cur = s.profile.currency;
  const cfg = getOutletConfig(s.outletConfig, user.outlet);
  const outletLabel = OUTLET_LABEL[user.outlet] || user.outlet;
  const sdmHint = SDM_HINT[user.outlet] || "";
  const existing = todaySdmReport(s.sdmReports, user.outlet, today());

  const [headcount, setHeadcount] = useState(existing?.headcount?.toString() || "");
  const [opsNote, setOpsNote] = useState(existing?.opsNote || "");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(!!existing);
  const [savedReport, setSavedReport] = useState(existing || null);

  const headcountN = parseHeadcountInput(headcount);
  const previewTarget = calcDailyOmsetTarget(headcountN, s.outletConfig, user.outlet);
  const canSave = headcountN > 0 && !saved;

  const submit = () => {
    setErr("");
    setSaving(true);
    try {
      const { report } = submitSdmReport({ ...s, currentUser: user }, {
        headcount: headcountN, date: today(), user, opsTags: [], opsNote,
      });
      mutate(d => {
        if (!d.sdmReports) d.sdmReports = [];
        d.sdmReports.push(report);
      });
      setSaved(true);
      setSavedReport(report);
    } catch (e) {
      setErr(e.message || "Gagal menyimpan SDM");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (existing) setSavedReport(existing);
  }, [existing]);

  const sdmShare = savedReport || todaySdmReport(s.sdmReports, user.outlet, today());

  const numInput = (val, set, placeholder) => (
    <input inputMode="numeric" value={val} onChange={e => set(e.target.value.replace(/[^\d-]/g, ""))} placeholder={placeholder} disabled={saved}
      style={{ width: "100%", padding: "16px 14px", borderRadius: 12, border: "1px solid var(--line)", background: saved ? "var(--surface2)" : "var(--surface)", fontSize: 28, fontWeight: 800, color: "var(--ink)", outline: "none", textAlign: "center" }} />
  );

  return (
    <Sheet title={`SDM Pagi · ${outletLabel}`} onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 16, padding: "12px 14px", background: "var(--brand-soft)", borderRadius: 12, lineHeight: 1.5 }}>
          Berapa orang yang masuk kerja hari ini di <b>{outletLabel}</b>?
          Cukup isi angka — target omset dihitung otomatis.
          {sdmHint && <div style={{ marginTop: 6, fontSize: 12, opacity: .85 }}>Patokan: {sdmHint}</div>}
        </div>

        <Fld label="Jumlah SDM hari ini">{numInput(headcount, setHeadcount, user.outlet === "KBU" ? "10" : user.outlet === "KSM" ? "6" : "1")}</Fld>

        {headcountN > 0 && (
          <Card style={{ marginTop: 18, padding: "14px 16px", background: "var(--surface2)" }}>
            <div style={{ fontSize: 12, color: "var(--ink3)" }}>
              {formatTargetFormula(headcountN, cfg.omsetPerPerson, cur)}
            </div>
            <div className="money" style={{ fontWeight: 800, color: "var(--brand)", fontSize: 20, marginTop: 6 }}>
              Target omset hari ini: {fmtMoney(previewTarget, cur)}
            </div>
          </Card>
        )}

        {!saved && (
          <Card style={{ marginTop: 14, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>Catatan (opsional)</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10 }}>Untuk admin — mis. ada yang sakit, bahan habis, dll.</div>
            <textarea value={opsNote} onChange={e => setOpsNote(e.target.value)} placeholder="Mis. 1 orang sakit, telur habis…" rows={2} disabled={saved}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, resize: "vertical", background: "var(--surface)" }} />
          </Card>
        )}

        {err && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>{err}</div>}
        {!saved ? (
          <button disabled={!canSave || saving} onClick={submit} style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 14, border: "none", background: canSave ? "var(--brand)" : "var(--ink3)", opacity: canSave ? 1 : .5, color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
            {saving ? "Menyimpan…" : "Simpan SDM →"}
          </button>
        ) : (
          <>
            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "var(--in-soft)", color: "var(--in-text)", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
              ✓ SDM hari ini sudah tercatat
            </div>
            <ShareWaBtn text={formatSdmWa(sdmShare)} />
          </>
        )}
      </div>
    </Sheet>
  );
}

// ─── Laporan Omset Harian (kasir) ──────────────────────────
function KasirHarianScreen({ s, mutate, onClose, initialDate = null }) {
  const user = s.currentUser;
  const cur = s.profile.currency;
  const cfg = getOutletConfig(s.outletConfig, user.outlet);
  const channels = getReportChannels(s, user.outlet);
  const ui = getReportUi(s, user.outlet);
  const cashCh = cashChannel(channels);
  const grouped = groupChannels(channels);
  const todaySdm = todaySdmReport(s.sdmReports, user.outlet, today());
  const floor = LACI_FLOOR;
  const pendingRevision = findPendingRevisionReport(s.dailyReports, user.outlet, s.staffMessages);
  const userPickedDateRef = useRef(false);

  const [date, setDate] = useState(() => {
    if (initialDate) return initialDate;
    return pendingRevision?.date || today();
  });
  const dateSdm = todaySdmReport(s.sdmReports, user.outlet, date);
  const existingReport = (s.dailyReports || []).find(
    r => r.outlet === user.outlet && r.date === date && r.status !== "settled"
  );
  const isRevision = reportAwaitingKasirRevision(existingReport, s.staffMessages, user.outlet);
  const revisionNote = revisionNoteForReport(existingReport, s.staffMessages, user.outlet);
  const isLocked = existingReport && !isRevision;

  const initAmounts = (report) => {
    const o = {};
    channels.forEach(c => {
      o[c.id] = report?.channels?.[c.id] ? String(report.channels[c.id]) : "";
    });
    return o;
  };
  const [amounts, setAmounts] = useState(() => initAmounts(existingReport));
  const [physicalCashEnd, setPhysicalCashEnd] = useState(
    existingReport?.physicalCashEnd ? String(existingReport.physicalCashEnd) : ""
  );
  const [opsNote, setOpsNote] = useState(existingReport?.opsNote || "");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitted, setSubmitted] = useState(!!existingReport && !isRevision);
  const [lastReport, setLastReport] = useState(isLocked ? existingReport : null);
  const draftDirtyRef = useRef(false);
  const syncDateRef = useRef(date);
  const submittingRef = useRef(false);
  const submitSuccessRef = useRef(false);
  const successBannerRef = useRef(null);

  useEffect(() => {
    if (initialDate) return;
    const rev = findPendingRevisionReport(s.dailyReports, user.outlet, s.staffMessages);
    if (!rev?.date || userPickedDateRef.current) return;
    if (rev.date !== date) setDate(rev.date);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.dailyReports, s.staffMessages, user.outlet, initialDate]);

  useEffect(() => {
    draftDirtyRef.current =
      !!opsNote.trim()
      || !!physicalCashEnd
      || channels.some(c => String(amounts[c.id] || "").trim() !== "");
  }, [amounts, opsNote, physicalCashEnd, channels]);

  useEffect(() => {
    const rep = (s.dailyReports || []).find(
      r => r.outlet === user.outlet && r.date === date && r.status !== "settled"
    );
    const dateChanged = syncDateRef.current !== date;
    if (dateChanged) {
      syncDateRef.current = date;
      draftDirtyRef.current = false;
      submitSuccessRef.current = false;
      setSubmitSuccess(false);
    }
    if (submitSuccessRef.current) return;
    const forceSync = rep && reportAwaitingKasirRevision(rep, s.staffMessages, user.outlet);
    if (!dateChanged && draftDirtyRef.current && !submitted && !forceSync) return;

    setAmounts(initAmounts(rep));
    setPhysicalCashEnd(rep?.physicalCashEnd ? String(rep.physicalCashEnd) : "");
    setOpsNote(rep?.opsNote || "");
    setSubmitted(!!rep && !reportAwaitingKasirRevision(rep, s.staffMessages, user.outlet));
    setLastReport(rep && !reportAwaitingKasirRevision(rep, s.staffMessages, user.outlet) ? rep : null);
    setErr("");
    if (forceSync) draftDirtyRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, s.dailyReports, s.staffMessages, user.outlet]);

  const dailyTarget = dateSdm?.targetOmset || calcDailyOmsetTarget(dateSdm?.headcount || 0, s.outletConfig, user.outlet);
  const perPerson = dateSdm?.omsetPerPerson || cfg.omsetPerPerson;

  const setAmt = (id, val) => setAmounts(a => ({ ...a, [id]: val.replace(/\D/g, "") }));

  const derivedCash = physicalCashEnd ? Math.max(0, (+physicalCashEnd || 0) - floor) : 0;
  const cashAmt = physicalCashEnd && cashCh
    ? derivedCash
    : Math.max(0, +(amounts[cashCh?.id] || 0));
  const nonCashTotal = channels
    .filter(c => c.role !== "cash")
    .reduce((sum, c) => sum + Math.max(0, +(amounts[c.id] || 0)), 0);
  const total = cashAmt + nonCashTotal;
  const ready = total > 0 || (+physicalCashEnd || 0) > 0;
  const showSubmittedLock = (submitted || submitSuccess) && lastReport;

  const finishSubmitSuccess = (saved, { resubmit = false } = {}) => {
    submitSuccessRef.current = true;
    setSubmitSuccess(true);
    setSubmitted(true);
    setLastReport(saved);
    setErr("");
    try { navigator.vibrate?.(120); } catch { /* ignore */ }
    showActionToast(
      resubmit ? "✓ Revisi terkirim — tunggu verifikasi admin" : "✓ Laporan omset tersimpan",
      "success"
    );
    setTimeout(() => successBannerRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 80);
  };

  const submit = () => {
    if (submittingRef.current || submitting || submitSuccess) return;
    submittingRef.current = true;
    setErr("");
    setSubmitting(true);
    try {
      const payload = {
        channels: Object.fromEntries(
          channels.map(c => {
            if (c.role === "cash" && physicalCashEnd && cashCh) return [c.id, String(derivedCash)];
            return [c.id, amounts[c.id] || ""];
          })
        ),
        physicalCashEnd: physicalCashEnd || null,
        date,
        user,
      };
      if (isRevision && existingReport) {
        const { report, txs, removeIds } = resubmitDailyReport({ ...s, currentUser: user }, existingReport.id, payload);
        const fulfilledAt = report.resubmittedAt || new Date().toISOString();
        mutate(d => {
          const i = (d.dailyReports || []).findIndex(r => r.id === existingReport.id);
          const saved = { ...report, opsNote: opsNote.trim(), dailyTargetAtSubmit: dailyTarget || null };
          if (i >= 0) d.dailyReports[i] = saved;
          d.transactions = (d.transactions || []).filter(t => !removeIds.includes(t.id));
          txs.forEach(t => d.transactions.push(t));
          if (user?.id) {
            d.staffMessages = resolveRevisionMessages(d.staffMessages, existingReport.id, user.id, existingReport.date, fulfilledAt);
          }
          try {
            const nmsg = createDailyReportSubmittedMessage({ report: saved, author: user, resubmit: true });
            d.staffMessages = prependStaffMessage(d.staffMessages, nmsg, d.notificationPrefs);
            const ack = createRevisionSubmittedAckMessage({ report: saved, author: user });
            d.staffMessages = prependStaffMessage(d.staffMessages, ack, d.notificationPrefs);
          } catch { /* ignore */ }
        });
        finishSubmitSuccess({ ...report, opsNote: opsNote.trim(), dailyTargetAtSubmit: dailyTarget || null }, { resubmit: true });
      } else {
        const { report, txs } = submitDailyReport({ ...s, currentUser: user }, payload);
        mutate(d => {
          if (!d.dailyReports) d.dailyReports = [];
          const saved = { ...report, opsNote: opsNote.trim(), dailyTargetAtSubmit: dailyTarget || null };
          d.dailyReports.push(saved);
          txs.forEach(t => d.transactions.push(t));
          try {
            const nmsg = createDailyReportSubmittedMessage({ report: saved, author: user, resubmit: false });
            d.staffMessages = prependStaffMessage(d.staffMessages, nmsg, d.notificationPrefs);
          } catch { /* ignore */ }
        });
        finishSubmitSuccess({
          ...report,
          opsNote: opsNote.trim(),
          dailyTargetAtSubmit: dailyTarget || null,
        });
      }
    } catch (e) {
      setErr(e.message || "Gagal menyimpan laporan");
      showActionToast(e.message || "Gagal menyimpan laporan", "error");
    } finally {
      setSubmitting(false);
      if (!submitSuccessRef.current) submittingRef.current = false;
    }
  };

  const numInput = (val, set, placeholder = "0") => (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
      <span style={{ padding: "0 12px", color: "var(--ink3)", fontWeight: 700 }}>Rp</span>
      <input inputMode="numeric" value={val ? new Intl.NumberFormat("id-ID").format(val) : ""} onChange={e => set(e.target.value.replace(/\D/g, ""))} placeholder={placeholder}
        style={{ flex: 1, padding: "13px 0", background: "none", border: "none", fontSize: 16, fontWeight: 700, color: "var(--ink)", outline: "none" }} />
    </div>
  );

  return (
    <Sheet title={`Laporan Omset · ${OUTLET_LABEL[user.outlet] || user.outlet}`} onClose={onClose}>
      <div style={{ padding: "16px 16px max(48px, env(safe-area-inset-bottom))" }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 16, padding: "12px 14px", background: "var(--brand-soft)", borderRadius: 12 }}>
          Isi sesuai kebiasaan laporan manual outlet Anda. <b>Tunai/setoran</b> masuk laci {user.outlet}.
          Channel lain dicatat untuk Admin NF3 settle ke rekening/dompet digital.
          <div style={{ marginTop: 6, fontSize: 12, opacity: .9 }}>Setelah kirim → admin verifikasi fisik pagi → owner/admin settle siang s/d esok 17:00.</div>
          {dailyTarget > 0 ? (
            <div style={{ marginTop: 6 }}>Target: <b>{fmtMoney(dailyTarget, cur)}</b> ({formatTargetFormula(dateSdm?.headcount, perPerson, cur)})</div>
          ) : (
            <div style={{ marginTop: 6 }}>Target: <b>{fmtMoney(cfg.omsetPerPerson, cur)}/org × SDM</b> — SDM pagi opsional untuk backfill tanggal lalu</div>
          )}
        </div>
        {submitSuccess && lastReport && (
          <div ref={successBannerRef} style={{ marginBottom: 16, padding: "16px 18px", borderRadius: 14, background: "var(--in-soft)", border: "2px solid var(--in-text)", textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>✓</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "var(--in-text)" }}>
              {lastReport.resubmittedAt ? "Revisi berhasil terkirim!" : "Laporan berhasil tersimpan!"}
            </div>
            <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 8, lineHeight: 1.45 }}>
              Total {fmtMoney(lastReport.total, cur)} · menunggu verifikasi admin.<br />
              <b>Jangan kirim ulang</b> — cek Pengumuman untuk konfirmasi.
            </div>
          </div>
        )}
        {isRevision && revisionNote && !submitSuccess && (
          <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 12, background: "var(--out-soft)", border: "1px solid #FECACA" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "var(--out-text)", marginBottom: 4 }}>Revisi wajib dari {existingReport?.revisionRequestedByRole === "owner" ? "Owner" : "Admin Keuangan"}</div>
            <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.45 }}>{revisionNote}</div>
          </div>
        )}
        {pendingRevision && pendingRevision.date !== date && (
          <button type="button" onClick={() => { userPickedDateRef.current = false; setDate(pendingRevision.date); }}
            style={{ width: "100%", marginBottom: 14, padding: "12px 14px", borderRadius: 12, border: "2px solid var(--out-text)", background: "var(--out-soft)", color: "var(--out-text)", fontWeight: 700, fontSize: 13, cursor: "pointer", textAlign: "left" }}>
            ⚠ Revisi wajib untuk {shortDate(pendingRevision.date)} — tap untuk buka form revisi
          </button>
        )}
        {!dateSdm && date === today() && (
          <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 12, padding: "10px 12px", background: "var(--surface2)", borderRadius: 10 }}>
            Belum input SDM pagi hari ini — target omset estimasi. Isi SDM di Beranda jika perlu.
          </div>
        )}
        {dateSdm && (
          <Card style={{ marginBottom: 14, padding: "12px 14px", background: "var(--surface2)" }}>
            <div style={{ fontSize: 13, color: "var(--ink2)" }}>
              SDM {dateSdm.headcount} org · target {fmtMoney(dailyTarget, cur)}
            </div>
          </Card>
        )}
        <Fld label="Tanggal">
          <input type="date" value={date} onChange={e => { userPickedDateRef.current = true; setDate(e.target.value); }} max={today()}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
          <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 6 }}>
            {isRevision
              ? "Ubah tanggal untuk laporan lain — selama belum settle, revisi bisa dikirim ulang."
              : "Backfill tanggal lalu boleh · laporan sudah kirim terkunci kecuali admin minta revisi."}
          </div>
        </Fld>

        {ui.physicalCashControl && (
          <Card style={{ marginTop: 14, padding: "14px 16px", background: "var(--surface2)" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", marginBottom: 10 }}>💰 Kontrol Cash Fisik</div>
            {ui.showKasAwal && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink2)", marginBottom: 8 }}>
                <span>Kas Awal (modal statis)</span>
                <span className="money" style={{ fontWeight: 700 }}>{fmtMoney(floor, cur)}</span>
              </div>
            )}
            <Fld label="Kas Fisik Akhir (hitung uang di laci)">
              {numInput(physicalCashEnd, setPhysicalCashEnd)}
            </Fld>
            {physicalCashEnd && (
              <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: "var(--in-soft)", fontSize: 13 }}>
                <div style={{ color: "var(--ink3)" }}>Setoran Owner (tunai → laci)</div>
                <div className="money" style={{ fontWeight: 800, color: "var(--in-text)", fontSize: 18, marginTop: 4 }}>
                  {fmtMoney(derivedCash, cur)}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 4 }}>
                  {fmtMoney(+physicalCashEnd, cur)} − {fmtMoney(floor, cur)} modal
                </div>
              </div>
            )}
          </Card>
        )}

        {grouped.map(({ group, items }) => {
          const visible = items.filter(c => !(c.role === "cash" && physicalCashEnd));
          if (!visible.length) return null;
          return (
            <div key={group || "_"} style={{ marginTop: 18 }}>
              {group && <div style={{ fontSize: 12, fontWeight: 800, color: "var(--ink3)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 10 }}>{group}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {visible.map(ch => (
                  <Fld key={ch.id} label={`${ch.icon || ""} ${ch.label}`.trim()}>
                    {numInput(amounts[ch.id], v => setAmt(ch.id, v))}
                  </Fld>
                ))}
              </div>
            </div>
          );
        })}

        <Card style={{ marginTop: 18, padding: "14px 16px", background: "var(--surface2)" }}>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>Total omset hari ini</div>
          <div className="money" style={{ fontSize: 28, fontWeight: 800, color: "var(--brand)", marginTop: 4 }}>{fmtMoney(total, cur)}</div>
          {cashAmt > 0 && (
            <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 6 }}>Setoran tunai: {fmtMoney(cashAmt, cur)}</div>
          )}
          {dailyTarget > 0 && total > 0 && (
            <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>
              Target {fmtMoney(dailyTarget, cur)} · tercatat {fmtMoney(total, cur)}
            </div>
          )}
        </Card>

        {!showSubmittedLock && (
          <Card style={{ marginTop: 14, padding: "14px 16px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, color: "var(--ink)" }}>Catatan (opsional)</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10 }}>Untuk admin — mis. antrian panjang, mesin error, dll.</div>
            <textarea value={opsNote} onChange={e => setOpsNote(e.target.value)} placeholder="Mis. antrian 1 jam karena 1 orang sakit…" rows={2}
              style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, resize: "vertical", background: "var(--surface)" }} />
          </Card>
        )}

        {err && <div style={{ marginTop: 12, padding: 12, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>{err}</div>}
        {!showSubmittedLock ? (
          <button type="button" disabled={!ready || submitting || submitSuccess} onClick={submit} style={{ width: "100%", marginTop: 16, marginBottom: 8, padding: 14, borderRadius: 14, border: "none", background: ready && !submitting ? (isRevision ? "var(--out-text)" : "var(--brand)") : "var(--ink3)", opacity: ready && !submitting ? 1 : .65, color: "#fff", fontWeight: 700, fontSize: 15, cursor: ready && !submitting && !submitSuccess ? "pointer" : "default", position: "relative", zIndex: 2 }}>
            {submitting ? "⏳ Menyimpan… jangan tap lagi" : isRevision ? "Kirim revisi →" : "Kirim laporan →"}
          </button>
        ) : lastReport ? (
          <>
            <div ref={successBannerRef} style={{ marginTop: 16, padding: 12, borderRadius: 12, background: "var(--in-soft)", color: "var(--in-text)", fontSize: 13, textAlign: "center", fontWeight: 600 }}>
              {lastReport.resubmittedAt
                ? "✓ Revisi tersimpan · menunggu verifikasi Admin Keuangan"
                : lastReport.status === "admin_verified"
                  ? "✓ Diverifikasi admin · menunggu settle owner/admin"
                  : lastReport.status === "submitted"
                    ? "✓ Laporan tersimpan · menunggu verifikasi Admin Keuangan (fisik & nota)"
                    : "✓ Laporan omset tersimpan"}
            </div>
            <ShareWaBtn text={formatOmsetWa(lastReport, channels)} />
            <button onClick={onClose} style={{ width: "100%", marginTop: 10, padding: 14, borderRadius: 14, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Tutup
            </button>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

// ─── Settle Laporan (Admin NF3) ────────────────────────────
function DeleteReportButton({ report, busy, onDelete, urgent = false }) {
  if (!onDelete) return null;
  return (
    <button type="button" disabled={busy === report.id} onClick={() => onDelete(report)}
      style={{
        width: "100%",
        padding: urgent ? 13 : 10,
        borderRadius: 12,
        border: urgent ? "2px solid var(--out-text)" : "1px solid var(--out-soft)",
        background: urgent ? "var(--out-text)" : "var(--out-soft)",
        color: urgent ? "#fff" : "var(--out-text)",
        fontWeight: 800,
        fontSize: urgent ? 14 : 13,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: busy === report.id ? .6 : 1,
      }}>
      <Trash2 size={urgent ? 17 : 15} />
      {urgent ? "Hapus laporan & bersihkan duplikat omset" : "Hapus laporan omset (belum settle)"}
    </button>
  );
}

function SettleReportCard({ r, s, cur, user, onVerify, onRevision, onSettle, onDelete, busy, revisingId, setRevisingId, revisionNote, setRevisionNote }) {
  const chs = getReportChannels(s, r.outlet);
  const lines = r.channels
    ? chs.map(c => ({ label: c.label, amt: Math.max(0, +(r.channels[c.id] || 0)) })).filter(x => x.amt > 0)
    : [
      { label: "Tunai", amt: r.cash || 0 },
      { label: "QRIS BCA", amt: r.qrisBca || 0 },
      { label: "QRIS BRI", amt: r.qrisBri || 0 },
      { label: "Gojek", amt: r.gojek || 0 },
    ].filter(x => x.amt > 0);
  const cash = reportCashAmount(r, chs);
  const dayVoids = (s.voidLogs || []).filter(v => v.outlet === r.outlet && v.date === r.date);
  const pendingVoids = dayVoids.filter(v => v.status === "submitted");
  const walletId = LACI_BY_OUTLET[r.outlet];
  const laciBal = walletId ? walletBalance(walletId, s.wallets, s.transactions) : 0;
  const floor = r.laciFloor || LACI_FLOOR;
  const expectedLaci = floor + cash;
  const laciOk = Math.abs(laciBal - expectedLaci) <= 1000;
  const urgency = reportSettleUrgency(r);
  const statusLabel = {
    submitted: "Menunggu verifikasi",
    admin_verified: "Siap settle",
    revision_requested: "Menunggu revisi kasir",
  }[r.status] || r.status;

  return (
    <Card key={r.id} style={{ padding: "14px 16px", border: urgency === "overdue" ? "2px solid var(--out-text)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div>
          <div style={{ fontWeight: 800, color: "var(--ink)" }}>{OUTLET_LABEL[r.outlet] || r.outlet} · {shortDate(r.date)}</div>
          <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>{r.kasirName || "Kasir"} · {statusLabel}</div>
          {r.physicalCashEnd > 0 && (
            <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>Kas fisik dilaporkan: {fmtMoney(r.physicalCashEnd, cur)}</div>
          )}
          <div style={{ fontSize: 11, color: urgency === "overdue" ? "var(--out-text)" : "var(--ink3)", marginTop: 4, fontWeight: urgency ? 700 : 400 }}>
            Batas settle: {reportSettleDeadlineLabel(r.date)}{urgency === "overdue" ? " · TERLAMBAT" : urgency === "urgent" ? " · segera" : ""}
          </div>
        </div>
        <div className="money" style={{ fontWeight: 800, color: "var(--brand)" }}>{fmtMoney(r.total, cur)}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, color: "var(--ink2)", marginBottom: 12 }}>
        {lines.map(l => (
          <span key={l.label}>{l.label}: {fmtMoney(l.amt, cur)}</span>
        ))}
      </div>
      {(r.status === "submitted" || r.status === "admin_verified") && walletId && (
        <div style={{ fontSize: 12, marginBottom: 10, padding: "10px 12px", borderRadius: 10, background: laciOk ? "var(--in-soft)" : "var(--amber-soft)", lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, color: "var(--ink)", marginBottom: 4 }}>Periksa dompet laci {r.outlet}</div>
          <div>Saldo sistem: <b>{fmtMoney(laciBal, cur)}</b></div>
          <div>Harusnya (floor + tunai): <b>{fmtMoney(expectedLaci, cur)}</b></div>
          {!laciOk && (
            <div style={{ color: "#92400E", fontWeight: 700, marginTop: 4, lineHeight: 1.45 }}>
              ⚠ Selisih besar — kemungkinan duplikat omset tunai dari revisi.
              {onDelete
                ? " Gunakan tombol merah Hapus laporan di bawah (bukan hapus transaksi satu-satu di Laporan)."
                : " Minta kasir revisi atau hubungi admin."}
            </div>
          )}
        </div>
      )}
      {!laciOk && onDelete && r.status !== "settled" && (
        <div style={{ marginBottom: 10 }}>
          <DeleteReportButton report={r} busy={busy} onDelete={onDelete} urgent />
        </div>
      )}
      {cash > 0 && (
        <div style={{ fontSize: 12, color: "var(--in-text)", marginBottom: 10 }}>
          → Setoran tunai ke Kas Besar: {fmtMoney(cash, cur)}
        </div>
      )}
      {dayVoids.length > 0 && (
        <div style={{ fontSize: 12, color: pendingVoids.length ? "#92400E" : "var(--ink3)", marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: pendingVoids.length ? "var(--amber-soft)" : "var(--surface2)" }}>
          🚫 {dayVoids.length} void di tanggal ini{pendingVoids.length ? ` (${pendingVoids.length} belum reviewed)` : ""}
        </div>
      )}
      {r.adminVerifyNote && (
        <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: "var(--surface2)" }}>
          Catatan verifikasi: {r.adminVerifyNote}
        </div>
      )}
      {r.revisionNote && r.status === "revision_requested" && (
        <div style={{ fontSize: 12, color: "var(--out-text)", marginBottom: 10, padding: "8px 10px", borderRadius: 8, background: "var(--out-soft)" }}>
          Menunggu kasir: {r.revisionNote}
        </div>
      )}
      <ShareWaBtn text={formatOmsetWa(r, chs)} compact style={{ width: "100%", marginBottom: 10 }} />
      {revisingId === r.id ? (
        <div style={{ marginBottom: 10 }}>
          <textarea
            value={revisionNote}
            onChange={e => setRevisionNote(e.target.value)}
            placeholder="Wajib: jelaskan selisih fisik/nota yang salah…"
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 13, resize: "vertical", background: "var(--surface)" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" onClick={() => onRevision(r.id)} disabled={busy === r.id || !revisionNote.trim()}
              style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "var(--out-text)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: revisionNote.trim() ? 1 : .5 }}>
              Kirim permintaan revisi
            </button>
            <button type="button" onClick={() => { setRevisingId(null); setRevisionNote(""); }}
              style={{ padding: "10px 14px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Batal
            </button>
          </div>
          <DeleteReportButton report={r} busy={busy} onDelete={onDelete} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {r.status === "submitted" && (
            <button disabled={busy === r.id} onClick={() => onVerify(r.id)}
              style={{ width: "100%", padding: 11, borderRadius: 12, border: "none", background: "var(--in-text)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: busy === r.id ? .6 : 1 }}>
              {busy === r.id ? "Memproses…" : "✓ Verifikasi fisik & nota"}
            </button>
          )}
          {r.status === "admin_verified" && (
            <button disabled={busy === r.id || pendingVoids.length > 0} onClick={() => onSettle(r.id)}
              style={{ width: "100%", padding: 11, borderRadius: 12, border: "none", background: pendingVoids.length ? "var(--ink3)" : "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: pendingVoids.length ? "default" : "pointer", opacity: busy === r.id ? .6 : 1 }}>
              {busy === r.id ? "Memproses…" : pendingVoids.length ? "Review void dulu" : "Settle → Kas Besar & Rekening"}
            </button>
          )}
          {(r.status === "submitted" || r.status === "admin_verified") && (
            <button type="button" disabled={busy === r.id} onClick={() => { setRevisingId(r.id); setRevisionNote(""); }}
              style={{ width: "100%", padding: 10, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--out-text)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              Minta revisi kasir
            </button>
          )}
          <DeleteReportButton report={r} busy={busy} onDelete={onDelete} />
        </div>
      )}
    </Card>
  );
}

function SettleLaporanScreen({ s, mutate, onClose }) {
  const user = s.currentUser;
  const cur = s.profile.currency;
  const awaitingVerify = reportsAwaitingVerify(s.dailyReports, s.transactions);
  const readyToSettle = reportsReadyToSettle(s.dailyReports, s.transactions);
  const awaitingRevision = reportsAwaitingRevision(s.dailyReports, s.transactions);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(null);
  const [revisingId, setRevisingId] = useState(null);
  const [revisionNote, setRevisionNote] = useState("");

  const patchReport = (reportId, report) => {
    mutate(d => {
      const i = (d.dailyReports || []).findIndex(r => r.id === reportId);
      if (i >= 0) d.dailyReports[i] = report;
    });
  };

  const doVerify = (reportId) => {
    setErr(""); setBusy(reportId);
    try {
      const updated = verifyDailyReportAdmin(s, reportId, user);
      mutate(d => {
        const i = (d.dailyReports || []).findIndex(r => r.id === reportId);
        if (i >= 0) d.dailyReports[i] = updated;
        try {
          const nmsg = createDailyReportVerifiedMessage({ report: updated, author: user });
          d.staffMessages = prependStaffMessage(d.staffMessages, nmsg, d.notificationPrefs);
        } catch { /* ignore */ }
      });
      setRevisingId(null);
      setRevisionNote("");
    } catch (e) {
      setErr(e.message || "Gagal verifikasi");
    }
    setBusy(null);
  };

  const doRevision = (reportId) => {
    setErr(""); setBusy(reportId);
    try {
      const updated = requestDailyReportRevision(s, reportId, user, revisionNote);
      const msg = createRevisionRequestMessage({ report: updated, note: revisionNote, author: user });
      mutate(d => {
        const i = (d.dailyReports || []).findIndex(r => r.id === reportId);
        if (i >= 0) d.dailyReports[i] = updated;
        d.staffMessages = prependStaffMessage(d.staffMessages, msg, d.notificationPrefs);
      });
      setRevisingId(null);
      setRevisionNote("");
    } catch (e) {
      setErr(e.message || "Gagal minta revisi");
    }
    setBusy(null);
  };

  const doSettle = (reportId) => {
    setErr(""); setBusy(reportId);
    try {
      const { report, txs } = settleDailyReport(s, reportId, user);
      mutate(d => {
        const i = (d.dailyReports || []).findIndex(r => r.id === reportId);
        if (i >= 0) d.dailyReports[i] = report;
        txs.forEach(t => d.transactions.push(t));
      });
    } catch (e) {
      setErr(e.message || "Gagal settle");
    }
    setBusy(null);
  };

  const doDelete = (report) => {
    const label = `${OUTLET_LABEL[report.outlet] || report.outlet} · ${shortDate(report.date)}`;
    const cashCount = (s.transactions || []).filter(
      t => t.type === "in" && /laporan harian/i.test(t.source || "") && t.date === report.date
        && (t.desc || "").includes(`Omset tunai ${report.outlet}`)
    ).length;
    const dupHint = cashCount > 1 ? `\n\nAkan hapus ${cashCount} transaksi omset tunai duplikat.` : "";
    if (!confirm(`Hapus laporan ${label}?${dupHint}\n\nKasir bisa kirim laporan baru dari awal. Saldo laci disesuaikan.`)) return;
    setErr(""); setBusy(report.id);
    try {
      const { report: deleted, removeIds } = deleteDailyReport(s, report.id, user);
      mutate(d => {
        d.dailyReports = (d.dailyReports || []).filter(r => r.id !== deleted.id);
        removeIds.forEach(id => applyTransactionDelete(d, id));
        d.staffMessages = cancelRevisionMessagesForReport(
          d.staffMessages, deleted.id, deleted.date, deleted.outlet
        );
      });
      setRevisingId(null);
      setRevisionNote("");
      showActionToast(`Laporan ${label} dihapus — kasir bisa kirim ulang.`, "success");
    } catch (e) {
      setErr(e.message || "Gagal hapus laporan");
    }
    setBusy(null);
  };

  const canDeleteReport = canDo(user.role, "hapusLaporanOmset");
  const cardProps = {
    s, cur, user, onVerify: doVerify, onRevision: doRevision, onSettle: doSettle,
    onDelete: canDeleteReport ? doDelete : null,
    busy, revisingId, setRevisingId, revisionNote, setRevisionNote,
  };

  return (
    <Sheet title="Settle Laporan Kasir" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 16, padding: "12px 14px", background: "var(--amber-soft)", borderRadius: 12, lineHeight: 1.5 }}>
          <b>Pagi:</b> Admin verifikasi fisik laci & nota.<br />
          <b>Siang–esok 17:00:</b> Owner/admin settle setelah cek dompet kasir.<br />
          Salah? <b>Minta revisi kasir</b> atau <b>Hapus laporan omset</b> (belum settle) — kasir bisa kirim ulang dari awal.
        </div>
        {err && <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>{err}</div>}

        {awaitingVerify.length > 0 && (
          <>
            <Lbl>Verifikasi pagi ({awaitingVerify.length})</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {awaitingVerify.map(r => <SettleReportCard key={r.id} r={r} {...cardProps} />)}
            </div>
          </>
        )}

        {readyToSettle.length > 0 && (
          <>
            <Lbl>Siap settle ({readyToSettle.length})</Lbl>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {readyToSettle.map(r => <SettleReportCard key={r.id} r={r} {...cardProps} />)}
            </div>
          </>
        )}

        {awaitingRevision.length > 0 && (
          <>
            <Lbl>Menunggu revisi kasir ({awaitingRevision.length})</Lbl>
            <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 10, lineHeight: 1.45 }}>
              Laporan ngawur atau duplikat? Owner/admin bisa <b>Hapus laporan omset</b> di kartu di bawah.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {awaitingRevision.map(r => <SettleReportCard key={r.id} r={r} {...cardProps} />)}
            </div>
          </>
        )}

        {awaitingVerify.length === 0 && readyToSettle.length === 0 && awaitingRevision.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--ink3)", padding: "32px 0" }}>Semua laporan sudah disettle.</div>
        )}
      </div>
    </Sheet>
  );
}

// ─── Setting target omset & gaji per outlet (owner/admin) ───
function OutletTargetSettingsScreen({ s, mutate, onClose }) {
  const cur = s.profile.currency;
  const [outlet, setOutlet] = useState(OUTLETS[0]);
  const [confirmReset, setConfirmReset] = useState(false);
  const cfg = getOutletConfig(s.outletConfig, outlet);
  const hintN = outlet === "KBU" ? 10 : outlet === "KSM" ? 6 : 1;
  const previewTarget = calcDailyOmsetTarget(hintN, s.outletConfig, outlet);

  const patch = (patchObj) => {
    mutate(d => {
      if (!d.outletConfig) d.outletConfig = defaultOutletConfig();
      d.outletConfig[outlet] = { ...getOutletConfig(d.outletConfig, outlet), ...patchObj };
    });
  };

  const setMoneyField = (key, raw) => {
    const n = Math.max(0, parseInt(String(raw).replace(/\D/g, ""), 10) || 0);
    patch({ [key]: n });
  };

  const resetOutlet = () => {
    mutate(d => {
      if (!d.outletConfig) d.outletConfig = {};
      d.outletConfig[outlet] = factoryOutletConfig(outlet);
    });
    setConfirmReset(false);
  };

  const moneyInput = (val, onChange) => (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
      <span style={{ padding: "0 12px", color: "var(--ink3)", fontWeight: 700 }}>Rp</span>
      <input inputMode="numeric" value={val ? new Intl.NumberFormat("id-ID").format(val) : ""}
        onChange={e => onChange(e.target.value.replace(/\D/g, ""))} placeholder="0"
        style={{ flex: 1, padding: "13px 0", background: "none", border: "none", fontSize: 16, fontWeight: 700, color: "var(--ink)", outline: "none" }} />
    </div>
  );

  return (
    <Sheet title="Target Omset & Gaji per Outlet" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 14, padding: "12px 14px", background: "var(--in-soft)", borderRadius: 12, border: "1px solid #BBF7D0" }}>
          Target harian kasir = <b>omset per orang × SDM pagi</b>. Perubahan tersimpan otomatis — berlaku untuk laporan SDM & omset berikutnya.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {OUTLETS.map(o => (
            <button key={o} onClick={() => { setOutlet(o); setConfirmReset(false); }}
              style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${outlet === o ? "var(--brand)" : "var(--line)"}`, background: outlet === o ? "var(--brand-soft)" : "var(--surface)", fontWeight: 700, fontSize: 12, color: outlet === o ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>
              {OUTLET_LABEL[o]}
            </button>
          ))}
        </div>

        <Fld label="Omset per orang / hari">
          {moneyInput(cfg.omsetPerPerson, v => setMoneyField("omsetPerPerson", v))}
        </Fld>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6, marginBottom: 16 }}>
          Patokan SDM {OUTLET_LABEL[outlet]}: {SDM_HINT[outlet]}
        </div>

        <Fld label="Gaji harian per orang (internal — rasio SDM)">
          {moneyInput(cfg.dailyWage, v => setMoneyField("dailyWage", v))}
        </Fld>
        <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 6, marginBottom: 16 }}>
          Hanya dipakai hitung rasio gaji/omset. Kasir tidak melihat angka ini.
        </div>

        <Card style={{ padding: "14px 16px", background: "var(--surface2)" }}>
          <div style={{ fontSize: 12, color: "var(--ink3)" }}>Simulasi target hari ini</div>
          <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6 }}>
            {hintN} SDM × {fmtMoney(cfg.omsetPerPerson, cur)} = <b className="money">{fmtMoney(previewTarget, cur)}</b>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 8 }}>
            Rasio jika {hintN} org @ {fmtMoney(cfg.dailyWage, cur)}/org:{" "}
            <b>{buildSdmSnapshot({ headcount: hintN, dailyWage: cfg.dailyWage, targetOmset: previewTarget, omsetPerPerson: cfg.omsetPerPerson, outlet }).ratioLabel}</b>
            {" · "}
            {buildSdmSnapshot({ headcount: hintN, dailyWage: cfg.dailyWage, targetOmset: previewTarget, omsetPerPerson: cfg.omsetPerPerson, outlet }).status.label}
          </div>
        </Card>

        {confirmReset ? (
          <Card style={{ marginTop: 14, padding: "14px 16px", background: "var(--amber-soft)", border: "1px solid #FDE68A" }}>
            <div style={{ fontSize: 13, color: "#92400E", marginBottom: 10 }}>
              Reset {OUTLET_LABEL[outlet]} ke default ({fmtMoney(DEFAULT_OMSET_PER_PERSON, cur)}/org · gaji {fmtMoney(DEFAULT_DAILY_WAGE, cur)})?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={resetOutlet} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "#D97706", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Ya, reset</button>
              <button onClick={() => setConfirmReset(false)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer" }}>Batal</button>
            </div>
          </Card>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ width: "100%", marginTop: 14, padding: 11, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}>
            Reset outlet ini ke default pabrik
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ─── Setting channel laporan (owner/admin) ─────────────────
function ReportChannelSettingsScreen({ s, mutate, onClose }) {
  const [outlet, setOutlet] = useState(OUTLETS[0]);
  const channels = getAllReportChannels(s, outlet);
  const ui = getReportUi(s, outlet);
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newGroup, setNewGroup] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const saveChannels = (next) => {
    mutate(d => {
      if (!d.reportChannels) d.reportChannels = hydrateReportChannels(null);
      d.reportChannels[outlet] = next;
    });
  };

  const saveUi = (patch) => {
    mutate(d => {
      if (!d.reportUi) d.reportUi = hydrateReportUi(null);
      d.reportUi[outlet] = { ...getReportUi(d, outlet), ...patch };
    });
  };

  const patchChannel = (id, patch) => {
    saveChannels(channels.map(c => c.id === id ? { ...c, ...patch } : c));
  };

  const toggle = (id) => {
    const ch = channels.find(c => c.id === id);
    if (!ch || ch.role === "cash") return;
    patchChannel(id, { active: ch.active === false });
  };

  const removeChannel = (id) => {
    const ch = channels.find(c => c.id === id);
    if (!ch || ch.role === "cash") return;
    saveChannels(channels.filter(c => c.id !== id));
  };

  const addChannel = () => {
    const label = newLabel.trim();
    if (!label) return;
    const ids = channels.map(c => c.id);
    const maxOrder = channels.reduce((m, c) => Math.max(m, c.order || 0), 0);
    const channel = {
      id: createChannelId(label, ids),
      label,
      icon: "📌",
      role: "channel",
      settleWallet: "w_bca",
      group: newGroup.trim() || "Lainnya",
      order: maxOrder + 1,
      active: true,
      categoryHint: "penjualan",
    };
    mutate(d => {
      if (!d.reportChannels) d.reportChannels = hydrateReportChannels(null);
      d.reportChannels = appendCustomReportChannel(d.reportChannels, channel);
    });
    setNewLabel("");
    setNewGroup("");
    setAdding(false);
  };

  const resetOutlet = () => {
    mutate(d => {
      if (!d.reportChannels) d.reportChannels = {};
      if (!d.reportUi) d.reportUi = {};
      d.reportChannels[outlet] = factoryChannelsForOutlet(outlet);
      d.reportUi[outlet] = factoryUiForOutlet(outlet);
    });
    setConfirmReset(false);
  };

  return (
    <Sheet title="Form Laporan Kasir per Outlet" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", marginBottom: 14, padding: "12px 14px", background: "var(--in-soft)", borderRadius: 12, border: "1px solid #BBF7D0" }}>
          Semua perubahan <b>tersimpan otomatis</b> di cloud — tidak perlu update aplikasi kalau mau ubah label, tambah/hapus channel, atau tampilan form kasir.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {OUTLETS.map(o => (
            <button key={o} onClick={() => { setOutlet(o); setConfirmReset(false); setAdding(false); }} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${outlet === o ? "var(--brand)" : "var(--line)"}`, background: outlet === o ? "var(--brand-soft)" : "var(--surface)", fontWeight: 700, fontSize: 12, color: outlet === o ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>
              {OUTLET_LABEL[o]}
            </button>
          ))}
        </div>

        <Card style={{ padding: "12px 14px", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, color: "var(--ink)" }}>Tampilan form kasir</div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)", marginBottom: 8 }}>
            <input type="checkbox" checked={ui.physicalCashControl !== false} onChange={e => saveUi({ physicalCashControl: e.target.checked })} />
            Tampilkan <b>Kontrol Cash Fisik</b> (kas akhir − modal)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--ink2)" }}>
            <input type="checkbox" checked={ui.showKasAwal !== false} onChange={e => saveUi({ showKasAwal: e.target.checked })} />
            Tampilkan baris <b>Kas Awal Rp 250.000</b>
          </label>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {channels.map(ch => (
            <Card key={ch.id} style={{ padding: "12px 14px", opacity: ch.active === false ? .55 : 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: ch.role === "cash" ? 0 : 8 }}>
                <button onClick={() => toggle(ch.id)} disabled={ch.role === "cash"}
                  style={{ width: 44, height: 26, borderRadius: 99, border: "none", cursor: ch.role === "cash" ? "default" : "pointer", background: ch.active !== false ? "var(--brand)" : "var(--line)", position: "relative", flexShrink: 0 }}>
                  <span style={{ position: "absolute", top: 3, left: ch.active !== false ? 22 : 3, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: ".15s" }} />
                </button>
                <input value={ch.label} onChange={e => patchChannel(ch.id, { label: e.target.value })}
                  style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontWeight: 600, background: "var(--surface)" }} />
                {ch.role === "cash" ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: "var(--in-text)", background: "var(--in-soft)", padding: "2px 8px", borderRadius: 99 }}>LACI</span>
                ) : (
                  <button onClick={() => removeChannel(ch.id)} title="Hapus channel" style={{ padding: 8, border: "none", background: "var(--out-soft)", borderRadius: 8, cursor: "pointer", color: "var(--out-text)" }}>
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              {ch.role === "channel" && (
                <>
                  <input value={ch.group || ""} onChange={e => patchChannel(ch.id, { group: e.target.value })} placeholder="Grup (mis. Online, Transfer Bank)"
                    style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 12, marginBottom: 8, background: "var(--surface)", color: "var(--ink2)" }} />
                  <select value={ch.settleWallet || "w_nf"} onChange={e => patchChannel(ch.id, { settleWallet: e.target.value })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 13 }}>
                    {SETTLE_WALLET_OPTIONS.map(w => (
                      <option key={w.id} value={w.id}>{w.label}</option>
                    ))}
                  </select>
                </>
              )}
            </Card>
          ))}
        </div>

        {adding ? (
          <Card style={{ marginTop: 14, padding: "14px 16px" }}>
            <Fld label="Nama field (label kasir)">
              <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="mis. QRIS Mandiri"
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }} />
            </Fld>
            <Fld label="Grup (opsional)">
              <input value={newGroup} onChange={e => setNewGroup(e.target.value)} placeholder="mis. Transfer Bank"
                style={{ width: "100%", padding: "11px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }} />
            </Fld>
            <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 4, lineHeight: 1.45 }}>
              Channel baru langsung muncul di form kasir <b>KBU, KSM, dan SMT</b>.
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button onClick={addChannel} style={{ flex: 1, padding: 11, borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Simpan channel</button>
              <button onClick={() => setAdding(false)} style={{ padding: "11px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer" }}>Batal</button>
            </div>
          </Card>
        ) : (
          <button onClick={() => setAdding(true)} style={{ width: "100%", marginTop: 14, padding: 12, borderRadius: 12, border: "1px dashed var(--brand)", background: "var(--brand-soft)", color: "var(--brand)", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Plus size={18} /> Tambah channel baru
          </button>
        )}

        {confirmReset ? (
          <Card style={{ marginTop: 14, padding: "14px 16px", background: "var(--amber-soft)", border: "1px solid #FDE68A" }}>
            <div style={{ fontSize: 13, color: "#92400E", marginBottom: 10 }}>Reset {OUTLET_LABEL[outlet]} ke template awal? Setting custom outlet ini akan diganti.</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={resetOutlet} style={{ flex: 1, padding: 10, borderRadius: 10, border: "none", background: "#D97706", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Ya, reset</button>
              <button onClick={() => setConfirmReset(false)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", cursor: "pointer" }}>Batal</button>
            </div>
          </Card>
        ) : (
          <button onClick={() => setConfirmReset(true)} style={{ width: "100%", marginTop: 12, padding: 11, borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink3)", fontSize: 13, cursor: "pointer" }}>
            Reset outlet ini ke template awal
          </button>
        )}
      </div>
    </Sheet>
  );
}

// ─── Inbox ─────────────────────────────────────────────────
function InboxScreen({ s, onClose, onAccept, onDismiss, onAddDraft }) {
  const [pasteText, setPasteText] = useState("");
  const items = (s.rawInbox || []).map(n => ({ ...n, ...classifyNotif(n) }));

  const submitPaste = () => {
    const draft = parsePastedNotif(pasteText);
    if (!draft) return;
    onAddDraft(draft);
    setPasteText("");
  };

  return (
    <Sheet title="Inbox" onClose={onClose}>
      <div style={{ padding: 16 }}>
        <Card style={{ padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <ClipboardPaste size={16} color="var(--brand)" />
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>Tempel notifikasi</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 10, lineHeight: 1.45 }}>
            Long-press notif ShopeePay / bank di HP → salin teks → tempel di sini. NF3 buat draf otomatis.
          </div>
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            placeholder={"Contoh:\nShopeePay\nSaldo Penjual diperbarui\nPesanan 260610NVKPB36W telah selesai\nRp 41.562"}
            rows={4}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface2)", fontSize: 13, color: "var(--ink)", outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.45 }}
          />
          <button
            type="button"
            disabled={!pasteText.trim()}
            onClick={submitPaste}
            style={{ width: "100%", marginTop: 10, padding: "11px 0", borderRadius: 10, border: "none", background: pasteText.trim() ? "var(--brand)" : "var(--ink3)", opacity: pasteText.trim() ? 1 : 0.5, color: "#fff", fontWeight: 700, fontSize: 13, cursor: pasteText.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <Plus size={15} /> Tambah draf
          </button>
        </Card>
        <div style={{ background: "var(--amber-soft)", border: "1px solid #FDE68A", borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
          <ShieldCheck size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ fontSize: 13, color: "var(--ink)" }}><b>Penyaring iklan aktif.</b> Notif promo ditandai <b>spam</b> — hanya transaksi nyata yang bisa dibukukan.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(n => {
            const legit = n.verdict === "legit";
            return (
              <Card key={n.id} style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, background: legit ? "var(--in-soft)" : "var(--surface2)", color: legit ? "var(--in-text)" : "var(--ink3)" }}>{legit ? "Transaksi nyata" : "Spam / promo"}</span>
                  <span className="money" style={{ fontSize: 17, fontWeight: 800, color: legit ? "var(--ink)" : "var(--ink3)", textDecoration: legit ? "none" : "line-through" }}>{fmtMoney(n.amount, s.profile.currency)}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: legit ? 600 : 400, color: legit ? "var(--ink)" : "var(--ink3)" }}>{n.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 3 }}>{n.body} · Notifikasi {n.src}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {legit ? (
                    <>
                      <button onClick={() => onAccept(n)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Check size={15} />Bukukan</button>
                      <button onClick={() => onDismiss(n.id)} style={{ padding: "10px 16px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, fontSize: 13, color: "var(--ink2)", cursor: "pointer" }}>Abaikan</button>
                    </>
                  ) : (
                    <button onClick={() => onDismiss(n.id)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontWeight: 600, fontSize: 13, color: "var(--ink2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}><Trash2 size={14} />Buang spam</button>
                  )}
                </div>
              </Card>
            );
          })}
          {items.length === 0 && <div style={{ textAlign: "center", padding: "40px 0", color: "var(--ink3)" }}>Inbox bersih. Tidak ada draf menunggu.</div>}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Sesuaikan Saldo (Admin / Owner) ───────────────────────
function AdjustSaldoScreen({ s, mutate, onClose, user }) {
  const cur = s.profile.currency;
  const wallets = visibleWallets(s.wallets, user);
  const [walletId, setWalletId] = useState(wallets[0]?.id || "");
  const [target, setTarget] = useState("");
  const [err, setErr] = useState("");
  const [doneBal, setDoneBal] = useState(null);

  const bal = walletId ? walletBalance(walletId, s.wallets, s.transactions) : 0;
  const targetNum = +String(target).replace(/\D/g, "") || 0;
  const preview = computeBalanceAdjustment(bal, targetNum);
  const walletName = wallets.find((w) => w.id === walletId)?.name || "Dompet";

  const apply = () => {
    setErr("");
    try {
      let result = null;
      mutate((d) => {
        const currentBal = walletBalance(walletId, d.wallets, d.transactions);
        result = applyBalanceAdjustment(d, {
          walletId,
          targetNum,
          categories: d.categories,
          date: today(),
          currentBal,
        });
      });
      if (!result) return;
      setDoneBal(result.target);
      setTarget("");
      showActionToast(
        `${walletName} disesuaikan → ${fmtMoney(result.target, cur)}`,
        "success"
      );
    } catch (e) {
      const msg = e.message || "Gagal menyesuaikan saldo";
      setErr(msg);
      showActionToast(msg, "error");
    }
  };

  const displayBal = doneBal != null ? doneBal : bal;

  return (
    <Sheet title="Sesuaikan Saldo" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.5, padding: "10px 12px", background: "var(--surface2)", borderRadius: 10 }}>
          Isi <b>uang fisik / saldo rekening sekarang</b>. Sistem buat satu transaksi koreksi — saldo Beranda & Kelola Dompet berubah <b>langsung</b> setelah Terapkan.
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink3)" }}>
            Saldo dompet = saldo awal + semua transaksi. Duplikat laporan kasir? Hapus laporan omset dulu, baru sesuaikan jika perlu.
          </div>
        </div>
        <Fld label="Dompet">
          <select value={walletId} onChange={e => { setWalletId(e.target.value); setTarget(""); setDoneBal(null); setErr(""); }}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)" }}>
            {wallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Fld>
        {walletId && (
          <>
            <Card style={{ padding: "14px 16px", border: doneBal != null ? "2px solid var(--in-text)" : undefined }}>
              <div style={{ fontSize: 12, color: "var(--ink3)" }}>
                {doneBal != null ? "Saldo setelah penyesuaian" : "Saldo sistem saat ini"}
              </div>
              <div className="money" style={{ fontSize: 22, fontWeight: 800, color: doneBal != null ? "var(--in-text)" : "var(--ink)", marginTop: 4 }}>
                {fmtMoney(displayBal, cur)}
              </div>
              {doneBal != null && (
                <div style={{ fontSize: 12, color: "var(--in-text)", marginTop: 6, fontWeight: 600 }}>
                  ✓ Tersimpan — cek kartu dompet di Beranda
                </div>
              )}
            </Card>
            <Fld label="Uang fisik / saldo rekening sekarang (Rp)">
              <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
                <span style={{ padding: "0 12px", color: "var(--ink3)", fontWeight: 700 }}>Rp</span>
                <input
                  inputMode="numeric"
                  value={target ? new Intl.NumberFormat("id-ID").format(target) : ""}
                  onChange={e => { setTarget(e.target.value.replace(/\D/g, "")); setDoneBal(null); setErr(""); }}
                  placeholder="Hitung uang di laci / cek rekening"
                  style={{ flex: 1, padding: "13px 0", background: "none", border: "none", fontSize: 16, fontWeight: 700, color: "var(--ink)", outline: "none" }}
                />
              </div>
            </Fld>
            {preview.ok && (
              <div style={{ fontSize: 13, fontWeight: 600, color: preview.delta > 0 ? "var(--in-text)" : "var(--out-text)", lineHeight: 1.45 }}>
                {preview.delta > 0 ? "Tambah" : "Kurangi"} {fmtMoney(preview.amount, cur)} via penyesuaian
                <div style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 500, marginTop: 4 }}>
                  Setelah terapkan: {fmtMoney(preview.target, cur)}
                </div>
              </div>
            )}
            {err && (
              <div style={{ padding: 10, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>
                {err}
              </div>
            )}
            <button disabled={!preview.ok} onClick={apply}
              style={{ width: "100%", padding: 14, borderRadius: 14, border: "none", background: preview.ok ? "var(--brand)" : "var(--ink3)", opacity: preview.ok ? 1 : .5, color: "#fff", fontWeight: 700, cursor: preview.ok ? "pointer" : "default" }}>
              Terapkan penyesuaian
            </button>
            {doneBal != null && (
              <button type="button" onClick={onClose}
                style={{ width: "100%", padding: 12, borderRadius: 12, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
                Selesai — kembali ke Beranda
              </button>
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

// ─── Settings & Profil ─────────────────────────────────────
function PengaturanScreen({ s, mutate, onClose, setOverlay, setTab, bizId, authUser, signOut, businesses, switchBusiness, businessDisplayName, features }) {
  const role = s.currentUser?.role || "kasir";
  const isKasir = role === "kasir";
  const isPurchasing = role === "purchasing";
  const isStaff = isKasir || isPurchasing;
  const loginEmail = authUser?.email || s.profile.email || "—";
  const setP = (k, v) => mutate(d => { d.profile[k] = v; });
  const setA = (k, v) => mutate(d => { d.automation[k] = v; });
  const [editName, setEditName] = useState(false);
  const [name, setName] = useState(s.profile.name);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [syncState, setSyncState] = useState("idle");

  const manualSync = async () => {
    if (!bizId) return;
    setSyncState("syncing");
    try {
      const { currentUser, users, ...data } = s;
      await saveAppState(bizId, data);
      setSyncState("ok");
      setTimeout(() => setSyncState("idle"), 2500);
    } catch {
      setSyncState("err");
      setTimeout(() => setSyncState("idle"), 3000);
    }
  };

  const syncSub = syncState === "syncing" ? "Menyimpan ke awan…"
    : syncState === "ok" ? "✓ Data tersimpan"
    : syncState === "err" ? "Gagal simpan — coba lagi"
    : "Paksa simpan data ke awan sekarang";

  return (
    <Sheet title="Pengaturan" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <Lbl>Profil</Lbl>
        <Card style={{ overflow: "hidden", marginBottom: 20 }}>
          {isStaff ? (
            <>
              <SRow icon={User} label="Nama staf" val={s.currentUser?.name || "—"} />
              <SRow icon={Store} label="Outlet / Peran" val={isKasir ? `${s.currentUser?.outlet || "—"} · Kasir` : ROLE_LABEL[role]} />
            </>
          ) : (
            <>
              <SRow icon={User} label="Nama bisnis" val={s.profile.name} onClick={() => setEditName(v => !v)} />
              <SRow icon={Store} label="Tipe Akun" val={s.profile.type} onClick={() => setP("type", s.profile.type === "Usaha" ? "Pribadi" : "Usaha")} />
            </>
          )}
          {canDo(role, "editSaldoDompet") && (
            <SRow icon={Wallet} label="Sesuaikan Saldo" sub="Koreksi selisih saldo dompet" onClick={() => setOverlay("adjustSaldo")} chev />
          )}
          {canDo(role, "kelolaDompet") && <SRow icon={Wallet} label="Kelola Dompet" sub="Atur dompet dan pembagian uang Anda" onClick={() => setOverlay("wallets")} chev />}
          {canDo(role, "kelolaKategoriSendiri") && <SRow icon={Filter} label="Kelola Kategori" sub={canDo(role, "kelolaKategoriSemua") ? "Semua kategori transaksi" : "Kategori untuk role Anda"} onClick={() => setOverlay("categories")} chev />}
          {features?.purchasingModule && canDo(role, "kelolaKategoriSemua") && (
            <SRow icon={Filter} label="Kategori Purchasing" sub="Kelola kategori belanja purchasing" onClick={() => setOverlay("kategoriPurchasing")} chev />
          )}
          {features?.purchasingModule && canDo(role, "kelolaKategoriSemua") && (
            <SRow icon={Tags} label="Alias Barang Purchasing" sub="Review & approve pengelompokan nama barang" onClick={() => setOverlay("purchasingAliases")} chev />
          )}
          {features?.sosmedReports && canInputSosmed(s.currentUser || {}, s.sosmedConfig) && (role !== "kasir" || isSosmedEnabled(s.sosmedConfig, s.currentUser?.outlet)) && (
            <SRow icon={Smartphone} label="Daily Report Sosmed" sub={`${sosmedDisplayName(s.currentUser?.outlet || "KBU")} · isi laporan hari ini`} onClick={() => setOverlay("sosmedHarian")} chev />
          )}
        </Card>

        {editName && !isStaff && (
          <div style={{ display: "flex", gap: 8, marginTop: -10, marginBottom: 20 }}>
            <input value={name} onChange={e => setName(e.target.value)} style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
            <button onClick={() => { setP("name", name); setEditName(false); }} style={{ padding: "0 16px", borderRadius: 12, background: "var(--brand)", color: "#fff", fontWeight: 700, border: "none", cursor: "pointer" }}>Simpan</button>
          </div>
        )}

        <Lbl>Tampilan & Format</Lbl>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
          {[["sistem", "Sistem", Smartphone], ["terang", "Terang", Sun], ["gelap", "Gelap", Moon]].map(([v, l, Ic]) => (
            <button key={v} onClick={() => setP("theme", v)} style={{ padding: "12px 0", borderRadius: 12, border: `1px solid ${s.profile.theme === v ? "var(--brand)" : "var(--line)"}`, background: s.profile.theme === v ? "var(--brand-soft)" : "var(--surface)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: s.profile.theme === v ? "var(--brand)" : "var(--ink2)" }}>
              <Ic size={18} /><span style={{ fontSize: 12, fontWeight: 600 }}>{l}</span>
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ padding: "13px 16px", borderRadius: 12, border: "1px solid var(--brand)", background: "var(--brand-soft)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: "var(--brand)" }}>Rp</span>
            <span style={{ fontWeight: 700, color: "var(--brand)" }}>Rupiah</span>
            <Check size={16} color="var(--brand)" style={{ marginLeft: "auto" }} />
          </div>
        </div>

        {isKasir && features?.kasirDaily && (
          <>
            <Lbl>Notifikasi Kasir</Lbl>
            <Card style={{ overflow: "hidden", marginBottom: 24 }}>
              <STog icon={Bell} label="Bunyi revisi laporan omset" sub="Chime + getar HP saat admin minta perbaikan laporan harian" on={s.automation?.revisionAlertSound !== false} onToggle={() => setA("revisionAlertSound", s.automation?.revisionAlertSound === false)} />
            </Card>
          </>
        )}

        {canDo(role, "kirimPengumuman") && (
          <>
            <Lbl>Notifikasi Otomatis</Lbl>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: -6, marginBottom: 10, lineHeight: 1.45 }}>
              Pilih jenis notifikasi yang NF3 kirim ke staf. Semua notifikasi aktif bisa di-tap untuk buka form terkait.
            </div>
            <Card style={{ overflow: "hidden", marginBottom: 16 }}>
              {NOTIFICATION_CATALOG.map((c) => (
                <STog
                  key={c.id}
                  icon={Bell}
                  label={c.label}
                  sub={`${c.description} · untuk ${c.recipients}`}
                  on={s.notificationPrefs?.[c.id] !== false}
                  onToggle={() => mutate(d => {
                    if (!d.notificationPrefs) d.notificationPrefs = hydrateNotificationPrefs(null);
                    d.notificationPrefs[c.id] = d.notificationPrefs[c.id] === false;
                  })}
                />
              ))}
            </Card>
            <Card style={{ padding: "14px 16px", marginBottom: 24 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", marginBottom: 10 }}>Jam pengingat harian</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Fld label="SDM pagi (mulai jam)">
                  <input type="number" min={6} max={14} value={s.notificationPrefs?.sdmReminderHour ?? 10}
                    onChange={e => mutate(d => {
                      if (!d.notificationPrefs) d.notificationPrefs = hydrateNotificationPrefs(null);
                      d.notificationPrefs.sdmReminderHour = Math.min(14, Math.max(6, +e.target.value || 10));
                    })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }} />
                </Fld>
                <Fld label="Report Sosmed (mulai jam)">
                  <input type="number" min={12} max={23} value={s.notificationPrefs?.sosmedReminderHour ?? 20}
                    onChange={e => mutate(d => {
                      if (!d.notificationPrefs) d.notificationPrefs = hydrateNotificationPrefs(null);
                      d.notificationPrefs.sosmedReminderHour = Math.min(23, Math.max(12, +e.target.value || 20));
                    })}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid var(--line)", fontSize: 14 }} />
                </Fld>
              </div>
            </Card>
          </>
        )}

        {!isStaff && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Lbl>Otomatisasi</Lbl>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--out-soft)", color: "var(--out-text)", marginBottom: 10 }}>BETA</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: -6, marginBottom: 10 }}>Salin teks notifikasi bank/e-wallet lalu tempel di Inbox. Auto-baca notif HP butuh app Android native (belum tersedia).</div>
            <Card style={{ overflow: "hidden", marginBottom: 24 }}>
              <STog icon={Bell} label="Ingatkan tempel notifikasi" sub="Preferensi: prioritaskan Inbox saat ada draf dari salinan notifikasi" on={s.automation.autoImport} onToggle={() => setA("autoImport", !s.automation.autoImport)} />
              <STog icon={Zap} label="Notifikasi browser saat draf ditambah" sub="Munculkan notifikasi singkat di perangkat (jika diizinkan)" on={s.automation.replyNotif} onToggle={() => setA("replyNotif", !s.automation.replyNotif)} />
            </Card>
          </>
        )}

        {features?.settleLaci && canDo(role, "settleLaci") && (
          <>
            <Lbl>Operasional Outlet</Lbl>
            <Card style={{ marginBottom: 24 }}>
              <SRow icon={TrendingUp} label="Target Omset per Outlet" sub="Omset/org × SDM · gaji harian rasio" onClick={() => setOverlay("outletTargets")} chev />
              <SRow icon={ClipboardList} label="Form Laporan Kasir" sub="Atur field kasir per outlet — tersimpan otomatis" onClick={() => setOverlay("reportChannels")} chev />
              <SRow icon={Banknote} label="Settle Laporan Kasir" sub="Channel non-tunai ke rekening · tunai laci ke Kas Besar" onClick={() => setOverlay("settleLaporan")} chev />
              <SRow icon={Smartphone} label="Daily Report Sosmed" sub="DM, komentar, Google review, komplain · isi harian" onClick={() => setOverlay("sosmedHarian")} chev />
              <SRow icon={Smartphone} label="Aktifkan Sosmed per Outlet" sub="KBU BURI UMAH, Kisamen, Samtaro" onClick={() => setOverlay("sosmedConfig")} chev />
            </Card>
          </>
        )}

        {canDo(role, "kelolaStaf") && (
          <>
            <Lbl>Tim & Staf</Lbl>
            <Card style={{ marginBottom: 24 }}>
              <SRow icon={Users} label="Kelola Staf" sub={canDo(role, "undangStaf") ? "Lihat anggota & undang staf baru" : "Lihat anggota tim"} onClick={() => { window.location.href = "/settings/staf"; }} chev />
            </Card>
          </>
        )}

        {canDo(role, "hubungkanWeb") && (
          <>
            <Lbl>Web Dashboard</Lbl>
            <Card style={{ marginBottom: 24 }}><SRow icon={Monitor} label="Hubungkan ke Web" sub="Buka dashboard & laporan di PC" onClick={() => setOverlay("pair")} chev /></Card>
          </>
        )}

        {!isStaff && (
          <>
            <Lbl>Lainnya</Lbl>
            <Card style={{ marginBottom: 24 }}>
              <SRow icon={ShieldCheck} label="Kebijakan Privasi" sub="Data bisnis tersimpan aman di Supabase milik Anda" onClick={() => setShowPrivacy(true)} chev />
            </Card>
          </>
        )}

        {!isStaff && (
          <>
            <Lbl>Akun & Sync</Lbl>
            <Card style={{ overflow: "hidden", marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: "1px solid var(--line)" }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)", flexShrink: 0 }}><Cloud size={17} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>Sinkronisasi Awan</div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 1 }}>{s.profile.email || "—"} · otomatis saat ada perubahan</div>
                </div>
              </div>
              <SRow icon={RefreshCw} label="Sinkronisasi Manual" sub={syncSub} onClick={syncState === "syncing" ? undefined : manualSync} chev={syncState !== "syncing"} val={syncState === "syncing" ? "…" : undefined} />
            </Card>
          </>
        )}

        {showPrivacy && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.45)", display: "grid", placeItems: "center", padding: 20 }} onClick={() => setShowPrivacy(false)}>
            <div style={{ background: "var(--surface)", borderRadius: 16, padding: 20, maxWidth: 360, width: "100%", border: "1px solid var(--line)" }} onClick={e => e.stopPropagation()}>
              <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 10 }}>Kebijakan Privasi</div>
              <div style={{ fontSize: 13, color: "var(--ink2)", lineHeight: 1.55 }}>
                Data keuangan bisnis Anda disimpan di database Supabase yang Anda kelola. NF3 tidak menjual atau membagikan data transaksi ke pihak ketiga. Akses staf dibatasi per role (kasir hanya dompet outlet-nya).
              </div>
              <button onClick={() => setShowPrivacy(false)} style={{ width: "100%", marginTop: 16, padding: 12, borderRadius: 12, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Mengerti</button>
            </div>
          </div>
        )}

        <Lbl>Akun</Lbl>
        <Card style={{ overflow: "hidden", marginBottom: 16 }}>
          <SRow
            icon={User}
            label={loginEmail}
            sub={`${ROLE_LABEL[role] || role}${s.currentUser?.outlet ? ` · ${s.currentUser.outlet}` : ""} · ${businessDisplayName || s.profile.name || "NF3"}`}
          />
        </Card>

        {(businesses?.length || 0) > 1 && (
          <>
            <Lbl>Ganti Bisnis</Lbl>
            <Card style={{ overflow: "hidden", marginBottom: 16 }}>
              {businesses.map(b => (
                <SRow
                  key={b.id}
                  icon={Store}
                  label={resolveBusinessDisplayName(b)}
                  sub={b.id === bizId
                    ? `${businessTypeLabel(b.type)} · bisnis aktif`
                    : `${businessTypeLabel(b.type)} · ${ROLE_LABEL[b.role] || b.role}${b.outlet ? ` · ${b.outlet}` : ""}`}
                  val={b.id === bizId ? "✓" : undefined}
                  valColor="var(--in-text)"
                  onClick={b.id !== bizId && switchBusiness ? () => switchBusiness(b.id) : undefined}
                  chev={b.id !== bizId && !!switchBusiness}
                />
              ))}
            </Card>
          </>
        )}

        {signOut && (
          <button
            type="button"
            onClick={() => signOut()}
            style={{
              width: "100%",
              padding: "14px 16px",
              borderRadius: 14,
              border: "1px solid #FECACA",
              background: "var(--out-soft)",
              color: "var(--out-text)",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}>
            <LogOut size={18} />
            Keluar / Ganti Akun
          </button>
        )}
        <div style={{ fontSize: 11, color: "var(--ink3)", textAlign: "center", marginTop: 10, lineHeight: 1.45 }}>
          Logout lalu login dengan akun kasir atau admin lain.
        </div>
      </div>
    </Sheet>
  );
}
function SRow({ icon: Ic, label, sub, val, valColor, onClick, chev }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: "1px solid var(--line)", background: "none", border: "none", borderBottom: "1px solid var(--line)", cursor: onClick ? "pointer" : "default", textAlign: "left" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)", flexShrink: 0 }}><Ic size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 1 }}>{sub}</div>}
      </div>
      {val && <span style={{ fontSize: 13, fontWeight: 700, color: valColor || "var(--ink2)", marginRight: 4 }}>{val}</span>}
      {chev && <ChevronRight size={16} color="var(--ink3)" />}
    </button>
  );
}
function STog({ icon: Ic, label, sub, on, onToggle }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: "1px solid var(--line)" }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--brand-soft)", display: "grid", placeItems: "center", color: "var(--brand)", flexShrink: 0 }}><Ic size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: "var(--ink)", fontSize: 14 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 1 }}>{sub}</div>}
      </div>
      <Tog on={on} onToggle={onToggle} />
    </div>
  );
}

// ─── Kelola Dompet (Admin NF3 / owner only) ────────────────
function WalletScreen({ s, mutate, onClose, user, bizId, businesses = [], features }) {
  const [edit, setEdit] = useState(null);
  const [logoBusy, setLogoBusy] = useState(false);
  const [logoErr, setLogoErr] = useState("");
  const [linkPicker, setLinkPicker] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkErr, setLinkErr] = useState("");
  const role = user?.role || "kasir";
  const isOwner = role === "owner";
  const walletSetup = s.walletSetup || createWalletSetupSeed();
  const sharedLinks = walletSetup.sharedLinks || [];
  const otherBusinesses = (businesses || []).filter((b) => b.id !== bizId && b.role === "owner");

  if (!canDo(role, "kelolaDompet")) {
    return (
      <Sheet title="Dompet" onClose={onClose}>
        <div style={{ padding: 40, textAlign: "center", color: "var(--ink3)", fontSize: 14 }}>
          Hanya Admin NF3 dan Owner yang bisa mengubah dompet dan saldo.
        </div>
      </Sheet>
    );
  }

  const save = (w) => {
    const normalized = {
      ...w,
      purchasingUse: w.purchasingUse === true || /kas\s*kecil/i.test(w.name || ""),
      sort: w.sort ?? (Math.max(0, ...s.wallets.map(x => x.sort || 0)) + 10),
      updatedAt: new Date().toISOString(),
    };
    mutate(d => {
      const i = d.wallets.findIndex(x => x.id === normalized.id);
      if (i >= 0) d.wallets[i] = normalized;
      else d.wallets.push({ ...normalized, id: normalized.id || ("w" + Date.now()) });
      d.wallets = sortWallets(d.wallets);
    });
    setEdit(null);
  };

  const moveWallet = (id, dir) => {
    mutate(d => {
      const ws = sortWallets([...d.wallets]);
      const i = ws.findIndex(w => w.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ws.length) return;
      [ws[i], ws[j]] = [ws[j], ws[i]];
      ws.forEach((w, idx) => { w.sort = (idx + 1) * 10; });
      d.wallets = ws;
    });
  };

  const sortedWallets = sortWallets(
    s.wallets.filter((w) => w.type !== "shared" && (features?.isFnB || !isFnBOnlyWallet(w)))
  );

  const ensureWalletSetup = (d) => {
    if (!d.walletSetup?.initialized) {
      d.walletSetup = { ...createWalletSetupSeed(), ...(d.walletSetup || {}), initialized: true };
    }
    return d.walletSetup;
  };

  const refreshSharedWallets = (d) => {
    d.wallets = rebuildWalletsWithShared(d.wallets, d.walletSetup);
  };

  const toggleSharedLink = (linkId) => {
    mutate((d) => {
      const setup = ensureWalletSetup(d);
      const link = (setup.sharedLinks || []).find((l) => l.id === linkId);
      if (link) link.enabled = !link.enabled;
      refreshSharedWallets(d);
    });
  };

  const removeSharedLink = (linkId) => {
    mutate((d) => {
      const setup = ensureWalletSetup(d);
      setup.sharedLinks = (setup.sharedLinks || []).filter((l) => l.id !== linkId);
      refreshSharedWallets(d);
    });
  };

  const openLinkPicker = async (biz) => {
    setLinkErr("");
    setLinkBusy(true);
    try {
      const doc = await loadAppState(biz.id);
      const wallets = filterShareableRemoteWallets(
        sortWallets((doc?.wallets || []).filter((w) => w.type !== "shared" && w.active !== false))
      );
      if (!wallets.length) {
        setLinkErr(`Tidak ada rekening bank aktif di ${biz.name || "bisnis tersebut"}. Hanya rekening yang boleh dihubungkan.`);
        return;
      }
      setLinkPicker({ biz, wallets });
    } catch (e) {
      setLinkErr(e.message || "Gagal memuat dompet bisnis lain");
    } finally {
      setLinkBusy(false);
    }
  };

  const addSharedLink = (biz, wallet) => {
    if (!isCrossBusinessShareableWallet(wallet)) {
      setLinkErr("Hanya rekening bank yang boleh dihubungkan — NF Cash, laci, dan kas tidak.");
      setLinkPicker(null);
      return;
    }
    mutate((d) => {
      const setup = ensureWalletSetup(d);
      const exists = (setup.sharedLinks || []).some(
        (l) => l.sourceBusinessId === biz.id && l.sourceWalletId === wallet.id
      );
      if (exists) return;
      setup.sharedLinks = [
        ...(setup.sharedLinks || []),
        createSharedWalletLink({
          sourceBusinessId: biz.id,
          sourceBusinessName: biz.name,
          sourceWalletId: wallet.id,
          sourceWalletName: wallet.name,
          sourceWalletType: wallet.type,
        }),
      ];
      refreshSharedWallets(d);
    });
    setLinkPicker(null);
  };

  const toggleActive = (id) => mutate(d => {
    const w = d.wallets.find(x => x.id === id);
    if (w) w.active = !w.active;
  });

  const tryDelete = (w) => {
    const bal = walletBalance(w.id, s.wallets, s.transactions);
    if (bal !== (w.floor || 0)) {
      alert(`Tidak bisa dihapus. Saldo harus sama dengan floor (Rp ${new Intl.NumberFormat("id-ID").format(w.floor || 0)}) sebelum dihapus.`);
      return;
    }
    mutate(d => { d.wallets = d.wallets.filter(x => x.id !== w.id); });
  };

  const typeLabels = { kas_fisik: "Kas Fisik", rekening: "Rekening", digital: "Digital" };
  const typeColors = { kas_fisik: "#D97706", rekening: "#1D4ED8", digital: "#7C3AED" };

  const onLogoPick = async (e) => {
    const f = e.target.files?.[0];
    if (!f || !edit) return;
    setLogoErr("");
    setLogoBusy(true);
    try {
      const logoUrl = await compressWalletLogo(f);
      setEdit(prev => ({ ...prev, logoUrl }));
    } catch (err) {
      setLogoErr(err.message || "Gagal memproses gambar");
    } finally {
      setLogoBusy(false);
      e.target.value = "";
    }
  };

  return (
    <Sheet title="Kelola Dompet" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 4, lineHeight: 1.45 }}>
          Urutan tampil di Beranda — pakai <b>↑ ↓</b> untuk mengatur posisi.
          Tombol <b>✕ / ✓</b> = tampil atau sembunyikan di Beranda (dompet tetap ada, hanya tidak muncul).
        </div>
        {sortedWallets.map((w, idx) => {
          const bal = walletBalance(w.id, s.wallets, s.transactions);
          const floorHint = walletFloorHint(bal, w.floor);
          const nearFloor = !!floorHint;
          return (
            <Card key={w.id} style={{ padding: "14px 16px", position: "relative", overflow: "hidden", opacity: w.active === false ? .5 : 1 }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 4, background: w.color }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <WalletIcon wallet={w} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, color: "var(--ink)" }}>{w.name}</span>
                    {w.outlet && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)" }}>{w.outlet}</span>}
                    {w.ownerOnly && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "var(--amber-soft)", color: "var(--amber)" }}>Owner</span>}
                    {w.purchasingUse && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: "#FEF3C7", color: "#92400E" }}>Purchasing</span>}
                    {w.type && <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 7px", borderRadius: 99, background: typeColors[w.type] + "22", color: typeColors[w.type] }}>{typeLabels[w.type]}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 2 }}>
                    Saldo: <b style={{ color: nearFloor ? "var(--out-text)" : "var(--ink)" }}>{fmtMoney(bal, "IDR")}</b>
                    {w.floor > 0 && <span style={{ color: "var(--ink3)" }}> · Floor: {fmtMoney(w.floor, "IDR")}</span>}
                    {floorHint && <span style={{ color: "var(--out-text)", fontWeight: 600 }}> ⚠ {floorHint}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, flexDirection: "column" }}>
                  <button type="button" disabled={idx === 0} onClick={() => moveWallet(w.id, -1)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: idx === 0 ? "default" : "pointer", display: "grid", placeItems: "center", color: "var(--ink2)", opacity: idx === 0 ? 0.35 : 1 }}>
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" disabled={idx === sortedWallets.length - 1} onClick={() => moveWallet(w.id, 1)}
                    style={{ width: 28, height: 28, borderRadius: 8, background: "var(--surface2)", border: "none", cursor: idx === sortedWallets.length - 1 ? "default" : "pointer", display: "grid", placeItems: "center", color: "var(--ink2)", opacity: idx === sortedWallets.length - 1 ? 0.35 : 1 }}>
                    <ChevronDown size={14} />
                  </button>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => toggleActive(w.id)} style={{ width: 32, height: 32, borderRadius: 99, background: w.active === false ? "var(--in-soft)" : "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: w.active === false ? "var(--in)" : "var(--ink3)" }}>
                    {w.active === false ? <Check size={14} /> : <X size={14} />}
                  </button>
                  <button onClick={() => setEdit({ ...w })} style={{ width: 32, height: 32, borderRadius: 99, background: "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink2)" }}><Pencil size={14} /></button>
                  <button onClick={() => tryDelete(w)} style={{ width: 32, height: 32, borderRadius: 99, background: "var(--out-soft)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--out)" }}><Trash2 size={14} /></button>
                </div>
              </div>
            </Card>
          );
        })}

        <button onClick={() => setEdit({ id: "w" + Date.now(), name: "", type: "kas_fisik", outlet: null, color: "#6366F1", opening: 0, floor: 0, active: true, ownerOnly: false, purchasingUse: false, sort: (Math.max(0, ...s.wallets.map(x => x.sort || 0)) + 10) })}
          style={{ padding: 14, borderRadius: 16, border: "2px dashed var(--line)", background: "none", color: "var(--brand)", fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Plus size={18} />Tambah dompet baru
        </button>

        {isOwner && otherBusinesses.length > 0 && (
          <div style={{ marginTop: 8, paddingTop: 16, borderTop: "1px solid var(--line)" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)", marginBottom: 6 }}>Rekening bank bersama (opsional)</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", lineHeight: 1.45, marginBottom: 12 }}>
              {SHARED_WALLET_POLICY_HINT}
            </div>
            {linkErr && <div style={{ fontSize: 12, color: "var(--out-text)", marginBottom: 8 }}>{linkErr}</div>}
            {sharedLinks.map((link) => (
              <Card key={link.id} style={{ padding: "12px 14px", marginBottom: 8, opacity: link.enabled ? 1 : 0.65 }}>
                <div style={{ display: "flex", alignItems: "center",gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>{link.sourceWalletName || link.label}</div>
                    <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>
                      Dari: {link.sourceBusinessName || "Bisnis lain"} · {link.enabled ? "Aktif di Beranda" : "Nonaktif — belum tampil"}
                    </div>
                  </div>
                  <button type="button" onClick={() => toggleSharedLink(link.id)}
                    style={{ padding: "6px 12px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: link.enabled ? "var(--surface2)" : "var(--brand-soft)", color: link.enabled ? "var(--ink2)" : "var(--brand)" }}>
                    {link.enabled ? "Matikan" : "Aktifkan"}
                  </button>
                  <button type="button" onClick={() => removeSharedLink(link.id)}
                    style={{ width: 32, height: 32, borderRadius: 99, background: "var(--out-soft)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--out)" }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            ))}
            <div style={{ display: "flex", flexWrap: "wrap",gap: 8, marginTop: 8 }}>
              {otherBusinesses.map((biz) => (
                <button key={biz.id} type="button" disabled={linkBusy} onClick={() => openLinkPicker(biz)}
                  style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 13, fontWeight: 600, color: "var(--brand)", cursor: linkBusy ? "wait" : "pointer" }}>
                  {linkBusy ? "Memuat…" : `+ Dari ${biz.name}`}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {linkPicker && (
        <div style={{ position: "absolute", inset: 0, zIndex: 35, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end" }} onClick={() => setLinkPicker(null)}>
          <div style={{ width: "100%", background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "70vh", overflowY: "auto" }} className="scroll-hide" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 17, color: "var(--ink)", marginBottom: 4 }}>Pilih rekening dari {linkPicker.biz.name}</div>
            <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 14 }}>Hanya rekening bank — kas NF, laci, dan e-wallet tidak bisa dihubungkan.</div>
            {linkPicker.wallets.map((w) => (
              <button key={w.id} type="button" onClick={() => addSharedLink(linkPicker.biz, w)}
                style={{ width: "100%", textAlign: "left", padding: "12px 14px", marginBottom: 8, borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface2)", cursor: "pointer" }}>
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>{w.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 2 }}>{w.type || "dompet"}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {edit && (
        <div style={{ position: "absolute", inset: 0, zIndex: 30, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "flex-end" }} onClick={() => setEdit(null)}>
          <div style={{ width: "100%", background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: 20, maxHeight: "80vh", overflowY: "auto" }} className="scroll-hide" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "var(--ink)", marginBottom: 16 }}>{edit.name ? `Edit: ${edit.name}` : "Dompet baru"}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Fld label="Nama">
                <input value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="cth: Laci KBU" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
              </Fld>
              <Fld label="Tipe">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {Object.entries(typeLabels).map(([v, l]) => (
                    <button key={v} onClick={() => setEdit({ ...edit, type: v })} style={{ padding: "9px 0", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${edit.type === v ? typeColors[v] : "var(--line)"}`, background: edit.type === v ? typeColors[v] + "22" : "var(--surface)", color: edit.type === v ? typeColors[v] : "var(--ink2)", cursor: "pointer" }}>{l}</button>
                  ))}
                </div>
              </Fld>
              <Fld label="Outlet (opsional)">
                <div style={{ display: "flex", gap: 6 }}>
                  {[null, "KBU", "KSM", "SMT"].map(o => (
                    <button key={o ?? "semua"} onClick={() => setEdit({ ...edit, outlet: o })} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${edit.outlet === o ? "var(--brand)" : "var(--line)"}`, background: edit.outlet === o ? "var(--brand-soft)" : "var(--surface)", color: edit.outlet === o ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>{o ?? "Semua"}</button>
                  ))}
                </div>
              </Fld>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Fld label="Saldo awal (Rp)">
                  <input inputMode="numeric" value={edit.opening ? new Intl.NumberFormat("id-ID").format(edit.opening) : ""} onChange={e => setEdit({ ...edit, opening: +e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
                  <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 6, lineHeight: 1.4 }}>
                    Saldo tampilan = saldo awal + transaksi. Untuk sesuaikan uang fisik, pakai Atur → Sesuaikan Saldo.
                  </div>
                </Fld>
                <Fld label="Floor minimum (Rp)">
                  <input inputMode="numeric" value={edit.floor ? new Intl.NumberFormat("id-ID").format(edit.floor) : ""} onChange={e => setEdit({ ...edit, floor: +e.target.value.replace(/\D/g, "") })} placeholder="0" style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
                </Fld>
              </div>
              <Fld label="Owner only (rekening bank)">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Tog on={!!edit.ownerOnly} onToggle={() => setEdit({ ...edit, ownerOnly: !edit.ownerOnly })} />
                  <span style={{ fontSize: 13, color: "var(--ink2)" }}>Hanya Owner yang bisa lihat</span>
                </div>
              </Fld>
              <Fld label="Dompet purchasing">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Tog on={!!edit.purchasingUse} onToggle={() => setEdit({ ...edit, purchasingUse: !edit.purchasingUse })} />
                  <span style={{ fontSize: 13, color: "var(--ink2)" }}>Muncul di form belanja purchasing</span>
                </div>
              </Fld>
              <Fld label="Logo dompet (opsional)">
                <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface2)" }}>
                  <WalletIcon wallet={edit} size={52} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      <label style={{
                        display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 10,
                        background: logoBusy ? "var(--line)" : "var(--brand)", color: logoBusy ? "var(--ink3)" : "#fff",
                        fontSize: 12, fontWeight: 700, cursor: logoBusy ? "wait" : "pointer",
                      }}>
                        {logoBusy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {logoBusy ? "Mengompres…" : "Upload logo"}
                        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={logoBusy}
                          style={{ display: "none" }} onChange={onLogoPick} />
                      </label>
                      {walletHasLogo(edit) && (
                        <button type="button" onClick={() => setEdit({ ...edit, logoUrl: null })}
                          style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 12, fontWeight: 600, color: "var(--out-text)", cursor: "pointer" }}>
                          Hapus logo
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8, lineHeight: 1.45 }}>
                      PNG/JPG · otomatis dikompres 128px agar loading cepat
                    </div>
                    {logoErr && <div style={{ fontSize: 11, color: "var(--out-text)", marginTop: 6 }}>{logoErr}</div>}
                  </div>
                </div>
              </Fld>
              <Fld label="Warna">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["#6366F1","#16A34A","#D97706","#0EA5E9","#8B5CF6","#EC4899","#14B8A6","#F97316","#1D4ED8","#DC2626","#CA8A04","#7C3AED"].map(c => (
                    <button key={c} onClick={() => setEdit({ ...edit, color: c })} style={{ width: 30, height: 30, borderRadius: 99, background: c, border: edit.color === c ? "3px solid var(--ink)" : "3px solid transparent", cursor: "pointer" }} />
                  ))}
                </div>
              </Fld>
            </div>
            <button disabled={!edit.name} onClick={() => save(edit)}
              style={{ width: "100%", marginTop: 16, padding: 14, borderRadius: 14, border: "none", background: edit.name ? "var(--brand)" : "var(--ink3)", opacity: edit.name ? 1 : .5, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Simpan dompet
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ─── Kelola Kategori ───────────────────────────────────────
function CatScreen({ s, mutate, onClose }) {
  const user = s.currentUser || { role: "kasir" };
  const role = user.role;
  const canManageAll = canDo(role, "kelolaKategoriSemua");
  const showInTab = canManageAll || canDo(role, "inputIncome");
  const [tab, setTab] = useState("out");
  const [name, setName] = useState("");

  const cats = s.categories.filter(c => {
    if (c.type !== tab) return false;
    if (canManageAll) return true;
    if (c.role !== role) return false;
    if (role === "kasir" && c.outlet && c.outlet !== user.outlet) return false;
    return true;
  });

  const addCat = () => {
    if (!name.trim()) return;
    mutate(d => d.categories.push({
      id: "c" + Date.now(), name: name.trim(), type: tab, active: true,
      role,
      outlet: role === "kasir" ? user.outlet : null,
    }));
    setName("");
  };
  const canEdit = (c) => canManageAll || c.role === role;
  const toggleCat = (id) => mutate(d => { const c = d.categories.find(x => x.id === id); if (c && canEdit(c)) c.active = !c.active; });
  const deleteCat = (id) => mutate(d => { const c = d.categories.find(x => x.id === id); if (c && canEdit(c)) d.categories = d.categories.filter(x => x.id !== id); });

  return (
    <Sheet title="Kelola Kategori" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        {!canManageAll && (
          <div style={{ fontSize: 12, color: "var(--ink3)", marginBottom: 12, padding: "10px 12px", background: "var(--surface2)", borderRadius: 10 }}>
            Kategori yang Anda buat hanya untuk role <b>{ROLE_LABEL[role]}</b>{user.outlet ? ` · ${user.outlet}` : ""}.
          </div>
        )}
        {showInTab ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "var(--surface2)", borderRadius: 12, padding: 4, marginBottom: 16 }}>
            {[["out", "Pengeluaran"], ["in", "Pemasukan"]].map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} style={{ padding: 10, borderRadius: 9, border: "none", cursor: "pointer", background: tab === v ? "var(--brand)" : "transparent", color: tab === v ? "#fff" : "var(--ink2)", fontWeight: 700, fontSize: 13 }}>{l}</button>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginBottom: 16 }}>Kategori Pengeluaran Belanja</div>
        )}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input value={name} onChange={e => setName(e.target.value)} onKeyDown={e => e.key === "Enter" && addCat()} placeholder="Nama kategori baru" style={{ flex: 1, padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
          <button onClick={addCat} style={{ width: 44, height: 44, borderRadius: 12, background: "var(--brand)", border: "none", color: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}><Plus size={20} /></button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {cats.map(c => {
            const Ic = getCatIcon(c);
            return (
              <Card key={c.id} style={{ padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, opacity: c.active === false ? .5 : 1 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: tab === "in" ? "var(--in-soft)" : "var(--out-soft)", display: "grid", placeItems: "center", color: tab === "in" ? "var(--in)" : "var(--out)" }}><Ic size={16} /></div>
                <span style={{ flex: 1, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                {c.role && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "var(--brand-soft)", color: "var(--brand)" }}>{ROLE_LABEL[c.role] || c.role}{c.outlet ? ` · ${c.outlet}` : ""}</span>}
                {c.active === false && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: "var(--surface2)", color: "var(--ink3)" }}>nonaktif</span>}
                {canEdit(c) && (
                  <>
                    <button onClick={() => toggleCat(c.id)} title={c.active === false ? "Aktifkan" : "Nonaktifkan"} style={{ width: 30, height: 30, borderRadius: 99, background: c.active === false ? "var(--in-soft)" : "var(--surface2)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: c.active === false ? "var(--in)" : "var(--ink3)" }}>
                      {c.active === false ? <Check size={13} /> : <X size={13} />}
                    </button>
                    <button onClick={() => deleteCat(c.id)} style={{ width: 30, height: 30, borderRadius: 99, background: "var(--out-soft)", border: "none", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--out)" }}><Trash2 size={13} /></button>
                  </>
                )}
              </Card>
            );
          })}
          {cats.length === 0 && <div style={{ textAlign: "center", color: "var(--ink3)", padding: "20px 0", fontSize: 13 }}>Belum ada kategori {tab === "in" ? "pemasukan" : "pengeluaran"}.</div>}
        </div>
      </div>
    </Sheet>
  );
}

// ─── Web Pairing ───────────────────────────────────────────
function PairScreen({ bizId, authUser, onClose }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("loading"); // loading | waiting | connected | error
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    if (!bizId || !authUser?.id) {
      setStatus("error");
      setErr("Data bisnis tidak lengkap");
      return;
    }
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/pair", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId: authUser.id, businessId: bizId }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Gagal buat kode");
        if (!alive) return;
        setCode(json.code);
        setStatus("waiting");

        pollRef.current = setInterval(async () => {
          try {
            const pr = await fetch("/api/pair", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ code: json.code }),
            });
            const pj = await pr.json();
            if (pj.approved) {
              clearInterval(pollRef.current);
              setStatus("connected");
            }
          } catch { /* ignore poll errors */ }
        }, 2000);
      } catch (e) {
        if (alive) { setErr(e.message); setStatus("error"); }
      }
    })();

    return () => { alive = false; clearInterval(pollRef.current); };
  }, [bizId, authUser?.id]);

  const pairUrl = pairPageUrl();

  return (
    <Sheet title="Hubungkan ke Web" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <Card style={{ padding: 24, textAlign: "center", marginBottom: 16, background: "var(--brand-soft)" }}>
          <Monitor size={48} color="var(--brand)" style={{ margin: "0 auto 12px" }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--brand-text)" }}>Pantau Laporan di PC</div>
          <div style={{ fontSize: 13, color: "var(--ink2)", marginTop: 6, lineHeight: 1.5 }}>
            Buka di browser PC:{" "}
            <a href={pairUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand)", fontWeight: 700, wordBreak: "break-all" }}>
              {pairUrl}
            </a>
            {" "}lalu masukkan kode di bawah.
          </div>
        </Card>

        {status === "loading" && (
          <div style={{ textAlign: "center", padding: 24, color: "var(--brand)", fontWeight: 600 }}>
            <Loader2 size={24} style={{ animation: "spin 1s linear infinite", margin: "0 auto 8px" }} />
            Membuat kode…
          </div>
        )}

        {status === "error" && (
          <div style={{ padding: 14, borderRadius: 12, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>
            {err || "Gagal membuat kode"}
          </div>
        )}

        {(status === "waiting" || status === "connected") && code && (
          <Card style={{ padding: 20, background: status === "connected" ? "#F0FDF4" : "#F0FDF4", border: `1px solid ${status === "connected" ? "#86EFAC" : "#BBF7D0"}`, marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: "var(--ink2)", marginBottom: 6 }}>
              {status === "connected" ? "✓ PC terhubung!" : "Kode untuk PC (aktif 10 menit)"}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "0.1em", color: "#16A34A" }}>{code}</span>
              <button onClick={() => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                style={{ width: 36, height: 36, borderRadius: 99, background: "none", border: "none", cursor: "pointer", color: "#16A34A" }}>
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </button>
            </div>
            {status === "waiting" && (
              <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 10 }}>
                Menunggu PC memasukkan kode…
              </div>
            )}
          </Card>
        )}
      </div>
    </Sheet>
  );
}

// ─── Pengumuman Staf ───────────────────────────────────────
function BroadcastScreen({ s, mutate, onClose, user }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("KBU");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const send = () => {
    setErr(""); setOk("");
    try {
      const msg = createStaffMessage({
        title, body,
        targetType,
        targetValue: targetType === "all" ? null : targetValue,
        author: user,
      });
      mutate(d => {
        if (!d.staffMessages) d.staffMessages = [];
        d.staffMessages.unshift(msg);
      });
      setOk("Pengumuman terkirim — staf akan melihat setelah sync awan.");
      setTitle(""); setBody("");
    } catch (e) {
      setErr(e.message || "Gagal kirim");
    }
  };

  const recent = (s.staffMessages || []).slice(0, 5);

  return (
    <Sheet title="Kirim Pengumuman" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px" }}>
        <div style={{ fontSize: 13, color: "var(--ink3)", lineHeight: 1.5, marginBottom: 14, padding: "10px 12px", background: "var(--surface2)", borderRadius: 10 }}>
          Pengumuman disimpan di awan (Supabase) bersama data bisnis. Kasir/staf melihat di ikon <b>lonceng</b> setelah muat ulang atau auto-sync.
        </div>
        <Fld label="Judul">
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="cth: Settle omset hari ini"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none" }} />
        </Fld>
        <div style={{ height: 10 }} />
        <Fld label="Isi pesan">
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Instruksi untuk kasir…"
            style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, color: "var(--ink)", outline: "none", resize: "vertical" }} />
        </Fld>
        <div style={{ height: 10 }} />
        <Fld label="Tujuan">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {[["all", "Semua staf"], ["outlet", "Per outlet"], ["role", "Per role"]].map(([v, l]) => (
              <button key={v} onClick={() => setTargetType(v)} style={{ padding: "8px 12px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${targetType === v ? "var(--brand)" : "var(--line)"}`, background: targetType === v ? "var(--brand-soft)" : "var(--surface)", color: targetType === v ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>{l}</button>
            ))}
          </div>
          {targetType === "outlet" && (
            <div style={{ display: "flex", gap: 6 }}>
              {["KBU", "KSM", "SMT"].map(o => (
                <button key={o} onClick={() => setTargetValue(o)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${targetValue === o ? "var(--brand)" : "var(--line)"}`, background: targetValue === o ? "var(--brand-soft)" : "var(--surface)", color: targetValue === o ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>{o}</button>
              ))}
            </div>
          )}
          {targetType === "role" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {["kasir", "purchasing"].map(r => (
                <button key={r} onClick={() => setTargetValue(r)} style={{ padding: "8px 14px", borderRadius: 10, fontSize: 12, fontWeight: 600, border: `1px solid ${targetValue === r ? "var(--brand)" : "var(--line)"}`, background: targetValue === r ? "var(--brand-soft)" : "var(--surface)", color: targetValue === r ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>{ROLE_LABEL[r]}</button>
              ))}
            </div>
          )}
        </Fld>
        {err && <div style={{ color: "var(--out-text)", fontSize: 13, marginTop: 10 }}>{err}</div>}
        {ok && <div style={{ color: "var(--in-text)", fontSize: 13, marginTop: 10 }}>{ok}</div>}
        <button disabled={!title.trim() || !body.trim()} onClick={send}
          style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 14, border: "none", background: title.trim() && body.trim() ? "var(--brand)" : "var(--ink3)", opacity: title.trim() && body.trim() ? 1 : .5, color: "#fff", fontWeight: 700, cursor: "pointer" }}>
          Kirim pengumuman
        </button>

        {recent.length > 0 && (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink2)", marginTop: 24, marginBottom: 10 }}>Terakhir dikirim</div>
            {recent.map(m => (
              <Card key={m.id} style={{ padding: 12, marginBottom: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 4 }}>
                  {formatMessageTime(m.createdAt)} · {m.target?.type === "all" ? "Semua" : m.target?.type === "outlet" ? m.target.value : ROLE_LABEL[m.target?.value] || m.target?.value}
                </div>
              </Card>
            ))}
          </>
        )}
      </div>
    </Sheet>
  );
}

// ─── Notif ─────────────────────────────────────────────────
function NotifScreen({ s, user, mutate, onClose, onCompose, onAction }) {
  const items = visibleStaffMessages(s.staffMessages, user);
  const canSend = canDo(user.role, "kirimPengumuman");

  const openMsg = (msg) => {
    if (user?.id) {
      mutate(d => { d.staffMessages = markStaffMessageRead(d.staffMessages, msg.id, user.id); });
    }
  };

  const runAction = (msg) => {
    openMsg(msg);
    const action = getStaffMessageAction(msg, user);
    if (action && onAction) {
      onAction(action);
      return;
    }
    if (getMessageKind(msg) !== "broadcast") {
      showActionToast("Buka menu terkait dari Beranda jika tombol tidak tersedia.", "info");
    }
  };

  return (
    <Sheet title="Pengumuman" onClose={onClose}>
      <div style={{ padding: "16px 16px 40px", display: "flex", flexDirection: "column", gap: 10 }}>
        {canSend && (
          <button onClick={onCompose} style={{ padding: 14, borderRadius: 14, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Bell size={16} /> Kirim pengumuman ke staf
          </button>
        )}
        {items.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--ink3)", fontSize: 13 }}>
            Belum ada pengumuman.{canSend ? " Gunakan tombol di atas untuk kirim instruksi ke kasir." : " Notifikasi operasional (revisi, dana masuk, pengingat sosmed, dll.) akan muncul di sini."}
          </div>
        ) : items.map(n => {
          const unread = user?.id && !(n.readBy || []).includes(user.id);
          const kind = getMessageKind(n);
          const action = getStaffMessageAction(n, user);
          const canTap = !!action && !!onAction;
          const urgent = action?.urgent;
          const kindLabel = kind !== "broadcast" ? notificationKindLabel(kind) : null;
          return (
            <Card key={n.id} role={canTap ? "button" : undefined} tabIndex={canTap ? 0 : undefined}
              style={{ padding: 16, border: urgent ? "2px solid var(--out-text)" : unread ? "1px solid var(--brand)" : undefined, background: urgent ? "var(--out-soft)" : undefined, cursor: canTap ? "pointer" : undefined }}
              onClick={() => (canTap ? runAction(n) : openMsg(n))}
              onKeyDown={(e) => { if (canTap && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); runAction(n); } }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 700, color: urgent ? "var(--out-text)" : "var(--brand)", fontSize: 14 }}>{n.title}</div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {kindLabel && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: "var(--surface2)", color: "var(--ink3)" }}>{kindLabel}</span>}
                  {(unread || urgent) && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: urgent ? "#FEE2E2" : "var(--brand-soft)", color: urgent ? "var(--out-text)" : "var(--brand)" }}>{canTap ? "Tap aksi" : unread ? "Baru" : ""}</span>}
                </div>
              </div>
              <div style={{ fontSize: 13, color: "var(--ink)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{n.body}</div>
              {canTap && action?.label && (
                <button type="button" onClick={(e) => { e.stopPropagation(); runAction(n); }}
                  style={{ width: "100%", marginTop: 12, padding: 12, borderRadius: 12, border: "none", background: urgent ? "var(--out-text)" : "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                  {action.label}
                </button>
              )}
              <div style={{ fontSize: 11, color: "var(--ink3)", marginTop: 8 }}>
                {formatMessageTime(n.createdAt)} · {n.createdBy}
                {n.target?.type === "outlet" && ` · ${n.target.value}`}
                {n.target?.type === "role" && ` · ${ROLE_LABEL[n.target.value] || n.target.value}`}
              </div>
            </Card>
          );
        })}
      </div>
    </Sheet>
  );
}

// ─── Void / Cancel / Koreksi Transaksi ─────────────────────
function VoidScreen({ s, mutate, user, reviewOnly = false }) {
  const cur = s.profile.currency;
  const isKasir = canDo(user.role, "inputVoid");
  const canReview = canDo(user.role, "reviewVoidLog");
  const logs = visibleVoidLogs(s.voidLogs, user);
  const waiting = pendingVoidLogs(s.voidLogs);
  const outletLabel = OUTLET_LABEL[user.outlet] || user.outlet;

  const [mode, setMode] = useState("cancel");
  const [date, setDate] = useState(today());
  const [txnNo, setTxnNo] = useState("");
  const [txnNoNew, setTxnNoNew] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [reason, setReason] = useState("");
  const [amount, setAmount] = useState("");
  const [voidedBy, setVoidedBy] = useState(user.name || "");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [filter, setFilter] = useState("pending");

  const resetForm = () => {
    setTxnNo(""); setTxnNoNew(""); setCustomerName(""); setReason(""); setAmount("");
    setVoidedBy(user.name || ""); setDate(today()); setErr(""); setOk("");
  };

  const submit = () => {
    setErr(""); setOk("");
    try {
      const { entry } = submitVoidLog(s, {
        type: mode,
        date,
        txnNo,
        txnNoNew: mode === "replacement" ? txnNoNew : undefined,
        customerName,
        reason,
        amount,
        voidedBy,
      }, user);
      mutate(d => {
        if (!d.voidLogs) d.voidLogs = [];
        d.voidLogs.push(entry);
        try {
          const nmsg = createVoidPendingMessage({ entry, author: user });
          d.staffMessages = prependStaffMessage(d.staffMessages, nmsg, d.notificationPrefs);
        } catch { /* ignore */ }
      });
      setOk(mode === "cancel" ? "Void cancel tercatat — Admin keuangan akan review." : "Transaksi baru tercatat — Admin keuangan akan review.");
      resetForm();
    } catch (e) {
      setErr(e.message || "Gagal menyimpan");
    }
  };

  const markReviewed = (id) => {
    try {
      const { entry, index } = reviewVoidLog(s, id, user);
      mutate(d => { d.voidLogs[index] = entry; });
    } catch (e) {
      setErr(e.message);
    }
  };

  const numInput = (val, set) => (
    <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line)", borderRadius: 12, background: "var(--surface)" }}>
      <span style={{ padding: "0 12px", color: "var(--ink3)", fontWeight: 700 }}>Rp</span>
      <input inputMode="numeric" value={val ? new Intl.NumberFormat("id-ID").format(val) : ""} onChange={e => set(e.target.value.replace(/\D/g, ""))} placeholder="0"
        style={{ flex: 1, padding: "12px 0", background: "none", border: "none", fontSize: 16, fontWeight: 700, color: "var(--ink)", outline: "none" }} />
    </div>
  );

  const filtered = logs.filter(v => {
    if (filter === "pending") return v.status === "submitted";
    if (filter === "reviewed") return v.status === "reviewed";
    return true;
  }).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div style={{ padding: reviewOnly ? "0 0 24px" : "16px 16px 90px" }}>
      {!reviewOnly && (
        <>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--ink)", marginBottom: 4 }}>Form Void</div>
      <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 16 }}>
        {isKasir
          ? `Catat cancel atau koreksi transaksi ${outletLabel} — Admin Keuangan review sebelum settle omset.`
          : "Review void dari kasir outlet — pastikan arah koreksi jelas sebelum settle omset."}
      </div>
        </>
      )}

      {canReview && waiting.length > 0 && (
        <Card style={{ marginBottom: 16, padding: "12px 14px", background: "var(--amber-soft)", border: "1px solid #FDE68A" }}>
          <div style={{ fontWeight: 800, color: "#92400E", fontSize: 14 }}>⏳ {waiting.length} void menunggu review</div>
        </Card>
      )}

      {isKasir && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[["cancel", "Void Cancel"], ["replacement", "Transaksi Baru"]].map(([m, l]) => (
              <button key={m} onClick={() => { setMode(m); setErr(""); setOk(""); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 12, border: `1px solid ${mode === m ? "var(--brand)" : "var(--line)"}`, background: mode === m ? "var(--brand-soft)" : "var(--surface)", fontWeight: 700, fontSize: 13, color: mode === m ? "var(--brand)" : "var(--ink2)", cursor: "pointer" }}>
                {l}
              </button>
            ))}
          </div>

          <Card style={{ padding: "16px 16px", marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--ink)", marginBottom: 14 }}>
              {mode === "cancel" ? "Form Void Cancel" : "Form Transaksi Baru"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Fld label="Tanggal">
                <input type="date" value={date} onChange={e => setDate(e.target.value)} max={today()}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, outline: "none" }} />
              </Fld>
              <Fld label={mode === "replacement" ? "Nomor Transaksi Lama" : "Nomor Transaksi"}>
                <input value={txnNo} onChange={e => setTxnNo(e.target.value)} placeholder="SKBU028169326110"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, outline: "none" }} />
              </Fld>
              {mode === "replacement" && (
                <Fld label="Nomor Transaksi Baru">
                  <input value={txnNoNew} onChange={e => setTxnNoNew(e.target.value)} placeholder="SKBU02202606160015"
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, outline: "none" }} />
                </Fld>
              )}
              <Fld label="Nama Kasir">
                <input value={user.name || ""} readOnly style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface2)", fontSize: 14, color: "var(--ink2)" }} />
              </Fld>
              {mode === "cancel" && (
                <Fld label="Nama Customer">
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nama pelanggan"
                    style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, outline: "none" }} />
                </Fld>
              )}
              <Fld label={mode === "cancel" ? "Alasan Cancel" : "Perubahan Yang Dilakukan"}>
                <input value={reason} onChange={e => setReason(e.target.value)} placeholder="mis. ganti cash ke qris"
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, outline: "none" }} />
              </Fld>
              <Fld label={mode === "replacement" ? "Nominal Transaksi Baru" : "Nominal Transaksi"}>
                {numInput(amount, setAmount)}
              </Fld>
              <Fld label="Orang Yang Ngevoid">
                <input value={voidedBy} onChange={e => setVoidedBy(e.target.value)}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid var(--line)", background: "var(--surface)", fontSize: 14, outline: "none" }} />
              </Fld>
            </div>
            {err && <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "var(--out-soft)", color: "var(--out-text)", fontSize: 13 }}>{err}</div>}
            {ok && <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: "var(--in-soft)", color: "var(--in-text)", fontSize: 13 }}>{ok}</div>}
            <button onClick={submit} style={{ width: "100%", marginTop: 14, padding: 14, borderRadius: 14, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
              Simpan catatan void →
            </button>
          </Card>
        </>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)" }}>Riwayat void</div>
        {canReview && (
          <div style={{ display: "flex", gap: 6 }}>
            {[["pending", "Menunggu"], ["all", "Semua"], ["reviewed", "Reviewed"]].map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding: "4px 10px", borderRadius: 99, border: `1px solid ${filter === k ? "var(--brand)" : "var(--line)"}`, background: filter === k ? "var(--brand-soft)" : "var(--surface)", fontSize: 11, fontWeight: 700, color: filter === k ? "var(--brand)" : "var(--ink3)", cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.map(v => (
          <Card key={v.id} style={{ padding: "14px 16px", borderLeft: `4px solid ${v.status === "submitted" ? "#D97706" : "var(--in-text)"}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 99, background: v.type === "cancel" ? "var(--out-soft)" : "var(--brand-soft)", color: v.type === "cancel" ? "var(--out-text)" : "var(--brand)" }}>
                  {VOID_TYPES[v.type]?.label || v.type}
                </span>
                <div style={{ fontWeight: 800, fontSize: 14, color: "var(--ink)", marginTop: 6 }}>{OUTLET_LABEL[v.outlet] || v.outlet} · {shortDate(v.date)}</div>
              </div>
              <div className="money" style={{ fontWeight: 800, color: "var(--brand)", fontSize: 15 }}>{fmtMoney(v.amount, cur)}</div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink2)", marginTop: 8, lineHeight: 1.5 }}>
              <div><b>No:</b> {v.txnNo}{v.txnNoNew ? ` → ${v.txnNoNew}` : ""}</div>
              {v.customerName && <div><b>Customer:</b> {v.customerName}</div>}
              <div><b>{v.type === "cancel" ? "Alasan" : "Perubahan"}:</b> {v.reason}</div>
              <div><b>Kasir:</b> {v.kasirName} · <b>Ngevoid:</b> {v.voidedBy}</div>
              <div style={{ color: "var(--ink3)", marginTop: 4 }}>{new Date(v.submittedAt).toLocaleString("id-ID")}</div>
            </div>
            {canReview && v.status === "submitted" && (
              <button onClick={() => markReviewed(v.id)} style={{ width: "100%", marginTop: 10, padding: 10, borderRadius: 10, border: "none", background: "var(--brand)", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                ✓ Tandai reviewed
              </button>
            )}
            <ShareWaBtn text={formatVoidWa(v)} compact style={{ width: "100%", marginTop: 10 }} />
            {v.status === "reviewed" && (
              <div style={{ fontSize: 11, color: "var(--in-text)", marginTop: 8, fontWeight: 700 }}>✓ Reviewed{v.reviewedByName ? ` · ${v.reviewedByName}` : ""}</div>
            )}
          </Card>
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--ink3)", padding: "32px 0", fontSize: 13 }}>Belum ada catatan void.</div>
        )}
      </div>
    </div>
  );
}

// ─── NavBar ────────────────────────────────────────────────
function NavBar({ tab, setTab, onMic, user, business, micTitle, shellMaxWidth = 440 }) {
  const cfg = navConfig(user, business);
  const tabIcons = { beranda: Home, laporan: BarChart3, analisis: Sparkles, asisten: MessageCircle, void: Ban, profil: User };

  const renderTab = (id, label, badge = 0) => {
    const Ic = tabIcons[id] || Home;
    return (
      <button key={id} onClick={() => setTab(id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "none", border: "none", cursor: "pointer", padding: "8px 0", position: "relative" }}>
        <Ic size={22} color={tab === id ? "var(--brand)" : "var(--ink3)"} />
        {badge > 0 && <span style={{ position: "absolute", top: 2, right: "calc(50% - 18px)", minWidth: 14, height: 14, borderRadius: 99, background: "var(--out)", color: "#fff", fontSize: 9, fontWeight: 700, display: "grid", placeItems: "center", padding: "0 2px" }}>{badge}</span>}
        <span style={{ fontSize: 11, fontWeight: tab === id ? 700 : 400, color: tab === id ? "var(--brand)" : "var(--ink3)" }}>{label}</span>
      </button>
    );
  };

  const left = cfg.left.map(([id, label]) => [id, label, 0]);
  const right = cfg.right.map((row) => [row[0], row[1], row[2] || 0]);

  const ui = getAccountUi(user, business);
  const micGrad = ui.saldoGradient || "linear-gradient(135deg,#6366F1,#4F46E5)";

  return (
    <div className="nf3-bottom-nav-wrap">
      <div className="nf3-bottom-nav" style={{ maxWidth: shellMaxWidth }}>
        <div className="nf3-bottom-nav-inner">
          {left.map(([id, label, badge]) => renderTab(id, label, badge))}
          <div style={{ width: 72, flexShrink: 0 }} />
          {right.map(([id, label, badge]) => renderTab(id, label, badge))}
          <button onClick={onMic} title={micTitle || ui.micTitle} style={{ position: "absolute", left: "50%", transform: "translateX(-50%)", top: -20, width: 60, height: 60, borderRadius: 99, background: micGrad, border: "4px solid var(--surface)", display: "grid", placeItems: "center", cursor: "pointer", boxShadow: "0 4px 16px rgba(99,102,241,.45)" }}>
            <Mic size={24} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ──────────────────────────────────────────────────
export default function NF3App(props) {
  const { bizId, authUser, members, businesses, business, signOut, switchBusiness, webMode, session } = props;
  const businessDisplayName = resolveBusinessDisplayName(business);
  const [s, setS] = useState(null);
  const [tab, setTab] = useState(webMode ? "laporan" : "beranda");
  const [overlay, setOverlay] = useState(null);
  const [catat, setCatat] = useState(false);
  const [hide, setHide] = useState(false);
  const [cloudSyncState, setCloudSyncState] = useState("idle");
  const [syncInfo, setSyncInfo] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [fnbGate, setFnbGate] = useState(null);
  const [laporanInitialDate, setLaporanInitialDate] = useState(null);
  const [laporanOpenSeq, setLaporanOpenSeq] = useState(0);
  const skipSaveRef = useRef(false);
  const allowSaveRef = useRef(false);
  const saveQueueRef = useRef(Promise.resolve());
  const sRef = useRef(null);
  const overlayRef = useRef(null);
  const catatRef = useRef(false);
  const revisionNotifiedRef = useRef(new Set());
  const openLaporanRef = useRef(null);
  const notifActionRef = useRef(null);

  useEffect(() => { sRef.current = s; }, [s]);
  useEffect(() => { overlayRef.current = overlay; }, [overlay]);
  useEffect(() => { catatRef.current = catat; }, [catat]);

  useEffect(() => { registerServiceWorker(); }, []);

  useEffect(() => {
    const unlock = () => unlockNotificationAudio();
    document.addEventListener("pointerdown", unlock, { once: true, passive: true });
    document.addEventListener("keydown", unlock, { once: true });
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, []);

  const applyMemberUsers = useCallback((doc, memberRows) => {
    if (!doc || typeof doc !== "object") return doc;
    const out = { ...doc };
    if (Array.isArray(memberRows) && memberRows.length) {
      out.users = memberRows
        .filter(m => m.profiles)
        .map(m => ({ id: m.profiles.id, name: m.profiles.name, role: m.role, outlet: m.outlet }));
    }
    delete out.currentUser;
    return out;
  }, []);

  const mergeLoadedDoc = useCallback(
    (doc) => applyMemberUsers(withReconciledReports(doc), members),
    [applyMemberUsers, members]
  );

  const reloadFromCloud = useCallback(async () => {
    if (!bizId) return;
    if (overlayRef.current || catatRef.current || isUserTypingInForm()) return;

    await saveQueueRef.current.catch(() => {});

    setCloudSyncState("syncing");
    setLoadErr(null);
    skipSaveRef.current = true;
    try {
      const cloudDoc = await loadState(bizId, { businessType: business?.type });
      const prev = sRef.current;
      let nextDoc = cloudDoc;
      if (prev) {
        const strip = (doc) => {
          const { currentUser: _cu, users: _u, _systemThemeTick: _t, _cloudUpdatedAt: _c, ...rest } = doc || {};
          return rest;
        };
        const merged = mergeAppStateData(strip(cloudDoc), strip(prev));
        nextDoc = {
          ...cloudDoc,
          ...merged,
          transactions: normalizeTransactions(merged.transactions),
          wallets: merged.wallets ?? cloudDoc.wallets,
          _cloudUpdatedAt: cloudDoc._cloudUpdatedAt,
        };
      }
      setS(mergeLoadedDoc(nextDoc));
      allowSaveRef.current = true;
      setSyncInfo(buildSyncMeta(nextDoc, prev));
      setCloudSyncState("ok");
      setTimeout(() => setCloudSyncState("idle"), 2000);
    } catch (e) {
      setLoadErr(e.message || "Gagal memuat");
      setCloudSyncState("err");
      setTimeout(() => setCloudSyncState("idle"), 2500);
    } finally {
      skipSaveRef.current = false;
    }
  }, [bizId, business?.type, mergeLoadedDoc]);

  // Muat dokumen state bisnis aktif dari Supabase + suntik identitas login nyata.
  useEffect(() => {
    if (!bizId) return;
    let alive = true;
    allowSaveRef.current = false;
    setLoadErr(null);
    setS(null);
    loadState(bizId, { businessType: business?.type })
      .then(doc => {
        if (!alive) return;
        allowSaveRef.current = true;
        setS(applyMemberUsers(withReconciledReports(doc), members));
        setSyncInfo(buildSyncMeta(doc, null));
      })
      .catch(e => {
        if (!alive) return;
        allowSaveRef.current = false;
        console.error(e);
        setLoadErr(e.message || "Gagal memuat data — data tidak disimpan agar tidak tertimpa.");
      });
    const watchdog = setTimeout(() => {
      if (!alive || allowSaveRef.current) return;
      setLoadErr("Memuat terlalu lama — cek koneksi lalu muat ulang. Data awan tidak ditimpa.");
    }, 45000);
    return () => { alive = false; clearTimeout(watchdog); };
  }, [bizId, business?.type, applyMemberUsers]);

  // Patch daftar staf tanpa muat ulang seluruh app_state (~3MB / ribuan transaksi).
  useEffect(() => {
    if (!members?.length) return;
    setS(prev => {
      if (!prev) return prev;
      return applyMemberUsers(prev, members);
    });
  }, [members, applyMemberUsers]);

  // Auto-muat ulang dari awan (jarang + skip saat form/input aktif)
  useEffect(() => {
    if (!bizId) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (overlayRef.current || catatRef.current || isUserTypingInForm()) return;
      reloadFromCloud();
    };
    const id = setInterval(tick, CLOUD_POLL_MS);
    return () => clearInterval(id);
  }, [bizId, reloadFromCloud]);

  const user = useMemo(() => sessionUser(authUser), [authUser]);
  const view = useMemo(() => withSessionUser(s, authUser), [s, authUser]);
  const features = useMemo(() => businessFeatures(business), [business]);
  const canonicalBusiness = useMemo(() => findCanonicalInList(businesses), [businesses]);

  useEffect(() => {
    setOverlay(null);
    setCatat(false);
    setFnbGate(null);
  }, [bizId]);

  useEffect(() => {
    if (!user?.role || !bizId || !canonicalBusiness) return;
    if (user.role === "purchasing" && !features.purchasingModule && canonicalBusiness.id !== bizId) {
      switchBusiness(canonicalBusiness.id);
    }
  }, [user?.role, bizId, features.purchasingModule, canonicalBusiness, switchBusiness]);

  useEffect(() => {
    if (!user?.role) return;
    if (tab === "analisis" && (!canDo(user.role, "lihatAnalisis") || !features.fnbAnalisis)) setTab("beranda");
    if (tab === "asisten" && (!showPurchasingAsistenTab(user.role) || !features.purchasingModule)) setTab("beranda");
    if (tab === "void" && (!canDo(user.role, "inputVoid") || !features.voidOutlet)) setTab("beranda");
  }, [tab, user?.role, features.fnbAnalisis, features.purchasingModule, features.voidOutlet]);

  useEffect(() => {
    if (!s || !features.isFnB || !bizId) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      setS(prev => {
        if (!prev) return prev;
        const next = mergeDailyRemindersIntoDoc(prev, today(), new Date());
        return next === prev ? prev : next;
      });
    };
    tick();
    const id = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [s?.notificationPrefs, s?.sosmedConfig, features.isFnB, bizId]);

  const openOverlay = useCallback((name) => {
    if (name === "wallets" && !canDo(user.role, "kelolaDompet")) return;
    if (name === "adjustSaldo" && !canDo(user.role, "editSaldoDompet")) return;
    if (name === "broadcast" && !canDo(user.role, "kirimPengumuman")) return;
    if (name === "voidReview" && !canDo(user.role, "reviewVoidLog")) return;
    if (!isOverlayAllowedForBusiness(name, business)) {
      setFnbGate(name);
      return;
    }
    setOverlay(name);
  }, [user.role, business]);

  const openLaporanHarian = useCallback((date = null) => {
    setLaporanInitialDate(date);
    setLaporanOpenSeq(seq => seq + 1);
    openOverlay("laporanHarian");
  }, [openOverlay]);

  const handleNotifAction = useCallback((action) => {
    if (!action?.type) return;
    switch (action.type) {
      case "laporanHarian":
        openLaporanHarian(action.date || null);
        break;
      case "sosmedHarian":
        openOverlay("sosmedHarian");
        break;
      case "sdmHarian":
        openOverlay("sdmHarian");
        break;
      case "settleLaporan":
        openOverlay("settleLaporan");
        break;
      case "voidReview":
        openOverlay("voidReview");
        break;
      case "catatBelanja":
        setTab("beranda");
        setCatat(true);
        break;
      default:
        break;
    }
  }, [openLaporanHarian, openOverlay]);

  useEffect(() => {
    openLaporanRef.current = openLaporanHarian;
  }, [openLaporanHarian]);

  useEffect(() => {
    notifActionRef.current = handleNotifAction;
  }, [handleNotifAction]);

  useEffect(() => {
    if (!s || !user?.id) return;
    const soundOn = s.automation?.revisionAlertSound !== false;
    visibleStaffMessages(s.staffMessages, user)
      .filter(m => !(m.readBy || []).includes(user.id) && isActionableStaffMessage(m, user))
      .forEach(m => {
        if (revisionNotifiedRef.current.has(m.id)) return;
        revisionNotifiedRef.current.add(m.id);
        const kind = getMessageKind(m);
        if (kind === "revision_request" && soundOn) playRevisionAlertSound();
        else if (kind === "purchasing_fund" || kind === "sosmed_reminder" || kind === "sdm_reminder") playNotificationPing();
        else if (soundOn) playNotificationPing();
        if (typeof Notification === "undefined") return;
        try {
          if (Notification.permission === "default") Notification.requestPermission();
          else if (Notification.permission === "granted") {
            const n = new Notification(m.title || "NF3", {
              body: String(m.body || "").replace(/\n+/g, " ").slice(0, 140),
              tag: "nf3-msg-" + m.id,
              silent: true,
            });
            n.onclick = () => {
              window.focus?.();
              const action = getStaffMessageAction(m, user);
              if (action) notifActionRef.current?.(action);
              n.close();
            };
          }
        } catch { /* ignore */ }
      });
  }, [s?.staffMessages, s?.automation?.revisionAlertSound, user?.id, user?.role]);

  useEffect(() => {
    if (!s || !bizId || skipSaveRef.current || !allowSaveRef.current) return;
    const { currentUser, users, _systemThemeTick, _cloudUpdatedAt, _cloudLoaded, ...data } = s;
    saveQueueRef.current = saveQueueRef.current
      .then(() => {
        if (skipSaveRef.current) return;
        return saveState(bizId, data);
      })
      .catch((e) => {
        console.error(e);
        showActionToast("Gagal simpan ke awan — coba tombol sync atau refresh", "error");
      });
  }, [s, bizId]);

  const mutate = useCallback((fn) => setS(prev => {
    if (!prev) return prev;
    const copy = JSON.parse(JSON.stringify(prev));
    const walletsBefore = JSON.stringify(prev.wallets);
    fn(copy);
    const role = authUser?.role || "kasir";
    if (!canDo(role, "kelolaDompet") && JSON.stringify(copy.wallets) !== walletsBefore) {
      copy.wallets = prev.wallets;
    }
    delete copy.currentUser;
    delete copy.users;
    return copy;
  }), [authUser?.role]);

  // Subscribe ke system dark mode jika tema = sistem
  useEffect(() => {
    if (!s || (s.profile.theme !== "sistem" && s.profile.theme !== "system")) return;
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = () => setS(prev => prev ? { ...prev, _systemThemeTick: Date.now() } : prev);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [s?.profile?.theme]);

  const addTx = (d) => {
    const role = user.role || "kasir";
    if (d.type === "transfer" && !canDo(role, "transfer")) {
      showActionToast("Transfer tidak diizinkan untuk role Anda.", "error");
      return false;
    }
    if (d.type === "in" && !canDo(role, "inputIncome")) {
      showActionToast("Pemasukan tidak diizinkan untuk role Anda.", "error");
      return false;
    }
    if (d.type === "out" && !canDo(role, "inputExpense")) {
      showActionToast("Pengeluaran tidak diizinkan untuk role Anda.", "error");
      return false;
    }
    const allowedWallets = new Set(visibleWallets(view?.wallets || [], user).map(w => w.id));
    if (d.type === "transfer") {
      if (!allowedWallets.has(d.fromWalletId) || !allowedWallets.has(d.toWalletId)) {
        showActionToast("Dompet transfer tidak tersedia untuk akun Anda.", "error");
        return false;
      }
    } else if (!d.walletId || !allowedWallets.has(d.walletId)) {
      showActionToast("Pilih dompet belanja yang tersedia (hubungi admin jika kosong).", "error");
      return false;
    }
    if (d.type === "out") {
      const floorErr = role === "purchasing"
        ? checkPurchasingFloor(d.walletId, d.amount, view?.wallets || [], view?.transactions || [], user)
        : checkFloor(d.walletId, d.amount, view?.wallets || [], view?.transactions || [], user);
      if (floorErr) {
        showActionToast(floorErr, "error");
        return false;
      }
    }
    mutate(st => st.transactions.push({
      ...d,
      id: "t" + Date.now() + Math.random().toString(36).slice(2, 5),
    }));
    showActionToast("Transaksi tersimpan.", "success");
    return true;
  };
  const acceptDraft = (n) => {
    if (!canDo(user.role, "inputIncome")) return;
    const c = classifyNotif(n);
    const inCats = visibleCategories(s.categories, user, "in");
    const cat = inCats.find(x => x.name.toLowerCase().includes("penjual")) || inCats[0];
    const myW = visibleWallets(s.wallets, user);
    const wallet = walletForNotifSrc(n.src, myW) || myW[0];
    if (!wallet || !cat) return;
    addTx({ type: "in", amount: c.amount, categoryId: cat.id, walletId: wallet.id, desc: n.title, date: today(), source: "Inbox " + n.src });
    mutate(st => { st.rawInbox = (st.rawInbox || []).filter(x => x.id !== n.id); });
  };
  const dismiss = (id) => mutate(st => { st.rawInbox = (st.rawInbox || []).filter(x => x.id !== id); });
  const addInboxDraft = (draft) => {
    mutate(st => {
      if (!st.rawInbox) st.rawInbox = [];
      st.rawInbox.unshift(draft);
    });
    if (s.automation?.replyNotif && typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const c = classifyNotif(draft);
        new Notification("Draf NF3 ditambahkan", {
          body: c.verdict === "legit" ? `${draft.title} · ${fmtMoney(c.amount, s.profile.currency)}` : `${draft.title} · ditandai spam/promo`,
          tag: "nf3-inbox-" + draft.id,
        });
      } catch { /* ignore */ }
    }
  };

  const theme = !s ? "light" : (() => {
    const t = s.profile.theme;
    if (t === "dark" || t === "gelap") return "dark";
    if (t === "light" || t === "terang") return "light";
    // sistem: ikuti preferensi HP
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  })();

  if (!s) return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#F0F0F8", padding: 20 }}>
      <div style={{ textAlign: "center" }}>
        <Loader2 size={28} color="#6366F1" style={{ animation: "spin 1s linear infinite", margin: "0 auto 12px" }} />
        <div style={{ color: "#6B7280", fontSize: 14 }}>Memuat data NF3…</div>
        <div style={{ color: "#9CA3AF", fontSize: 12, marginTop: 6, maxWidth: 280 }}>
          Mengambil data dari awan (bisa 5–15 detik jika transaksi banyak)
        </div>
        {loadErr && (
          <>
            <div style={{ color: "#B91C1C", fontSize: 13, marginTop: 12, maxWidth: 320 }}>{loadErr}</div>
            <button type="button" onClick={() => { setLoadErr(null); window.location.reload(); }} style={{ marginTop: 12, padding: "10px 16px", borderRadius: 10, border: "none", background: "#6366F1", color: "#fff", fontWeight: 700, cursor: "pointer" }}>
              Muat ulang halaman
            </button>
          </>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div data-theme={theme} className="nf3-shell">
      <style>{CSS}</style>
      <div className="nf3-shell-inner" style={{ maxWidth: webMode ? 1100 : 440 }}>
        {webMode && (
          <div style={{ background: "linear-gradient(90deg,#4338CA,#6366F1)", color: "#fff", padding: "10px 20px", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>🖥 NF3 Web Dashboard — Laporan & Export</span>
            <a href="/pair" style={{ color: "rgba(255,255,255,.85)", fontSize: 12 }}>Pair ulang</a>
          </div>
        )}
        <div className="nf3-scroll scroll-hide">
          {tab === "beranda"  && <Beranda s={view} setTab={setTab} setOverlay={openOverlay} onOpenLaporan={openLaporanHarian} hide={hide} setHide={setHide} onCloudSync={reloadFromCloud} cloudSyncState={cloudSyncState} syncInfo={syncInfo} bizId={bizId} session={session} businessDisplayName={businessDisplayName} onCatat={() => setCatat(true)} business={business} businesses={businesses} switchBusiness={switchBusiness} features={features} />}
          {tab === "laporan"  && <Laporan s={view} mutate={mutate} onOpenPair={() => openOverlay("pair")} onOpenPurchasingReport={() => openOverlay("laporanPurchasing")} business={business} features={features} />}
          {tab === "void" && features.voidOutlet && canDo(user.role, "inputVoid") && <VoidScreen s={view} mutate={mutate} user={user} />}
          {tab === "analisis" && features.fnbAnalisis && canDo(user.role, "lihatAnalisis") && <Analisis s={view} hideInsight={(id) => mutate(d => { if (!d.hiddenInsights) d.hiddenInsights = []; d.hiddenInsights.push(id); })} />}
          {tab === "asisten" && features.purchasingModule && showPurchasingAsistenTab(user.role) && <AsistenPurchasing s={view} bizId={bizId} />}
          {tab === "profil"   && <PengaturanScreen s={view} mutate={mutate} onClose={() => setTab("beranda")} setOverlay={openOverlay} bizId={bizId} authUser={authUser} signOut={signOut} businesses={businesses} switchBusiness={switchBusiness} businessDisplayName={businessDisplayName} features={features} />}
        </div>
        {!webMode && <PwaInstallBanner />}
        <NavBar tab={tab} setTab={setTab} user={user} business={business}
          shellMaxWidth={webMode ? 1100 : 440}
          onMic={() => setCatat(true)} micTitle={getAccountUi(user, business).micTitle} />

        {catat && user.role === "purchasing" && !features.purchasingModule && (
          <FnbGateSheet
            target="laporanPurchasing"
            onClose={() => setCatat(false)}
            canonicalName={canonicalBusiness?.name || CANONICAL_DISPLAY_NAME}
            onSwitch={() => {
              setCatat(false);
              if (canonicalBusiness?.id && switchBusiness) switchBusiness(canonicalBusiness.id);
            }}
          />
        )}
        {catat && user.role === "purchasing" && features.purchasingModule
          ? <PurchasingForm s={{ ...view, business: { id: bizId } }} onSave={addTx} onClose={() => setCatat(false)} />
          : catat && !(user.role === "purchasing" && !features.purchasingModule) && <CatatTransaksi s={view} bizId={bizId} onSave={addTx} onClose={() => setCatat(false)} />}
        {fnbGate && (
          <FnbGateSheet
            target={fnbGate}
            onClose={() => setFnbGate(null)}
            canonicalName={canonicalBusiness?.name || CANONICAL_DISPLAY_NAME}
            onSwitch={() => {
              setFnbGate(null);
              if (canonicalBusiness?.id && switchBusiness) switchBusiness(canonicalBusiness.id);
            }}
          />
        )}
        {overlay === "voidReview" && features.voidOutlet && canDo(user.role, "reviewVoidLog") && (
          <Sheet title="Review Void Kasir" onClose={() => setOverlay(null)}>
            <VoidScreen s={view} mutate={mutate} user={user} reviewOnly />
          </Sheet>
        )}
        {overlay === "inbox"      && canDo(user.role, "inputIncome") && <InboxScreen s={view} onClose={() => setOverlay(null)} onAccept={acceptDraft} onDismiss={dismiss} onAddDraft={addInboxDraft} />}
        {overlay === "notif"      && <NotifScreen s={view} user={user} mutate={mutate} onClose={() => setOverlay(null)} onCompose={() => setOverlay("broadcast")} onAction={handleNotifAction} />}
        {overlay === "broadcast" && canDo(user.role, "kirimPengumuman") && <BroadcastScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} user={user} />}
        {overlay === "adjustSaldo" && canDo(user.role, "editSaldoDompet") && <AdjustSaldoScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} user={user} />}
        {overlay === "wallets" && canDo(user.role, "kelolaDompet") && <WalletScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} user={user} bizId={bizId} businesses={businesses} features={features} />}
        {overlay === "categories" && <CatScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "kategoriPurchasing" && features.purchasingModule && canDo(user.role, "kelolaKategoriSemua") && (
          <KategoriPurchasing s={view} mutate={mutate} onClose={() => setOverlay(null)} />
        )}
        {overlay === "purchasingAliases" && features.purchasingModule && canDo(user.role, "kelolaKategoriSemua") && (
          <Sheet title="Alias Barang Purchasing" onClose={() => setOverlay(null)}>
            <PurchasingAliasesReview
              bizId={bizId}
              session={session}
              role={user.role}
              embedded
              onClose={() => setOverlay(null)}
            />
          </Sheet>
        )}
        {overlay === "laporanPurchasing" && features.purchasingModule && (
          <LaporanPurchasing
            s={view}
            mutate={mutate}
            canManageTx={canDo(user.role, "kelolaTransaksi")}
            onClose={() => setOverlay(null)}
          />
        )}
        {overlay === "asisten" && features.purchasingModule && canUsePurchasingAsisten(user.role) && (
          <AsistenPurchasing s={view} bizId={bizId} onClose={() => setOverlay(null)} />
        )}
        {overlay === "sosmedHarian" && features.sosmedReports && canInputSosmed(user, s?.sosmedConfig) && <SosmedHarianScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} user={user} />}
        {overlay === "sosmedConfig" && features.sosmedReports && canDo(user.role, "settleLaci") && <SosmedConfigScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "sdmHarian" && features.kasirDaily && canDo(user.role, "inputLaporanHarian") && <SdmHarianScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "laporanHarian" && features.kasirDaily && canDo(user.role, "inputLaporanHarian") && <KasirHarianScreen key={`${laporanOpenSeq}-${laporanInitialDate || "today"}`} s={view} mutate={mutate} initialDate={laporanInitialDate} onClose={() => { setLaporanInitialDate(null); setOverlay(null); }} />}
        {overlay === "settleLaporan" && features.settleLaci && canDo(user.role, "settleLaci") && <SettleLaporanScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "outletTargets" && features.settleLaci && canDo(user.role, "settleLaci") && <OutletTargetSettingsScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "reportChannels" && features.settleLaci && canDo(user.role, "settleLaci") && <ReportChannelSettingsScreen s={view} mutate={mutate} onClose={() => setOverlay(null)} />}
        {overlay === "pair"       && <PairScreen bizId={bizId} authUser={authUser} onClose={() => setOverlay(null)} />}
        {bizId && user?.role && user.role !== "purchasing" && features.isFnB && !overlay && (
          <NF3Assistant
            role={user.role === "admin" ? "keuangan" : user.role}
            outlet={user.role === "kasir" && user.outlet ? user.outlet : "semua"}
            businessId={bizId}
            sessionToken={session?.access_token}
            bottomOffset={webMode ? 24 : 88}
          />
        )}
        <ActionToast />
      </div>
    </div>
  );
}
