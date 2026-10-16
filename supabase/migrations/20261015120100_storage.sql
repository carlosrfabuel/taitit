-- Storage buckets and access rules.
--   models   : product photos and zone layers (public read, admin write)
--   textures : tortoiseshell textures (public read, admin write)
--   orders   : rendered order images, path "<user_id>/<file>" (owner + admin read, owner uploads)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('models', 'models', true, 10485760, array['image/png', 'image/jpeg', 'image/webp']),
  ('textures', 'textures', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('orders', 'orders', false, 5242880, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Admin manages catalog images.
create policy "catalog images: admin inserts" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('models', 'textures') and (select public.is_admin()));
create policy "catalog images: admin updates" on storage.objects
  for update to authenticated
  using (bucket_id in ('models', 'textures') and (select public.is_admin()))
  with check (bucket_id in ('models', 'textures') and (select public.is_admin()));
create policy "catalog images: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id in ('models', 'textures') and (select public.is_admin()));

-- Order images: a user uploads into their own folder; the owner and the admin can read.
create policy "order images: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'orders' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "order images: owner or admin reads" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'orders'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin()))
  );
create policy "order images: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'orders' and (select public.is_admin()));
