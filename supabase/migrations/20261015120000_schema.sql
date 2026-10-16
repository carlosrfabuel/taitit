-- TAITIT Configurador: core schema, constraints and row-level security.
-- Data model: docs/MILESTONE_PLAN.md section 3.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.material as enum ('metal', 'acetate');
create type public.finish as enum ('gloss', 'matte');
create type public.swatch_kind as enum ('metal', 'solid', 'translucent', 'havana');
create type public.order_status as enum ('received', 'in_production', 'ready', 'delivered');
create type public.user_role as enum ('customer', 'admin');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text check (char_length(full_name) <= 120),
  role public.user_role not null default 'customer',
  push_token text check (char_length(push_token) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Security definer so policies can check the role without recursing into profiles RLS.
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

-- New auth user -> profile row (email copied so the admin panel can read it).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.handle_user_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_email_changed after update of email on auth.users
  for each row when (old.email is distinct from new.email)
  execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------------
-- Catalog: swatches, models, zones
-- ---------------------------------------------------------------------------
create table public.swatches (
  id uuid primary key default gen_random_uuid(),
  material public.material not null,
  name text not null check (char_length(name) between 1 and 60),
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  ref text not null unique check (char_length(ref) between 1 and 30),
  kind public.swatch_kind not null,
  alpha numeric(3, 2) check (alpha is null or (alpha > 0 and alpha <= 1)),
  texture_path text,
  finishes public.finish[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 'metal' kind only for metal swatches, and metal swatches are always 'metal' kind.
  constraint swatches_kind_matches_material check ((kind = 'metal') = (material = 'metal')),
  constraint swatches_translucent_has_alpha check (kind <> 'translucent' or alpha is not null)
);

create trigger swatches_updated_at before update on public.swatches
  for each row execute function public.set_updated_at();

create table public.models (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 60),
  category text not null default '' check (char_length(category) <= 60),
  size_ref text check (char_length(size_ref) <= 30),
  description text check (char_length(description) <= 1000),
  base_path text,
  published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint models_published_needs_image check (not published or base_path is not null)
);

create trigger models_updated_at before update on public.models
  for each row execute function public.set_updated_at();

create table public.model_zones (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references public.models (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  material public.material not null,
  layer_path text,
  default_swatch_id uuid references public.swatches (id) on delete set null,
  default_finish public.finish,
  sort_order integer not null default 0,
  constraint model_zones_unique_name unique (model_id, name)
);

create index model_zones_model_id_idx on public.model_zones (model_id);

-- Contract limit (max 4 zones per model) and default swatch must match the zone material.
create function public.check_model_zone()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  zone_count integer;
  swatch_material public.material;
begin
  -- Lock the parent model so concurrent inserts can't both pass the count.
  perform 1 from public.models where id = new.model_id for update;

  select count(*) into zone_count
  from public.model_zones
  where model_id = new.model_id and id <> new.id;

  if zone_count >= 4 then
    raise exception 'A model can have at most 4 customizable zones'
      using errcode = 'check_violation';
  end if;

  if new.default_swatch_id is not null then
    select material into swatch_material from public.swatches where id = new.default_swatch_id;
    if swatch_material is distinct from new.material then
      raise exception 'Default swatch material must match the zone material'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger model_zones_check before insert or update on public.model_zones
  for each row execute function public.check_model_zone();

-- ---------------------------------------------------------------------------
-- Saved designs
-- ---------------------------------------------------------------------------
create table public.designs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  model_id uuid not null references public.models (id) on delete cascade,
  name text not null default 'Mi diseño' check (char_length(name) between 1 and 60),
  selection jsonb not null default '{}' check (jsonb_typeof(selection) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index designs_user_id_idx on public.designs (user_id);
create index designs_model_id_idx on public.designs (model_id);

create trigger designs_updated_at before update on public.designs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Orders (immutable snapshot of what was ordered)
-- ---------------------------------------------------------------------------
create sequence public.order_number_seq start with 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number integer not null unique default nextval('public.order_number_seq'),
  -- Cleared when the account is deleted; the name/email copy keeps the record usable.
  user_id uuid references public.profiles (id) on delete set null,
  customer_name text,
  customer_email text,
  model_id uuid references public.models (id) on delete set null,
  model_name text not null,
  notes text check (char_length(notes) <= 1000),
  shop_ref text check (char_length(shop_ref) <= 60),
  image_path text,
  status public.order_status not null default 'received',
  status_updated_at timestamptz not null default now(),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  constraint orders_idempotency_unique unique (user_id, idempotency_key)
);

alter sequence public.order_number_seq owned by public.orders.number;

create index orders_user_id_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

create function public.touch_order_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.status_updated_at := now();
  end if;
  return new;
end;
$$;

create trigger orders_status_touch before update on public.orders
  for each row execute function public.touch_order_status();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  zone_name text not null,
  material public.material not null,
  swatch_name text not null,
  hex text not null,
  ref text not null,
  finish public.finish,
  kind public.swatch_kind not null,
  alpha numeric(3, 2),
  sort_order integer not null default 0
);

create index order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, grant only what the app needs.
-- Column-level grants are what stop customers from changing their own role.
-- ---------------------------------------------------------------------------
revoke all on public.profiles, public.swatches, public.models, public.model_zones,
  public.designs, public.orders, public.order_items from anon, authenticated;
revoke all on sequence public.order_number_seq from anon, authenticated;

grant select on public.models, public.model_zones, public.swatches to anon;

grant select on public.profiles, public.models, public.model_zones, public.swatches,
  public.designs, public.orders, public.order_items to authenticated;
grant update (full_name, push_token) on public.profiles to authenticated;
grant insert, update, delete on public.designs to authenticated;
grant insert, update, delete on public.models, public.model_zones, public.swatches to authenticated;
grant update (status) on public.orders to authenticated;
-- Orders/order_items are created only by a server-side function (Day 17), never directly by clients.

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke execute on function public.handle_new_user(), public.handle_user_email_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.swatches enable row level security;
alter table public.models enable row level security;
alter table public.model_zones enable row level security;
alter table public.designs enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- profiles
create policy "profiles: read own, admin reads all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- swatches
create policy "swatches: read active, admin reads all" on public.swatches
  for select to anon, authenticated
  using (active or (select public.is_admin()));
create policy "swatches: admin inserts" on public.swatches
  for insert to authenticated with check ((select public.is_admin()));
create policy "swatches: admin updates" on public.swatches
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "swatches: admin deletes" on public.swatches
  for delete to authenticated using ((select public.is_admin()));

-- models
create policy "models: read published, admin reads all" on public.models
  for select to anon, authenticated
  using (published or (select public.is_admin()));
create policy "models: admin inserts" on public.models
  for insert to authenticated with check ((select public.is_admin()));
create policy "models: admin updates" on public.models
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "models: admin deletes" on public.models
  for delete to authenticated using ((select public.is_admin()));

-- model_zones (visible when the parent model is visible)
create policy "model_zones: read with model" on public.model_zones
  for select to anon, authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.models m where m.id = model_id and m.published)
  );
create policy "model_zones: admin inserts" on public.model_zones
  for insert to authenticated with check ((select public.is_admin()));
create policy "model_zones: admin updates" on public.model_zones
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "model_zones: admin deletes" on public.model_zones
  for delete to authenticated using ((select public.is_admin()));

-- designs (private to their owner; the admin does not need them)
create policy "designs: owner reads" on public.designs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "designs: owner inserts" on public.designs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "designs: owner updates" on public.designs
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "designs: owner deletes" on public.designs
  for delete to authenticated using (user_id = (select auth.uid()));

-- orders
create policy "orders: owner or admin reads" on public.orders
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "orders: admin updates status" on public.orders
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

-- order_items (visible with their order)
create policy "order_items: read with order" on public.order_items
  for select to authenticated
  using (
    (select public.is_admin())
    or exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
