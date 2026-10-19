-- Account approval (client decision 2026-10-19): TAITIT approves every new account before it can
-- order. Until then the optician can browse the catalog and save designs.
--   pending  : just registered (default)
--   approved : can place orders
--   rejected : can't place orders (TAITIT can approve later)
-- The status is changed only by an admin, through set_account_status (customers can update their
-- own profile row, so the column itself is never granted).

create type public.account_status as enum ('pending', 'approved', 'rejected');

alter table public.profiles
  add column status public.account_status not null default 'pending',
  add column reviewed_at timestamptz,
  add column reviewed_by uuid references public.profiles (id) on delete set null;

-- Accounts that existed before the rule keep working.
update public.profiles set status = 'approved', reviewed_at = now();

create index profiles_status_idx on public.profiles (status, created_at desc);

-- Who may place orders: approved accounts, and admins.
create function private.can_order(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = uid and (status = 'approved' or role = 'admin')
  );
$$;
revoke execute on function private.can_order(uuid) from public, anon;
grant execute on function private.can_order(uuid) to authenticated;

-- Admin: approve or reject an account (also to undo a decision). Returns the new status.
create function public.set_account_status(p_user uuid, p_status public.account_status)
returns public.account_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
begin
  if not private.is_admin() then
    raise exception 'not_admin' using errcode = 'insufficient_privilege';
  end if;
  if p_user = me then
    raise exception 'own_account' using errcode = 'check_violation';
  end if;
  update public.profiles
  set status = p_status,
      reviewed_at = case when p_status = 'pending' then null else now() end,
      reviewed_by = case when p_status = 'pending' then null else me end
  where id = p_user;
  if not found then
    raise exception 'account_not_found' using errcode = 'no_data_found';
  end if;
  return p_status;
end;
$$;
revoke execute on function public.set_account_status(uuid, public.account_status) from public, anon;
grant execute on function public.set_account_status(uuid, public.account_status) to authenticated;

-- Placing orders: the same function as before, plus the approval check.
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

  insert into public.orders (user_id, customer_name, customer_email, model_id, model_name, notes, shop_ref, image_path, idempotency_key)
  values (
    uid, prof.full_name, prof.email, m.id, m.name,
    nullif(btrim(coalesce(p_notes, '')), ''), nullif(btrim(coalesce(p_shop_ref, '')), ''),
    image, p_key
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

-- Order images: only accounts that can order may upload them.
drop policy "order images: owner uploads to own folder" on storage.objects;
create policy "order images: owner uploads to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'orders'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    -- <user id>/<uuid>.jpg, nothing else
    and name ~ '^[0-9a-f-]{36}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$'
    and private.order_image_count((select auth.uid())) < 2000
    and private.can_order((select auth.uid()))
  );
