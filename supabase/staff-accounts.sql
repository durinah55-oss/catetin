-- ============================================================================
-- NF3 — Mapping akun staf (role + outlet)
-- Jalankan di Supabase SQL Editor SETELAH user sudah daftar lewat /login
-- ============================================================================
-- 1. sampriatna@gmail.com     → owner
-- 2. (email admin keuangan)  → admin
-- 3. nf3.crb@gmail.com        → purchasing
-- 4. kopiburiumah@gmail.com   → kasir KBU  (ganti jika beda)
-- 5. (email kasir KSM)        → kasir KSM
-- 6. (email kasir SMT)        → kasir SMT
-- ============================================================================

do $$
declare
  v_biz uuid;
  v_uid uuid;
  -- >>> GANTI email admin & kasir KSM/SMT jika sudah punya akun <<<
  v_admin_email text := 'admin.nf3@nusafishing.com';
  v_ksm_email   text := 'kasir.ksm@nusafishing.com';
  v_smt_email   text := 'kasir.smt@nusafishing.com';
begin
  select id into v_biz from public.businesses where slug = 'nf-fnb' limit 1;
  if v_biz is null then
    raise exception 'Bisnis nf-fnb belum ada. Jalankan supabase/seed.sql dulu.';
  end if;

  -- Owner
  select id into v_uid from auth.users where email = 'sampriatna@gmail.com' limit 1;
  if v_uid is not null then
    insert into public.profiles (id, name, email)
    values (v_uid, 'Sam', 'sampriatna@gmail.com')
    on conflict (id) do update set name = excluded.name;
    insert into public.business_members (business_id, user_id, role, active)
    values (v_biz, v_uid, 'owner', true)
    on conflict (business_id, user_id) do update set role = 'owner', active = true;
  end if;

  -- Admin Keuangan
  select id into v_uid from auth.users where email = v_admin_email limit 1;
  if v_uid is not null then
    insert into public.profiles (id, name, email)
    values (v_uid, 'Admin Keuangan', v_admin_email)
    on conflict (id) do update set name = excluded.name;
    insert into public.business_members (business_id, user_id, role, active)
    values (v_biz, v_uid, 'admin', true)
    on conflict (business_id, user_id) do update set role = 'admin', active = true;
  end if;

  -- Purchasing
  select id into v_uid from auth.users where email = 'nf3.crb@gmail.com' limit 1;
  if v_uid is not null then
    insert into public.profiles (id, name, email)
    values (v_uid, 'Purchasing NF3', 'nf3.crb@gmail.com')
    on conflict (id) do update set name = excluded.name;
    insert into public.business_members (business_id, user_id, role, active)
    values (v_biz, v_uid, 'purchasing', true)
    on conflict (business_id, user_id) do update set role = 'purchasing', active = true;
  end if;

  -- Kasir KBU
  select id into v_uid from auth.users where email = 'kopiburiumah@gmail.com' limit 1;
  if v_uid is not null then
    insert into public.profiles (id, name, email)
    values (v_uid, 'Kasir KBU', 'kopiburiumah@gmail.com')
    on conflict (id) do update set name = excluded.name;
    insert into public.business_members (business_id, user_id, role, outlet, active)
    values (v_biz, v_uid, 'kasir', 'KBU', true)
    on conflict (business_id, user_id) do update set role = 'kasir', outlet = 'KBU', active = true;
  end if;

  -- Kasir KSM
  select id into v_uid from auth.users where email = v_ksm_email limit 1;
  if v_uid is not null then
    insert into public.profiles (id, name, email)
    values (v_uid, 'Kasir KSM', v_ksm_email)
    on conflict (id) do update set name = excluded.name;
    insert into public.business_members (business_id, user_id, role, outlet, active)
    values (v_biz, v_uid, 'kasir', 'KSM', true)
    on conflict (business_id, user_id) do update set role = 'kasir', outlet = 'KSM', active = true;
  end if;

  -- Kasir SMT
  select id into v_uid from auth.users where email = v_smt_email limit 1;
  if v_uid is not null then
    insert into public.profiles (id, name, email)
    values (v_uid, 'Kasir SMT', v_smt_email)
    on conflict (id) do update set name = excluded.name;
    insert into public.business_members (business_id, user_id, role, outlet, active)
    values (v_biz, v_uid, 'kasir', 'SMT', true)
    on conflict (business_id, user_id) do update set role = 'kasir', outlet = 'SMT', active = true;
  end if;

  raise notice 'staff-accounts.sql selesai. User yang belum terdaftar di /login dilewati.';
end $$;
