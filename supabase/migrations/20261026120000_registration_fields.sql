-- The rest of the registration fields (Carlos, 2026-10-20; meanings confirmed 2026-10-21). Like the
-- other business details they live on the account (asked at sign-up, editable in the app) and are
-- copied into each order, so later edits never change a sent order.
--  labeling: "single labeling for entire order", the name TAITIT puts on the glasses of the
--    optician's orders. Required to order, like the business name.
--  contact_email: TAITIT's general contact with the optician (questions, invoices). None = the
--    sign-in email.
--  bank_account: optional.
--  delivery_* / commercial_*: none = the same as the main address. When given: street, postal code
--    and city, like the main address (province optional).

-- "Filled in": at least one character that is not white space, no-break spaces included (the rule
-- of private.business_complete, now shared).
create function private.has_text(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(t, '') ~ ('[^[:space:]' || U&'\00A0\2007\202F\3000' || ']');
$$;
revoke execute on function private.has_text(text) from public, anon;
grant execute on function private.has_text(text) to authenticated;

create function private.valid_email(t text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select t ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$';
$$;
revoke execute on function private.valid_email(text) from public, anon;
grant execute on function private.valid_email(text) to authenticated;

alter table public.profiles
  add column labeling text check (char_length(labeling) <= 60),
  add column contact_email text check (char_length(contact_email) <= 254 and private.valid_email(contact_email)),
  add column bank_account text check (char_length(bank_account) <= 42),
  add column delivery_address text check (char_length(delivery_address) <= 200),
  add column delivery_postal_code text check (char_length(delivery_postal_code) <= 12),
  add column delivery_city text check (char_length(delivery_city) <= 80),
  add column delivery_province text check (char_length(delivery_province) <= 80),
  add column commercial_address text check (char_length(commercial_address) <= 200),
  add column commercial_postal_code text check (char_length(commercial_postal_code) <= 12),
  add column commercial_city text check (char_length(commercial_city) <= 80),
  add column commercial_province text check (char_length(commercial_province) <= 80),
  -- An address is either not given at all (same as the main one) or complete.
  add constraint profiles_delivery_address_complete check (
    num_nonnulls(delivery_address, delivery_postal_code, delivery_city, delivery_province) = 0
    or private.has_text(delivery_address) and private.has_text(delivery_postal_code) and private.has_text(delivery_city)
  ),
  add constraint profiles_commercial_address_complete check (
    num_nonnulls(commercial_address, commercial_postal_code, commercial_city, commercial_province) = 0
    or private.has_text(commercial_address) and private.has_text(commercial_postal_code) and private.has_text(commercial_city)
  );

grant update (
  labeling, contact_email, bank_account,
  delivery_address, delivery_postal_code, delivery_city, delivery_province,
  commercial_address, commercial_postal_code, commercial_city, commercial_province
) on public.profiles to authenticated;

-- The copy on each order, with "same as" resolved: the order shows the addresses and email in full.
alter table public.orders
  add column labeling text,
  add column contact_email text,
  add column bank_account text,
  add column delivery_address text,
  add column delivery_postal_code text,
  add column delivery_city text,
  add column delivery_province text,
  add column commercial_address text,
  add column commercial_postal_code text,
  add column commercial_city text,
  add column commercial_province text;

-- Required to order: as before, plus the name for the glasses.
create or replace function private.business_complete(p public.profiles)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select private.has_text(p.business_name) and private.has_text(p.tax_id) and private.has_text(p.phone)
     and private.has_text(p.address) and private.has_text(p.postal_code) and private.has_text(p.city)
     and private.has_text(p.labeling);
$$;

-- Sign-up: the new details arrive as user metadata like the others. Never a reason for the sign-up to
-- fail: an invalid contact email, or an address missing its street, postal code or city, is dropped
-- (the app validates them before sending; this is the guard for anything else).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  contact text := nullif(left(btrim(meta ->> 'contact_email'), 254), '');
  d text[] := array[
    nullif(left(btrim(meta ->> 'delivery_address'), 200), ''), nullif(left(btrim(meta ->> 'delivery_postal_code'), 12), ''),
    nullif(left(btrim(meta ->> 'delivery_city'), 80), ''), nullif(left(btrim(meta ->> 'delivery_province'), 80), '')];
  c text[] := array[
    nullif(left(btrim(meta ->> 'commercial_address'), 200), ''), nullif(left(btrim(meta ->> 'commercial_postal_code'), 12), ''),
    nullif(left(btrim(meta ->> 'commercial_city'), 80), ''), nullif(left(btrim(meta ->> 'commercial_province'), 80), '')];
begin
  if not coalesce(private.valid_email(contact), false) then contact := null; end if;
  if not (private.has_text(d[1]) and private.has_text(d[2]) and private.has_text(d[3])) then d := array[null, null, null, null]::text[]; end if;
  if not (private.has_text(c[1]) and private.has_text(c[2]) and private.has_text(c[3])) then c := array[null, null, null, null]::text[]; end if;
  insert into public.profiles (
    id, email, full_name, business_name, legal_name, tax_id, phone, address, postal_code, city, province,
    labeling, contact_email, bank_account,
    delivery_address, delivery_postal_code, delivery_city, delivery_province,
    commercial_address, commercial_postal_code, commercial_city, commercial_province
  )
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
    nullif(left(btrim(meta ->> 'province'), 80), ''),
    nullif(left(btrim(meta ->> 'labeling'), 60), ''),
    contact,
    nullif(left(btrim(meta ->> 'bank_account'), 42), ''),
    d[1], d[2], d[3], d[4],
    c[1], c[2], c[3], c[4]
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Repeated sign-up of a not-yet-confirmed account (see 20261021150000): given values replace the old
-- ones, missing ones are kept. An address only replaces the old one when it is complete.
create or replace function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  contact text := nullif(left(btrim(meta ->> 'contact_email'), 254), '');
  d text[] := array[
    nullif(left(btrim(meta ->> 'delivery_address'), 200), ''), nullif(left(btrim(meta ->> 'delivery_postal_code'), 12), ''),
    nullif(left(btrim(meta ->> 'delivery_city'), 80), ''), nullif(left(btrim(meta ->> 'delivery_province'), 80), '')];
  c text[] := array[
    nullif(left(btrim(meta ->> 'commercial_address'), 200), ''), nullif(left(btrim(meta ->> 'commercial_postal_code'), 12), ''),
    nullif(left(btrim(meta ->> 'commercial_city'), 80), ''), nullif(left(btrim(meta ->> 'commercial_province'), 80), '')];
  d_ok boolean;
  c_ok boolean;
begin
  if old.email_confirmed_at is not null then
    return new;
  end if;
  if not coalesce(private.valid_email(contact), false) then contact := null; end if;
  d_ok := private.has_text(d[1]) and private.has_text(d[2]) and private.has_text(d[3]);
  c_ok := private.has_text(c[1]) and private.has_text(c[2]) and private.has_text(c[3]);
  update public.profiles set
    full_name = coalesce(nullif(left(btrim(coalesce(meta ->> 'full_name', meta ->> 'name')), 120), ''), full_name),
    business_name = coalesce(nullif(left(btrim(meta ->> 'business_name'), 120), ''), business_name),
    legal_name = coalesce(nullif(left(btrim(meta ->> 'legal_name'), 120), ''), legal_name),
    tax_id = coalesce(nullif(left(btrim(meta ->> 'tax_id'), 20), ''), tax_id),
    phone = coalesce(nullif(left(btrim(meta ->> 'phone'), 30), ''), phone),
    address = coalesce(nullif(left(btrim(meta ->> 'address'), 200), ''), address),
    postal_code = coalesce(nullif(left(btrim(meta ->> 'postal_code'), 12), ''), postal_code),
    city = coalesce(nullif(left(btrim(meta ->> 'city'), 80), ''), city),
    province = coalesce(nullif(left(btrim(meta ->> 'province'), 80), ''), province),
    labeling = coalesce(nullif(left(btrim(meta ->> 'labeling'), 60), ''), labeling),
    contact_email = coalesce(contact, contact_email),
    bank_account = coalesce(nullif(left(btrim(meta ->> 'bank_account'), 42), ''), bank_account),
    delivery_address = case when d_ok then d[1] else delivery_address end,
    delivery_postal_code = case when d_ok then d[2] else delivery_postal_code end,
    delivery_city = case when d_ok then d[3] else delivery_city end,
    delivery_province = case when d_ok then d[4] else delivery_province end,
    commercial_address = case when c_ok then c[1] else commercial_address end,
    commercial_postal_code = case when c_ok then c[2] else commercial_postal_code end,
    commercial_city = case when c_ok then c[3] else commercial_city end,
    commercial_province = case when c_ok then c[4] else commercial_province end
  where id = new.id;
  return new;
end;
$$;
revoke execute on function public.handle_user_metadata_update() from public, anon, authenticated;

-- Placing orders: as in 20261023120000_zone_roles_quantity.sql, plus the copy of the new details.
create or replace function public.create_order(
  p_key uuid,
  p_model_id uuid,
  p_selection jsonb,
  p_notes text default null,
  p_shop_ref text default null,
  p_quantity integer default 1
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
  same_delivery boolean;
  same_commercial boolean;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  -- One call at a time per order attempt (same user + key): the second waits, then finds the order.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_key::text, 0));

  -- Retry of an order already placed: return it, change nothing. Before the approval check: an
  -- order placed while approved stays placed, even if the answer was lost and the account changed since.
  select * into existing from public.orders where user_id = uid and idempotency_key = p_key;
  if found then
    return jsonb_build_object('id', existing.id, 'number', existing.number, 'created', false);
  end if;

  -- Only accounts approved by TAITIT can order (client decision 2026-10-19).
  if not private.can_order(uid) then
    raise exception 'account_not_approved' using errcode = 'insufficient_privilege';
  end if;

  if p_quantity is null or p_quantity not between 1 and 99 then
    raise exception 'order_quantity_invalid' using errcode = 'check_violation';
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
    select id, name, material, role from public.model_zones
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
      'zone_name', z.name, 'zone_role', z.role, 'material', z.material, 'swatch_name', s.name, 'hex', s.hex,
      'ref', s.ref, 'finish', fin, 'kind', s.kind, 'alpha', case when s.kind = 'translucent' then s.alpha end,
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
  -- No delivery / commercial address of their own: the main one (the constraints keep them complete).
  same_delivery := prof.delivery_address is null;
  same_commercial := prof.commercial_address is null;

  insert into public.orders (user_id, customer_name, customer_email, model_id, model_name, notes, shop_ref, image_path, idempotency_key,
                             business_name, legal_name, tax_id, phone, address, postal_code, city, province, quantity,
                             labeling, contact_email, bank_account,
                             delivery_address, delivery_postal_code, delivery_city, delivery_province,
                             commercial_address, commercial_postal_code, commercial_city, commercial_province)
  values (
    uid, prof.full_name, prof.email, m.id, m.name,
    nullif(btrim(coalesce(p_notes, '')), ''), nullif(btrim(coalesce(p_shop_ref, '')), ''),
    image, p_key,
    prof.business_name, coalesce(nullif(btrim(prof.legal_name), ''), prof.business_name), prof.tax_id, prof.phone, prof.address,
    prof.postal_code, prof.city, prof.province, p_quantity,
    prof.labeling, coalesce(prof.contact_email, prof.email), prof.bank_account,
    case when same_delivery then prof.address else prof.delivery_address end,
    case when same_delivery then prof.postal_code else prof.delivery_postal_code end,
    case when same_delivery then prof.city else prof.delivery_city end,
    case when same_delivery then prof.province else prof.delivery_province end,
    case when same_commercial then prof.address else prof.commercial_address end,
    case when same_commercial then prof.postal_code else prof.commercial_postal_code end,
    case when same_commercial then prof.city else prof.commercial_city end,
    case when same_commercial then prof.province else prof.commercial_province end
  )
  returning * into new_order;

  insert into public.order_items (order_id, zone_name, zone_role, material, swatch_name, hex, ref, finish, kind, alpha, texture_path, sort_order)
  select new_order.id, i ->> 'zone_name', (i ->> 'zone_role')::public.zone_role, (i ->> 'material')::public.material,
         i ->> 'swatch_name', i ->> 'hex', i ->> 'ref', (i ->> 'finish')::public.finish, (i ->> 'kind')::public.swatch_kind,
         (i ->> 'alpha')::numeric, i ->> 'texture_path', (n - 1)::integer
  from jsonb_array_elements(items) with ordinality as t(i, n);

  return jsonb_build_object('id', new_order.id, 'number', new_order.number, 'created', true);
end;
$$;

revoke execute on function public.create_order(uuid, uuid, jsonb, text, text, integer) from public, anon;
grant execute on function public.create_order(uuid, uuid, jsonb, text, text, integer) to authenticated;
