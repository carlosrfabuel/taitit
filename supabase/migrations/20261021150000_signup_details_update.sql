-- Repeated sign-up (2026-10-19, found by the client): someone signs up, doesn't confirm, and signs up
-- again with the same email later. Supabase keeps the existing account, so handle_new_user (insert
-- only) never sees the second form. If the sign-up data of a not-yet-confirmed account changes, the
-- profile follows it: given values replace the old ones, missing ones are kept. Once the email is
-- confirmed, the profile is edited in the app instead and this trigger leaves it alone.
-- (The app also keeps the typed details on the phone and saves them after the first sign-in, because
-- Supabase does not always pass a repeated sign-up's data on.)

create function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if old.email_confirmed_at is not null then
    return new;
  end if;
  update public.profiles set
    full_name = coalesce(nullif(left(btrim(coalesce(meta ->> 'full_name', meta ->> 'name')), 120), ''), full_name),
    business_name = coalesce(nullif(left(btrim(meta ->> 'business_name'), 120), ''), business_name),
    legal_name = coalesce(nullif(left(btrim(meta ->> 'legal_name'), 120), ''), legal_name),
    tax_id = coalesce(nullif(left(btrim(meta ->> 'tax_id'), 20), ''), tax_id),
    phone = coalesce(nullif(left(btrim(meta ->> 'phone'), 30), ''), phone),
    address = coalesce(nullif(left(btrim(meta ->> 'address'), 200), ''), address),
    postal_code = coalesce(nullif(left(btrim(meta ->> 'postal_code'), 12), ''), postal_code),
    city = coalesce(nullif(left(btrim(meta ->> 'city'), 80), ''), city),
    province = coalesce(nullif(left(btrim(meta ->> 'province'), 80), ''), province)
  where id = new.id;
  return new;
end;
$$;
revoke execute on function public.handle_user_metadata_update() from public, anon, authenticated;

create trigger on_auth_user_metadata_changed
  after update of raw_user_meta_data on auth.users
  for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.handle_user_metadata_update();
