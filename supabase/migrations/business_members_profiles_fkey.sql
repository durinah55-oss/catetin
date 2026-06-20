-- Supabase: FK agar PostgREST bisa join business_members → profiles
-- (user_id dan profiles.id sama-sama = auth.users.id)

alter table public.business_members
  drop constraint if exists business_members_user_id_profiles_fkey;

alter table public.business_members
  add constraint business_members_user_id_profiles_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;
