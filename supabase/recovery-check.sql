-- NF3 — cek & recovery app_state (jalankan di Supabase SQL Editor)
-- Bisnis utama Nusa Food:
--   e23ed572-234c-4995-acad-fa6bff7c58d2

-- 1) Snapshot sekarang — apakah data benar-benar hilang?
SELECT
  business_id,
  updated_at AT TIME ZONE 'Asia/Jakarta' AS updated_wib,
  jsonb_array_length(COALESCE(data->'transactions', '[]'::jsonb)) AS transaksi,
  jsonb_array_length(COALESCE(data->'dailyReports', '[]'::jsonb)) AS laporan_omset,
  jsonb_array_length(COALESCE(data->'sdmReports', '[]'::jsonb)) AS laporan_sdm,
  (
    SELECT COALESCE(SUM((t->>'amount')::numeric), 0)
    FROM jsonb_array_elements(COALESCE(data->'transactions', '[]'::jsonb)) AS t
    WHERE t->>'type' IN ('in', 'out')
  ) AS total_nominal_transaksi
FROM app_state
ORDER BY updated_at DESC;

-- 2) Transaksi terakhir yang masih ada (jika ada)
SELECT
  t->>'date' AS tanggal,
  t->>'outlet' AS outlet,
  t->>'type' AS tipe,
  (t->>'amount')::bigint AS nominal,
  t->>'note' AS catatan,
  t->>'createdAt' AS dibuat
FROM app_state,
  jsonb_array_elements(COALESCE(data->'transactions', '[]'::jsonb)) AS t
WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
ORDER BY COALESCE(t->>'createdAt', t->>'date', '') DESC
LIMIT 30;

-- 3) Laporan omset kemarin (21 Juni 2026)
SELECT
  r->>'date' AS tanggal,
  r->>'outlet' AS outlet,
  r->>'status' AS status,
  (r->>'total')::bigint AS total,
  r->>'submittedAt' AS dikirim
FROM app_state,
  jsonb_array_elements(COALESCE(data->'dailyReports', '[]'::jsonb)) AS r
WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  AND r->>'date' >= '2026-06-20'
ORDER BY r->>'date' DESC, r->>'outlet';

-- 4) RESTORE dari backup harian (manual — butuh export JSON dari Supabase Backups)
--    Dashboard → Database → Backups → pilih backup SEBELUM 22:00 WIB 21 Juni 2026
--    Export baris app_state untuk business_id di atas, lalu:
--
-- UPDATE app_state
-- SET data = '<paste json data column from backup>'::jsonb,
--     updated_at = now()
-- WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2';
--
-- PENTING: hentikan input staf dulu. Setelah restore, semua HP hard refresh (Ctrl+Shift+R).
