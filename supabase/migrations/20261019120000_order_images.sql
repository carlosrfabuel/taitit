-- Order images (Day 16): the app uploads one JPEG per order attempt, named after the order's
-- idempotency key: orders/<user id>/<key>.jpg. A retry reuses the same name, so it can't add files.
-- Before, any signed-in user could upload unlimited files of any name into their folder.

-- Files a user already has in the orders bucket (security definer: counts regardless of policies).
create function private.order_image_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects
  where bucket_id = 'orders' and (storage.foldername(name))[1] = uid::text;
$$;
revoke execute on function private.order_image_count(uuid) from public, anon;
grant execute on function private.order_image_count(uuid) to authenticated;

drop policy "order images: owner uploads to own folder" on storage.objects;
create policy "order images: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'orders'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    -- <user id>/<uuid>.jpg, nothing else
    and name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    -- Generous cap (an optician sending orders for years stays far below it); stops abuse.
    and private.order_image_count((select auth.uid())) < 2000
  );
