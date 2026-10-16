-- Fixes from the independent code review (2026-10-16).

-- 1. Storage remove/upsert need SELECT on the object. Without it the admin could upload catalog
--    images but not replace them (upsert rejected) or delete them (remove silently deleted 0 files).
create policy "catalog images: admin reads" on storage.objects
  for select to authenticated
  using (bucket_id in ('models', 'textures') and (select private.is_admin()));

-- 2. Supabase's default privileges grant everything on new public tables to the API roles.
--    Remove that, so a future table is never exposed by accident: every table must grant explicitly
--    (as 20261015120000_schema.sql does).
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
