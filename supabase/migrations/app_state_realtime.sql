-- Aktifkan Supabase Realtime untuk app_state (push ke semua HP, bukan poll 45 detik)
alter publication supabase_realtime add table public.app_state;
-- Filter business_id=eq... butuh kolom lama di WAL
alter table public.app_state replica identity full;
