-- Spare part photos: admins may delete them through the Storage API, like order images ("order images:
-- admin deletes"). Opticians still can't delete a photo of a request they sent.
create policy "spare part photos: admin deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'spare-parts' and (select private.is_admin()));
