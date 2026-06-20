import { existsSync, readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SCAN_PREFIX = "item-aliases-scan-";
const SCAN_SUFFIX = ".json";

export function scanOutputDir() {
  return join(process.cwd(), "scripts", "output");
}

/** @returns {{ fileName: string, filePath: string, mtimeMs: number } | null} */
export function findLatestScanFile() {
  const dir = scanOutputDir();
  if (!existsSync(dir)) return null;

  const files = readdirSync(dir)
    .filter((f) => f.startsWith(SCAN_PREFIX) && f.endsWith(SCAN_SUFFIX))
    .map((fileName) => {
      const filePath = join(dir, fileName);
      return { fileName, filePath, mtimeMs: statSync(filePath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files[0] || null;
}

export function readScanFile(fileName) {
  const filePath = join(scanOutputDir(), fileName);
  if (!existsSync(filePath)) {
    throw new Error(`File scan tidak ditemukan: ${fileName}`);
  }
  return JSON.parse(readFileSync(filePath, "utf8"));
}

export function loadLatestScanPayload() {
  const latest = findLatestScanFile();
  if (!latest) {
    throw new Error("Belum ada file scan di scripts/output/. Jalankan npm run scan:item-aliases");
  }
  const data = readScanFile(latest.fileName);
  return { ...latest, data };
}
