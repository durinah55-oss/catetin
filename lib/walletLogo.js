// lib/walletLogo.js — kompres logo dompet untuk app_state (loading cepat)

const MAX_PX = 128;
const MAX_DATA_URL_LEN = 36_000; // ~26KB file setelah base64

/**
 * Kompres gambar → data URL kecil (webp/jpeg) untuk disimpan di wallet.logoUrl
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function compressWalletLogo(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("File harus berupa gambar (PNG/JPG/WebP).");
  }

  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PX / Math.max(bmp.width, bmp.height, 1));
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bmp.close?.();
    throw new Error("Browser tidak mendukung kompres gambar.");
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();

  const tryEncode = (mime, q) => {
    try {
      return canvas.toDataURL(mime, q);
    } catch {
      return null;
    }
  };

  let mime = "image/webp";
  let quality = 0.82;
  let dataUrl = tryEncode(mime, quality);
  if (!dataUrl?.startsWith("data:image/webp")) {
    mime = "image/jpeg";
    dataUrl = tryEncode(mime, quality);
  }
  if (!dataUrl) throw new Error("Gagal encode gambar.");

  while (dataUrl.length > MAX_DATA_URL_LEN && quality > 0.35) {
    quality -= 0.07;
    dataUrl = tryEncode(mime, quality);
  }

  return dataUrl;
}

/** @param {import('react').CSSProperties} [style] */
export function walletHasLogo(w) {
  return !!(w?.logoUrl && String(w.logoUrl).startsWith("data:image/"));
}
