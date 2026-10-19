-- Optician details (client decision 2026-10-19): every order comes with the optician's name and
-- details, plus free-text notes. The details live on the account (asked at sign-up, editable in
-- the app) and are copied into each order, so later edits never change a sent order.
-- full_name stays the contact person. Required to order: business name, tax ID, phone, address,
-- postal code, city. Legal name (defaults to the business name) and province are optional.

alter table public.profiles
  add column business_name text check (char_length(business_name) <= 120),
  add column legal_name text check (char_length(legal_name) <= 120),
  add column tax_id text check (char_length(tax_id) <= 20),
  add column phone text check (char_length(phone) <= 30),
  add column address text check (char_length(address) <= 200),
  add column postal_code text check (char_length(postal_code) <= 12),
  add column city text check (char_length(city) <= 80),
  add column province text check (char_length(province) <= 80);

-- Customers edit their own details (row policy "update own" already limits them to their row).
grant update (business_name, legal_name, tax_id, phone, address, postal_code, city, province) on public.profiles to authenticated;

-- The same columns on orders: a copy taken when the order is placed.
alter table public.orders
  add column business_name text,
  add column legal_name text,
  add column tax_id text,
  add column phone text,
  add column address text,
  add column postal_code text,
  add column city text,
  add column province text;

-- Blank (or spaces only) counts as missing.
create function private.business_complete(p public.profiles)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(btrim(p.business_name), '') <> '' and coalesce(btrim(p.tax_id), '') <> ''
     and coalesce(btrim(p.phone), '') <> '' and coalesce(btrim(p.address), '') <> ''
     and coalesce(btrim(p.postal_code), '') <> '' and coalesce(btrim(p.city), '') <> '';
$$;
revoke execute on function private.business_complete(public.profiles) from public, anon;
grant execute on function private.business_complete(public.profiles) to authenticated;

