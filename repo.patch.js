// ============================================================
// PATCH: lib/repo.js
// Tambah mapping kolom purchasing ke addTransaction()
// ============================================================
// Cara pakai:
// 1. Buka lib/repo.js di Cursor
// 2. Temukan fungsi addTransaction() di baris 184
// 3. Ganti SELURUH fungsi addTransaction() dengan kode di bawah
// ============================================================


// SEBELUM (baris 184–204 repo.js asli):
// ---------------------------------------------------------------
// export async function addTransaction(bizId, t) {
//   const user = await getUser();
//   const { data, error } = await supabase
//     .from("transactions")
//     .insert({
//       business_id:  bizId,
//       wallet_id:    t.wallet_id    || t.walletId    || null,
//       category_id:  t.category_id  || t.categoryId  || null,
//       type:         t.type,
//       amount:       Math.round(Number(t.amount)),
//       description:  t.description  || t.desc        || null,
//       occurred_at:  t.occurred_at  || t.date        || new Date().toISOString().slice(0, 10),
//       outlet:       t.outlet       || null,
//       source:       t.source       || "manual",
//       created_by:   user?.id       || null,
//     })
//     .select()
//     .single();
//   throwIf(error, "addTransaction");
//   return data;
// }
// ---------------------------------------------------------------


// SESUDAH — ganti dengan ini:
// ---------------------------------------------------------------
export async function addTransaction(bizId, t) {
  const user = await getUser();

  const { data, error } = await supabase
    .from("transactions")
    .insert({
      // --- field lama (tidak berubah) ---
      business_id:  bizId,
      wallet_id:    t.wallet_id   || t.walletId   || null,
      category_id:  t.category_id || t.categoryId || null,
      type:         t.type,
      amount:       Math.round(Number(t.amount)),
      description:  t.description || t.desc       || null,
      occurred_at:  t.occurred_at || t.date       || new Date().toISOString().slice(0, 10),
      outlet:       t.outlet      || null,
      source:       t.source      || "manual",
      created_by:   user?.id      || null,

      // --- field baru purchasing (null-safe, tidak merusak transaksi lain) ---
      module:       t.module      || null,   // 'purchasing' | 'kasir' | null
      supplier:     t.supplier    || null,   // nama toko/pasar
      receipt_url:  t.receipt_url || t.receiptUrl || null, // foto struk
      meta:         t.meta        || null,   // JSONB: { items[], itemsTotal, nominalOverride }
    })
    .select()
    .single();

  throwIf(error, "addTransaction");
  return data;
}
// ---------------------------------------------------------------


// ============================================================
// TIDAK ADA PERUBAHAN LAIN DI repo.js
// deleteTransaction() dan fungsi lain tidak perlu diubah
// ============================================================


// ============================================================
// CARA VERIFIKASI SETELAH PATCH
// Jalankan di Supabase SQL Editor:
// ============================================================
//
// -- Cek 1 transaksi purchasing masuk dengan benar:
// select
//   id,
//   outlet,
//   source,
//   module,
//   supplier,
//   receipt_url,
//   meta,
//   amount,
//   occurred_at
// from public.transactions
// where module = 'purchasing'
// order by created_at desc
// limit 5;
//
// -- Kalau kolom belum ada, jalankan dulu purchasing_migration.sql
// ============================================================
