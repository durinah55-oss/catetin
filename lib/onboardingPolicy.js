// Aturan onboarding NF3 — cegah daftar/buat bisnis sembarangan (khususnya duplikat F&B).

import { CANONICAL_BUSINESS_ID, CANONICAL_SLUG } from "./canonicalBusiness.js";

/** Produksi NF3: canonical Nusa Food sudah ada → tidak boleh buat F&B baru lewat UI. */
export function isFnbCreationBlocked() {
  return Boolean(CANONICAL_BUSINESS_ID || CANONICAL_SLUG);
}

export function isOpenSignupAllowed() {
  return process.env.NEXT_PUBLIC_ALLOW_OPEN_SIGNUP === "1";
}

/** Daftar akun baru hanya lewat link ?invite= (atau flag dev). */
export function canSignUpWithoutInvite(hasInviteToken) {
  return Boolean(hasInviteToken) || isOpenSignupAllowed();
}

export function assertBusinessTypeAllowed(type) {
  if (type === "fnb" && isFnbCreationBlocked()) {
    throw new Error(
      "Outlet NF3 (Nusa Food) sudah ada. Staf: minta link undangan dari owner — jangan buat bisnis F&B baru."
    );
  }
}

/** Preset onboarding — F&B sengaja tidak ada (hindari salah klik). */
export const OWNER_PRESETS = [
  { name: "NF Nusa Fishing", type: "ecommerce", icon: "🎣", hint: "E-commerce terpisah dari outlet F&B" },
  { name: "Toko / UMKM", type: "umkm", icon: "🏪", hint: "Bisnis lain di luar NF3 outlet" },
];

export const STAFF_ONBOARDING_MSG =
  "Staf NF3 (kasir, admin, purchasing) tidak perlu buat bisnis. Minta owner kirim link undangan, lalu login dengan email yang sama.";