-- Sign-up: the details typed in the app arrive as user metadata; trimmed, cut to the column limits
-- (a long value must never make the whole sign-up fail), blank = not given.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, email, full_name, business_name, legal_name, tax_id, phone, address, postal_code, city, province)
  values (
    new.id,
    new.email,
    left(coalesce(meta ->> 'full_name', meta ->> 'name'), 120),
    nullif(left(btrim(meta ->> 'business_name'), 120), ''),
    nullif(left(btrim(meta ->> 'legal_name'), 120), ''),
    nullif(left(btrim(meta ->> 'tax_id'), 20), ''),
    nullif(left(btrim(meta ->> 'phone'), 30), ''),
    nullif(left(btrim(meta ->> 'address'), 200), ''),
    nullif(left(btrim(meta ->> 'postal_code'), 12), ''),
    nullif(left(btrim(meta ->> 'city'), 80), ''),
    nullif(left(btrim(meta ->> 'province'), 80), '')
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Placing orders: as before, plus the details check and their copy into the order.
create or replace function public.create_order(
  p_key uuid,
  p_model_id uuid,
  p_selection jsonb,
  p_notes text default null,
  p_shop_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  existing public.orders;
  m public.models;
  prof public.profiles;
  z record;
  s public.swatches;
  pick jsonb;
  fin public.finish;
  image text;
  new_order public.orders;
  items jsonb := '[]'::jsonb;
  zone_ids text[] := '{}';
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  -- Only accounts approved by TAITIT can order (client decision 2026-10-19).
  if not private.can_order(uid) then
    raise exception 'account_not_approved' using errcode = 'insufficient_privilege';
  end if;

  -- One call at a time per order attempt (same user + key): the second waits, then finds the order.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_key::text, 0));

  -- Retry of an order already placed: return it, change nothing.
  select * into existing from public.orders where user_id = uid and idempotency_key = p_key;
  if found then
    return jsonb_build_object('id', existing.id, 'number', existing.number, 'created', false);
  end if;

  select * into m from public.models where id = p_model_id and published;
  if not found then
    raise exception 'order_model_unavailable' using errcode = 'check_violation';
  end if;

  image := uid::text || '/' || p_key::text || '.jpg';
  if not exists (select 1 from storage.objects where bucket_id = 'orders' and name = image) then
    raise exception 'order_image_missing' using errcode = 'check_violation';
  end if;

  if p_notes is not null and char_length(btrim(p_notes)) > 1000
     or p_shop_ref is not null and char_length(btrim(p_shop_ref)) > 60 then
    raise exception 'order_text_too_long' using errcode = 'check_violation';
  end if;

  -- Every part, checked against what the app showed, before anything is written.
  for z in
    select id, name, material from public.model_zones
    where model_id = m.id and layer_path is not null
    order by sort_order, id
  loop
    zone_ids := zone_ids || z.id::text;
    pick := p_selection -> 'zones' -> (z.id::text);
    s := null;
    if pick is not null and jsonb_typeof(pick -> 'swatchId') = 'string' then
      select * into s from public.swatches
      where id::text = pick ->> 'swatchId' and active and material = z.material;
    end if;
    fin := case when pick ->> 'finish' in ('gloss', 'matte') then (pick ->> 'finish')::public.finish end;
    if s.id is null
       -- what the app showed must still be what the catalog says
       or s.hex is distinct from pick ->> 'hex'
       or s.ref is distinct from pick ->> 'ref'
       or s.name is distinct from pick ->> 'name'
       or s.kind::text is distinct from pick ->> 'kind'
       or (case when s.kind = 'translucent' then s.alpha end) is distinct from (pick ->> 'alpha')::numeric
       or (case when s.kind = 'havana' then s.texture_path end) is distinct from pick ->> 'texturePath'
       or (fin is not null and not fin = any (s.finishes)) then
      raise exception 'order_colors_changed' using errcode = 'check_violation', detail = z.name;
    end if;
    items := items || jsonb_build_object(
      'zone_name', z.name, 'material', z.material, 'swatch_name', s.name, 'hex', s.hex, 'ref', s.ref,
      'finish', fin, 'kind', s.kind, 'alpha', case when s.kind = 'translucent' then s.alpha end,
      'texture_path', case when s.kind = 'havana' then s.texture_path end
    );
  end loop;

  if cardinality(zone_ids) = 0 then
    raise exception 'order_model_unavailable' using errcode = 'check_violation';
  end if;
  -- A part the app showed that the model no longer has (removed since): the image would be wrong.
  if exists (
    select 1 from jsonb_object_keys(coalesce(p_selection -> 'zones', '{}'::jsonb)) k where k <> all (zone_ids)
  ) then
    raise exception 'order_colors_changed' using errcode = 'check_violation';
  end if;

  select * into prof from public.profiles where id = uid;
  -- The optician's details travel with every order (client decision 2026-10-19).
  if not private.business_complete(prof) then
    raise exception 'business_details_missing' using errcode = 'check_violation';
  end if;

  insert into public.orders (user_id, customer_name, customer_email, model_id, model_name, notes, shop_ref, image_path, idempotency_key,
                             business_name, legal_name, tax_id, phone, address, postal_code, city, province)
  values (
    uid, prof.full_name, prof.email, m.id, m.name,
    nullif(btrim(coalesce(p_notes, '')), ''), nullif(btrim(coalesce(p_shop_ref, '')), ''),
    image, p_key,
    prof.business_name, coalesce(prof.legal_name, prof.business_name), prof.tax_id, prof.phone, prof.address,
    prof.postal_code, prof.city, prof.province
  )
  returning * into new_order;

  insert into public.order_items (order_id, zone_name, material, swatch_name, hex, ref, finish, kind, alpha, texture_path, sort_order)
  select new_order.id, i ->> 'zone_name', (i ->> 'material')::public.material, i ->> 'swatch_name', i ->> 'hex',
         i ->> 'ref', (i ->> 'finish')::public.finish, (i ->> 'kind')::public.swatch_kind,
         (i ->> 'alpha')::numeric, i ->> 'texture_path', (n - 1)::integer
  from jsonb_array_elements(items) with ordinality as t(i, n);

  return jsonb_build_object('id', new_order.id, 'number', new_order.number, 'created', true);
end;
$$;
