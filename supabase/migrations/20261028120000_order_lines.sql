-- Several frames in one order (Carlos, 2026-10-26: "pedir en una misma orden 12 gafas diferentes").
-- An order is the header (number, the optician's details, notes); each frame is a line with its
-- model, quantity, image and parts. Orders placed so far are one line each. The order keeps a summary
-- (first model, model names, total frames, first image) so lists, searches and the app version
-- already installed keep working; create_order (one frame) now places a one-line order.

create table public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  line_no integer not null check (line_no between 1 and 50),
  -- Cleared if the model is deleted; the name copy keeps the line readable.
  model_id uuid references public.models (id) on delete set null,
  model_name text not null,
  quantity integer not null check (quantity between 1 and 99),
  image_path text,
  constraint order_lines_line_no_unique unique (order_id, line_no)
);

create index order_lines_order_id_idx on public.order_lines (order_id);
create index order_lines_model_id_idx on public.order_lines (model_id);

alter table public.order_items add column line_id uuid references public.order_lines (id) on delete cascade;
create index order_items_line_id_idx on public.order_items (line_id);

-- Every order placed so far is one frame: one line, its parts attached to it.
insert into public.order_lines (order_id, line_no, model_id, model_name, quantity, image_path)
select id, 1, model_id, model_name, quantity, image_path from public.orders;
update public.order_items i set line_id = l.id from public.order_lines l where l.order_id = i.order_id;
alter table public.order_items alter column line_id set not null;

-- orders.quantity is now the total of the lines (50 lines × 99 at most).
alter table public.orders drop constraint orders_quantity_check;
alter table public.orders add constraint orders_quantity_check check (quantity between 1 and 4950);

