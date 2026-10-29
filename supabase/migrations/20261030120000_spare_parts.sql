-- Spare parts (Carlos, 2026-10-28, approved extension): an optician picks a model, then "Front side" or
-- "Temple" (left, right or both), adds exactly 3 photos of the problem (from different angles) and an
-- optional note, and sends it. No status: the warehouse or the area's sales rep contacts the optician.
-- Like orders, a request keeps a copy of the optician's details (it stays after an account deletion,
-- user cleared) and is created only through one function, which checks everything first.

create type public.spare_part as enum ('front', 'temple');
create type public.temple_side as enum ('left', 'right', 'both');

-- A short number to refer to a request (the panel, the email).
create sequence public.spare_part_number_seq start 1;

create table public.spare_part_requests (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique default nextval('public.spare_part_number_seq'),
  user_id uuid references public.profiles (id) on delete set null,
  idempotency_key uuid not null,
  model_id uuid references public.models (id) on delete set null,
  model_name text not null,
  part public.spare_part not null,
  side public.temple_side,
  note text check (note is null or char_length(note) between 1 and 500),
  -- <user id>/<photo key>.jpg in the spare-parts bucket, exactly 3, all different.
  photo_paths text[] not null check (cardinality(photo_paths) = 3),
  customer_name text,
  customer_email text,
  business_name text,
  legal_name text,
  tax_id text,
  phone text,
  contact_email text,
  address text,
  postal_code text,
  city text,
  province text,
  delivery_address text,
  delivery_postal_code text,
  delivery_city text,
  delivery_province text,
  created_at timestamptz not null default now(),
  -- A temple has a side; the front has none.
  constraint spare_part_side check ((part = 'temple') = (side is not null)),
  constraint spare_part_key unique (user_id, idempotency_key)
);

create index spare_part_requests_user_idx on public.spare_part_requests (user_id, created_at desc);
create index spare_part_requests_created_idx on public.spare_part_requests (created_at desc);

alter table public.spare_part_requests enable row level security;

-- Opticians read their own requests, admins all. Nobody writes directly (the function below does).
create policy "spare parts: owner or admin reads" on public.spare_part_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

revoke all on public.spare_part_requests from anon, authenticated;
grant select on public.spare_part_requests to authenticated;
revoke all on sequence public.spare_part_number_seq from anon, authenticated;

-- Photos: private bucket, JPEG only (the app converts every photo), 5 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('spare-parts', 'spare-parts', false, 5242880, array['image/jpeg']);

-- Files a user already has in the spare-parts bucket (security definer: counts regardless of policies).
create function private.spare_part_photo_count(uid uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from storage.objects
  where bucket_id = 'spare-parts' and (storage.foldername(name))[1] = uid::text;
$$;
revoke execute on function private.spare_part_photo_count(uuid) from public, anon;
grant execute on function private.spare_part_photo_count(uuid) to authenticated;

-- Upload: approved accounts, into their own folder, <user id>/<uuid>.jpg only, with a generous cap.
create policy "spare part photos: approved owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'spare-parts'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    and private.can_order((select auth.uid()))
    and private.spare_part_photo_count((select auth.uid())) < 1500
  );

create policy "spare part photos: owner reads own folder" on storage.objects
  for select to authenticated
  using (bucket_id = 'spare-parts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "spare part photos: admin reads all" on storage.objects
  for select to authenticated
  using (bucket_id = 'spare-parts' and (select private.is_admin()));

-- Send a request. A retry with the same key returns the request already made (nothing new).
create function public.create_spare_part_request(
  p_key uuid,
  p_model_id uuid,
  p_part public.spare_part,
  p_side public.temple_side,
  p_photo_keys uuid[],
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.spare_part_requests;
  prof public.profiles;
  m public.models;
  k uuid;
  photo text;
  photos text[] := '{}';
  note text := nullif(btrim(coalesce(p_note, '')), '');
  same_delivery boolean;
  created public.spare_part_requests;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;
  if p_key is null then
    raise exception 'spare_part_invalid' using errcode = 'check_violation';
  end if;

  -- One call at a time per attempt (same user + key): the second waits, then finds the request.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':spare:' || p_key::text, 0));

  select * into existing from public.spare_part_requests where user_id = uid and idempotency_key = p_key;
  if found then
    return jsonb_build_object('id', existing.id, 'number', existing.number, 'created', false);
  end if;

  if not private.can_order(uid) then
    raise exception 'account_not_approved' using errcode = 'insufficient_privilege';
  end if;

  select * into m from public.models where id = p_model_id and published;
  if m.id is null then
    raise exception 'spare_part_model_unavailable' using errcode = 'check_violation';
  end if;

  if p_part is null or (p_part = 'temple') <> (p_side is not null) then
    raise exception 'spare_part_invalid' using errcode = 'check_violation';
  end if;

  if note is not null and char_length(note) > 500 then
    raise exception 'spare_part_note_too_long' using errcode = 'check_violation';
  end if;

  -- Exactly 3 different photos, each already uploaded to this user's folder.
  if p_photo_keys is null or cardinality(p_photo_keys) <> 3 then
    raise exception 'spare_part_photos_missing' using errcode = 'check_violation';
  end if;
  foreach k in array p_photo_keys loop
    if k is null then
      raise exception 'spare_part_photos_missing' using errcode = 'check_violation';
    end if;
    photo := uid::text || '/' || k::text || '.jpg';
    if photo = any (photos)
       or not exists (select 1 from storage.objects where bucket_id = 'spare-parts' and name = photo) then
      raise exception 'spare_part_photos_missing' using errcode = 'check_violation';
    end if;
    photos := photos || photo;
  end loop;

  select * into prof from public.profiles where id = uid;
  if not private.business_complete(prof) then
    raise exception 'business_details_missing' using errcode = 'check_violation';
  end if;
  same_delivery := prof.delivery_address is null;

  insert into public.spare_part_requests (
    user_id, idempotency_key, model_id, model_name, part, side, note, photo_paths,
    customer_name, customer_email, business_name, legal_name, tax_id, phone, contact_email,
    address, postal_code, city, province,
    delivery_address, delivery_postal_code, delivery_city, delivery_province)
  values (
    uid, p_key, m.id, m.name, p_part, p_side, note, photos,
    prof.full_name, prof.email, prof.business_name, coalesce(nullif(btrim(prof.legal_name), ''), prof.business_name),
    prof.tax_id, prof.phone, coalesce(prof.contact_email, prof.email),
    prof.address, prof.postal_code, prof.city, prof.province,
    case when same_delivery then prof.address else prof.delivery_address end,
    case when same_delivery then prof.postal_code else prof.delivery_postal_code end,
    case when same_delivery then prof.city else prof.delivery_city end,
    case when same_delivery then prof.province else prof.delivery_province end)
  returning * into created;

  return jsonb_build_object('id', created.id, 'number', created.number, 'created', true);
end;
$$;

revoke execute on function public.create_spare_part_request(uuid, uuid, public.spare_part, public.temple_side, uuid[], text)
  from public, anon;
grant execute on function public.create_spare_part_request(uuid, uuid, public.spare_part, public.temple_side, uuid[], text)
  to authenticated;
