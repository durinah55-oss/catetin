// lib/appUrl.js — URL publik NF3 (undangan, reset password, pair)

const configured = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

/**
 * Origin untuk tampilan di app (pair, dll).
 * Di browser: pakai domain aktif (catatin.nusafishing.com, bukan env lama).
 */
export function getAppOrigin(fallback = "http://localhost:3001") {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin.replace(/\/$/, "");
  }
  const fromEnv = configured();
  if (fromEnv) return fromEnv;
  return fallback.replace(/\/$/, "");
}

/** Origin dari env — untuk email/link server (undangan, reset password). */
export function getConfiguredAppOrigin(fallback = "http://localhost:3001") {
  const fromEnv = configured();
  if (fromEnv) return fromEnv;
  return fallback.replace(/\/$/, "");
}

/** Origin dari header request (API server) — prioritas origin browser, lalu env. */
export function getAppOriginFromRequest(req, fallback = "http://localhost:3001") {
  const originHeader = req.headers.get("origin");
  if (originHeader) return originHeader.replace(/\/$/, "");
  const fromEnv = configured();
  if (fromEnv) return fromEnv;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`.replace(/\/$/, "");
  }
  return fallback.replace(/\/$/, "");
}

export function appPath(path, origin = getAppOrigin()) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${p}`;
}

export function pairPageUrl() {
  return appPath("/pair");
}

export function resetPasswordUrl() {
  return appPath("/reset-password", getConfiguredAppOrigin());
}

export function isLocalDevOrigin(origin = getAppOrigin()) {
  return /localhost|127\.0\.0\.1|:3000|:3001/i.test(origin || "");
}
