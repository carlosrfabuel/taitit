-- Day 17: placing an order. Clients can't write orders or order_items directly (no grants); this
-- function is the only way in. Everything happens in one transaction:
--   1. checks: signed in, model published, the order image was uploaded by this user for this key
--   2. colors are recomputed here from the selection (never trusted from the client): every
--      customizable part needs an active color of its material; a finish the color doesn't offer
--      is dropped
--   3. one orders row (number from the sequence) + one order_items row per part, copied as they are
--      now, so later catalog changes never alter a sent order
-- Retries are safe: the same idempotency key returns the order already created (unique per user).

create function public.create_order(
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
  item_count integer := 0;
begin
  if uid is null then
    raise exception 'not_signed_in' using errcode = 'insufficient_privilege';
  end if;

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

  select * into prof from public.profiles where id = uid;

  insert into public.orders (user_id, customer_name, customer_email, model_id, model_name, notes, shop_ref, image_path, idempotency_key)
  values (
    uid, prof.full_name, prof.email, m.id, m.name,
    nullif(btrim(coalesce(p_notes, '')), ''), nullif(btrim(coalesce(p_shop_ref, '')), ''),
    image, p_key
  )
  -- Two concurrent calls with the same key: one inserts, the other gets nothing back here.
  on conflict (user_id, idempotency_key) do nothing
  returning * into new_order;
  if new_order.id is null then
    select * into existing from public.orders where user_id = uid and idempotency_key = p_key;
    return jsonb_build_object('id', existing.id, 'number', existing.number, 'created', false);
  end if;

  for z in
    select id, name, material, sort_order from public.model_zones
    where model_id = m.id and layer_path is not null
    order by sort_order, id
  loop
    pick := p_selection -> 'zones' -> (z.id::text);
    s := null;
    if pick is not null and jsonb_typeof(pick -> 'swatchId') = 'string' then
      select * into s from public.swatches
      where id::text = pick ->> 'swatchId' and active and material = z.material;
    end if;
    if s.id is null then
      -- The client shows replaced colors before confirming; here nothing is guessed.
      raise exception 'order_colors_changed' using errcode = 'check_violation', detail = z.name;
    end if;
    fin := case when pick ->> 'finish' in ('gloss', 'matte') then (pick ->> 'finish')::public.finish end;
    if fin is not null and not fin = any (s.finishes) then
      fin := null;
    end if;
    insert into public.order_items (order_id, zone_name, material, swatch_name, hex, ref, finish, kind, alpha, sort_order)
    values (new_order.id, z.name, z.material, s.name, s.hex, s.ref, fin, s.kind,
            case when s.kind = 'translucent' then s.alpha end, item_count);
    item_count := item_count + 1;
  end loop;

  if item_count = 0 then
    raise exception 'order_model_unavailable' using errcode = 'check_violation';
  end if;

  return jsonb_build_object('id', new_order.id, 'number', new_order.number, 'created', true);
end;
$$;

revoke execute on function public.create_order(uuid, uuid, jsonb, text, text) from public, anon;
grant execute on function public.create_order(uuid, uuid, jsonb, text, text) to authenticated;

-- "My orders" lists the newest first.
create index orders_user_created_idx on public.orders (user_id, created_at desc);
