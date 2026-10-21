-- Client decisions 2026-10-20 (Carlos):
-- 1. Every model has the same three zones: "metal principal" (locked with the temples), "frente
--    secundario" (acetate or metal, per model) and "terminales" (always acetate). A zone's role says
--    which one it is: the app defaults the tips to the secondary front's colour, and the order sheet
--    has one column per role. Names stay free text (the app shows them); the role is fixed.
-- 2. Orders carry a quantity (identical frames of the same design).

create type public.zone_role as enum ('main', 'secondary', 'tips');

alter table public.model_zones
  add column role public.zone_role,
  -- "metal principal" is metal; "terminales" are always acetate.
  add constraint model_zones_role_material check (
    (role is distinct from 'main' or material = 'metal')
    and (role is distinct from 'tips' or material = 'acetate')
  );

-- One zone per role and model.
create unique index model_zones_one_role on public.model_zones (model_id, role) where role is not null;

-- The model already in the catalog (PHILEAS): roles, and Carlos's names in English (the app's language).
-- Saved designs point at zone ids and orders keep their own copy of the names, so renaming is safe.
update public.model_zones z
set role = v.role::public.zone_role, name = v.name
from (values ('Front & temples', 'main', 'Main metal'),
             ('Rims', 'secondary', 'Secondary front'),
             ('Temple tips', 'tips', 'Tips')) as v(old_name, role, name)
where z.name = v.old_name
  and z.model_id in (select id from public.models where name = 'PHILEAS');

-- The role travels with each ordered part (order sheet columns); older orders have none.
alter table public.order_items add column zone_role public.zone_role;

alter table public.orders
  add column quantity integer not null default 1 check (quantity between 1 and 99);

-- create_order with the quantity. A new parameter is a new signature: the old function goes.
drop function public.create_order(uuid, uuid, jsonb, text, text);

create function public.create_order(
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

  insert into public.orders (user_id, customer_name, customer_email, model_id, model_name, notes, shop_ref, image_path, idempotency_key,
                             business_name, legal_name, tax_id, phone, address, postal_code, city, province, quantity)
  values (
    uid, prof.full_name, prof.email, m.id, m.name,
    nullif(btrim(coalesce(p_notes, '')), ''), nullif(btrim(coalesce(p_shop_ref, '')), ''),
    image, p_key,
    prof.business_name, coalesce(nullif(btrim(prof.legal_name), ''), prof.business_name), prof.tax_id, prof.phone, prof.address,
    prof.postal_code, prof.city, prof.province, p_quantity
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
