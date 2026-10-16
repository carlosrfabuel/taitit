-- Hardening found during Day 3 review.

-- 1. is_admin() was reachable as an API endpoint (/rest/v1/rpc/is_admin), flagged by the
--    Supabase security advisor. Move it to a schema the API does not expose. Policies
--    reference functions by OID, so every existing policy keeps working unchanged.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

alter function public.is_admin() set schema private;

-- 2. Sign-up failed when the provider sent a name longer than the 120-character column limit.
--    Truncate instead of rejecting the whole sign-up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 120)
  );
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