-- Read with their order, like order_items. Written only by create_order_lines.
alter table public.order_lines enable row level security;
revoke all on public.order_lines from anon, authenticated;
grant select on public.order_lines to authenticated;
create policy "order_lines: read with order" on public.order_lines
  for select to authenticated
  using (
    (select private.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );

-- Placing an order of one or more frames. p_lines: [{ model_id, selection, quantity, image_key }], in
-- order; each line's image is uploaded first to "<user id>/<image_key>.jpg". Same checks as before,
-- per line (published model, quantity, image there, colors exactly as the app showed them); the
-- optician's details are copied once into the order. One transaction: all lines or nothing.
create function public.create_order_lines(
  p_key uuid,
  p_lines jsonb,
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
  prof public.profiles;
  line jsonb;
  pos bigint;
  m public.models;
  z record;
  s public.swatches;
  pick jsonb;
  sel jsonb;
  fin public.finish;
  qty integer;
  image text;
  images text[] := '{}';
  items jsonb;
  zone_ids text[];
  prepared jsonb := '[]'::jsonb;
  total integer := 0;
  names text[] := '{}';
  new_order public.orders;
  new_line_id uuid;
  same_delivery boolean;
  same_commercial boolean;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

  -- One call at a time per order attempt (same user + key): the second waits, then finds the order.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || ':' || p_key::text, 0));

  -- Retry of an order already placed: return it, change nothing (before the approval check).
  select * into existing from public.orders where user_id = uid and idempotency_key = p_key;
  if found then
    return jsonb_build_object('id', existing.id, 'number', existing.number, 'created', false);
  end if;

  if not private.can_order(uid) then
    raise exception 'account_not_approved' using errcode = 'insufficient_privilege';
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) not between 1 and 50 then
    raise exception 'order_lines_invalid' using errcode = 'check_violation';
  end if;

  if p_notes is not null and char_length(btrim(p_notes)) > 1000
     or p_shop_ref is not null and char_length(btrim(p_shop_ref)) > 60 then
    raise exception 'order_text_too_long' using errcode = 'check_violation';
  end if;

  for line, pos in select t.l, t.n from jsonb_array_elements(p_lines) with ordinality as t(l, n) loop
    qty := case when jsonb_typeof(line -> 'quantity') = 'number' and (line ->> 'quantity')::numeric between 1 and 99
                then (line ->> 'quantity')::numeric::integer end;
    if qty is null or (line ->> 'quantity')::numeric <> qty then
      raise exception 'order_quantity_invalid' using errcode = 'check_violation';
    end if;

    m := null;
    if jsonb_typeof(line -> 'model_id') = 'string' then
      select * into m from public.models where id::text = line ->> 'model_id' and published;
    end if;
    if m.id is null then
      raise exception 'order_model_unavailable' using errcode = 'check_violation', detail = coalesce(line ->> 'model_id', '');
    end if;

    if coalesce(jsonb_typeof(line -> 'image_key'), '') <> 'string'
       or (line ->> 'image_key') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      raise exception 'order_image_missing' using errcode = 'check_violation';
    end if;
    image := uid::text || '/' || (line ->> 'image_key') || '.jpg';
    if image = any (images)
       or not exists (select 1 from storage.objects where bucket_id = 'orders' and name = image) then
      raise exception 'order_image_missing' using errcode = 'check_violation';
    end if;
    images := images || image;

    -- Every part of this frame, checked against what the app showed, before anything is written.
    sel := line -> 'selection';
    items := '[]'::jsonb;
    zone_ids := '{}';
    for z in
      select id, name, material, role from public.model_zones
      where model_id = m.id and layer_path is not null
      order by sort_order, id
    loop
      zone_ids := zone_ids || z.id::text;
      pick := sel -> 'zones' -> (z.id::text);
      s := null;
      if pick is not null and jsonb_typeof(pick -> 'swatchId') = 'string' then
        select * into s from public.swatches
        where id::text = pick ->> 'swatchId' and active and material = z.material;
      end if;
      fin := case when pick ->> 'finish' in ('gloss', 'matte') then (pick ->> 'finish')::public.finish end;
      if s.id is null
         or s.hex is distinct from pick ->> 'hex'
         or s.ref is distinct from pick ->> 'ref'
         or s.name is distinct from pick ->> 'name'
         or s.kind::text is distinct from pick ->> 'kind'
         or (case when s.kind = 'translucent' then s.alpha end) is distinct from (pick ->> 'alpha')::numeric
         or (case when s.kind = 'havana' then s.texture_path end) is distinct from pick ->> 'texturePath'
         or (fin is not null and not fin = any (s.finishes)) then
        raise exception 'order_colors_changed' using errcode = 'check_violation', detail = m.name || ': ' || z.name;
      end if;
      items := items || jsonb_build_object(
        'zone_name', z.name, 'zone_role', z.role, 'material', z.material, 'swatch_name', s.name, 'hex', s.hex,
        'ref', s.ref, 'finish', fin, 'kind', s.kind, 'alpha', case when s.kind = 'translucent' then s.alpha end,
        'texture_path', case when s.kind = 'havana' then s.texture_path end
      );
    end loop;
    if cardinality(zone_ids) = 0 then
      raise exception 'order_model_unavailable' using errcode = 'check_violation', detail = m.name;
    end if;
    if exists (
      select 1 from jsonb_object_keys(coalesce(sel -> 'zones', '{}'::jsonb)) k where k <> all (zone_ids)
    ) then
      raise exception 'order_colors_changed' using errcode = 'check_violation', detail = m.name;
    end if;

    prepared := prepared || jsonb_build_object(
      'line_no', pos, 'model_id', m.id, 'model_name', m.name, 'quantity', qty, 'image_path', image, 'items', items
    );
    total := total + qty;
    if not m.name = any (names) then
      names := names || m.name;
    end if;
  end loop;

  select * into prof from public.profiles where id = uid;
  if not private.business_complete(prof) then
    raise exception 'business_details_missing' using errcode = 'check_violation';
  end if;
  same_delivery := prof.delivery_address is null;
  same_commercial := prof.commercial_address is null;

  -- The order with its summary: first model and image, every model name, total frames.
  insert into public.orders (user_id, customer_name, customer_email, model_id, model_name, notes, shop_ref, image_path, idempotency_key,
                             business_name, legal_name, tax_id, phone, address, postal_code, city, province, quantity,
                             labeling, contact_email, bank_account,
                             delivery_address, delivery_postal_code, delivery_city, delivery_province,
                             commercial_address, commercial_postal_code, commercial_city, commercial_province)
  values (
    uid, prof.full_name, prof.email, (prepared -> 0 ->> 'model_id')::uuid, array_to_string(names, ', '),
    nullif(btrim(coalesce(p_notes, '')), ''), nullif(btrim(coalesce(p_shop_ref, '')), ''),
    prepared -> 0 ->> 'image_path', p_key,
    prof.business_name, coalesce(nullif(btrim(prof.legal_name), ''), prof.business_name), prof.tax_id, prof.phone, prof.address,
    prof.postal_code, prof.city, prof.province, total,
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

  for line in select value from jsonb_array_elements(prepared) loop
    insert into public.order_lines (order_id, line_no, model_id, model_name, quantity, image_path)
    values (new_order.id, (line ->> 'line_no')::integer, (line ->> 'model_id')::uuid, line ->> 'model_name',
            (line ->> 'quantity')::integer, line ->> 'image_path')
    returning id into new_line_id;
    insert into public.order_items (order_id, line_id, zone_name, zone_role, material, swatch_name, hex, ref, finish, kind, alpha, texture_path, sort_order)
    select new_order.id, new_line_id, i ->> 'zone_name', (i ->> 'zone_role')::public.zone_role, (i ->> 'material')::public.material,
           i ->> 'swatch_name', i ->> 'hex', i ->> 'ref', (i ->> 'finish')::public.finish, (i ->> 'kind')::public.swatch_kind,
           (i ->> 'alpha')::numeric, i ->> 'texture_path', (n - 1)::integer
    from jsonb_array_elements(line -> 'items') with ordinality as t(i, n);
  end loop;

  return jsonb_build_object('id', new_order.id, 'number', new_order.number, 'created', true);
end;
$$;

revoke execute on function public.create_order_lines(uuid, jsonb, text, text) from public, anon;
grant execute on function public.create_order_lines(uuid, jsonb, text, text) to authenticated;

-- One frame (the app version already installed): a one-line order, image "<user id>/<key>.jpg" as before.
create or replace function public.create_order(
  p_key uuid,
  p_model_id uuid,
  p_selection jsonb,
  p_notes text default null,
  p_shop_ref text default null,
  p_quantity integer default 1
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.create_order_lines(
    p_key,
    jsonb_build_array(jsonb_build_object(
      'model_id', p_model_id, 'selection', p_selection, 'quantity', p_quantity, 'image_key', p_key
    )),
    p_notes,
    p_shop_ref
  );
$$;
