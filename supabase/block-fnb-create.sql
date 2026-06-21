-- Jalankan sekali di Supabase SQL Editor — cegah create_business type fnb saat Nusa Food sudah ada.
-- Setara guard di lib/onboardingPolicy.js (lapisan server).

create or replace function public.create_business(p_slug text, p_name text, p_type text)
returns public.businesses
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_biz public.businesses;
  v_type text := coalesce(p_type, 'umkm');
begin
  if v_uid is null then
    raise exception 'Harus login dulu';
  end if;

  if v_type = 'fnb' and exists (
    select 1 from public.businesses
    where slug = 'nusa-food'
       or id = 'e23ed572-234c-4995-acad-fa6bff7c58d2'::uuid
  ) then
    raise exception 'Bisnis F&B NF3 (Nusa Food) sudah ada. Staf harus pakai link undangan owner.';
  end if;

  insert into public.businesses (slug, name, type, owner_id)
  values (p_slug, p_name, v_type, v_uid)
  returning * into v_biz;

  insert into public.business_members (business_id, user_id, role)
  values (v_biz.id, v_uid, 'owner');

  insert into public.wallets (business_id, name, type, icon, color, sort)
  values
    (v_biz.id, 'Kas Laci',     'cash',    '💵', '#16A34A', 0),
    (v_biz.id, 'Bank',         'bank',    '🏦', '#2563EB', 1),
    (v_biz.id, 'QRIS / E-Wallet','ewallet','📱', '#7C3AED', 2);

  if v_type = 'fnb' then
    insert into public.categories (business_id, name, type, sort) values
      (v_biz.id, 'Penjualan',    'in', 0),
      (v_biz.id, 'Lain-lain',    'in', 1),
      (v_biz.id, 'Bahan Baku',   'out', 0),
      (v_biz.id, 'Gaji',         'out', 1),
      (v_biz.id, 'Sewa',         'out', 2),
      (v_biz.id, 'Listrik & Air','out', 3),
      (v_biz.id, 'Operasional',  'out', 4),
      (v_biz.id, 'Lain-lain',    'out', 5);
  elsif v_type = 'ecommerce' then
    insert into public.categories (business_id, name, type, sort) values
      (v_biz.id, 'Penjualan',  'in', 0),
      (v_biz.id, 'Ongkir',     'in', 1),
      (v_biz.id, 'Modal / Kulakan','out', 0),
      (v_biz.id, 'Packing',    'out', 1),
      (v_biz.id, 'Ongkir',     'out', 2),
      (v_biz.id, 'Iklan',      'out', 3),
      (v_biz.id, 'Lain-lain',  'out', 4);
  else
    insert into public.categories (business_id, name, type, sort) values
      (v_biz.id, 'Penjualan',   'in', 0),
      (v_biz.id, 'Lain-lain',   'in', 1),
      (v_biz.id, 'Modal',       'out', 0),
      (v_biz.id, 'Operasional', 'out', 1),
      (v_biz.id, 'Gaji',        'out', 2),
      (v_biz.id, 'Lain-lain',   'out', 3);
  end if;

  return v_biz;
end;
$$;
