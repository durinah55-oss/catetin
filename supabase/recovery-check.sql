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

-- 4) Ringkasan transaksi per tanggal (cari sisa 21 Juni)
SELECT
  t->>'date' AS tanggal,
  t->>'outlet' AS outlet,
  t->>'type' AS tipe,
  COUNT(*) AS jumlah,
  SUM((t->>'amount')::bigint) AS total_nominal
FROM app_state,
  jsonb_array_elements(COALESCE(data->'transactions', '[]'::jsonb)) AS t
WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  AND t->>'date' >= '2026-06-19'
GROUP BY 1, 2, 3
ORDER BY 1 DESC, 2, 3;

-- 5) Semua baris app_state (cek bisnis duplikat / data di business_id lain)
SELECT business_id, updated_at AT TIME ZONE 'Asia/Jakarta' AS updated_wib,
  jsonb_array_length(COALESCE(data->'transactions', '[]'::jsonb)) AS transaksi
FROM app_state;

-- 6) Export transaksi 21 Juni (jika masih ada fragment) — copy hasil ke CSV
SELECT
  t->>'id' AS id,
  t->>'date' AS tanggal,
  t->>'outlet' AS outlet,
  t->>'type' AS tipe,
  t->>'amount' AS nominal,
  t->>'note' AS catatan,
  t->>'walletId' AS dompet,
  t->>'categoryId' AS kategori,
  t->>'createdAt' AS dibuat
FROM app_state,
  jsonb_array_elements(COALESCE(data->'transactions', '[]'::jsonb)) AS t
WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  AND t->>'date' = '2026-06-21'
ORDER BY t->>'createdAt';

-- 7) RESTORE dari backup (butuh Pro / upgrade Supabase)
--    Dashboard → Database → Backups → pilih backup SEBELUM 22:00 WIB 21 Juni 2026
--    Atau PITR ke 2026-06-21 21:30:00+07
--
-- UPDATE app_state
-- SET data = '<paste json data column from backup>'::jsonb,
--     updated_at = now()
-- WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2';
--
-- 8) Transfer/pemasukan ke Kas Kecil (purchasing harus lihat ini)
SELECT
  t->>'id' AS id,
  t->>'date' AS tanggal,
  t->>'type' AS tipe,
  (t->>'amount')::bigint AS nominal,
  t->>'walletId' AS dompet,
  t->>'fromWalletId' AS dari,
  t->>'toWalletId' AS ke,
  t->>'desc' AS catatan,
  t->>'source' AS sumber
FROM app_state,
  jsonb_array_elements(COALESCE(data->'transactions', '[]'::jsonb)) AS t
WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  AND (
    t->>'walletId' = 'w_kas_kecil'
    OR t->>'toWalletId' = 'w_kas_kecil'
  )
  AND t->>'date' >= '2026-06-20'
ORDER BY t->>'date' DESC, t->>'createdAt' DESC;

-- 9) Cari transaksi ~600rb (21–22 Juni)
SELECT
  t->>'date' AS tanggal,
  t->>'type' AS tipe,
  (t->>'amount')::bigint AS nominal,
  t->>'walletId' AS dompet,
  t->>'fromWalletId' AS dari,
  t->>'toWalletId' AS ke,
  t->>'desc' AS catatan
FROM app_state,
  jsonb_array_elements(COALESCE(data->'transactions', '[]'::jsonb)) AS t
WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
  AND (t->>'amount')::bigint BETWEEN 590000 AND 610000
  AND t->>'date' >= '2026-06-20'
ORDER BY t->>'date' DESC;

-- 10) ID transaksi duplikat (penyebab saldo purchasing salah)
SELECT
  t->>'id' AS id,
  COUNT(*) AS jumlah,
  array_agg((t->>'amount')::bigint ORDER BY (t->>'amount')::bigint DESC) AS nominal_semua,
  array_agg(t->>'type') AS tipe
FROM app_state,
  jsonb_array_elements(COALESCE(data->'transactions', '[]'::jsonb)) AS t
WHERE business_id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'
GROUP BY 1
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 30;

-- 11) Audit bisnis duplikat F&B + anggota (jalankan rutin setelah insiden)
SELECT b.id, b.slug, b.name, b.type, b.created_at AT TIME ZONE 'Asia/Jakarta' AS dibuat_wib,
  (SELECT COUNT(*) FROM business_members m WHERE m.business_id = b.id AND m.active) AS anggota_aktif,
  (SELECT jsonb_array_length(COALESCE(s.data->'transactions', '[]'::jsonb))
   FROM app_state s WHERE s.business_id = b.id) AS transaksi
FROM businesses b
WHERE b.type = 'fnb'
ORDER BY transaksi DESC NULLS LAST, dibuat_wib;

-- 12) Anggota per bisnis F&B (pastikan staf hanya di Nusa Food canonical)
SELECT b.slug, b.name, m.role, m.outlet, p.email, m.active
FROM business_members m
JOIN businesses b ON b.id = m.business_id
LEFT JOIN profiles p ON p.id = m.user_id
WHERE b.type = 'fnb'
ORDER BY b.slug, m.role, p.email;

-- 13) Recovery: paksa revisi laporan kasir (ganti id laporan & catatan)
-- UPDATE app_state SET data = ...  (lebih aman: node scripts/fixKbuRevision21.mjs)
