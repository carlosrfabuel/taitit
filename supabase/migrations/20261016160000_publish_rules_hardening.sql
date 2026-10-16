-- Fixes from the Day 7 review of 20261016150000_publish_rules.sql.
--
-- 1. The default color must be active: customers can't read inactive swatches, so a published zone
--    pointing to one would have no color in the app. Deactivating (or deleting) a color used by a
--    published model is refused too.
-- 2. On UPDATE the model check runs only when publishing or when the base image changes, so an older
--    published model that predates the rules can still be renamed or reordered.
-- 3. Zone changes lock the parent model row first, so a zone deleted while another session publishes
--    the model can't leave a published model without zones (the two now run one after the other).
-- 4. Published models that don't pass the check (none in the dev project) are unpublished.

create or replace function private.publish_problems(
  p_model_id uuid,
  p_base_path text,
  p_base_width integer,
  p_base_height integer
)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select array_remove(array[
    case when p_base_path is null then 'no_base_image' end,
    case when p_base_path is not null and (p_base_width is null or p_base_height is null)
      then 'base_size_unknown' end,
    case when not exists (select 1 from public.model_zones z where z.model_id = p_model_id)
      then 'no_zones' end,
    case when exists (select 1 from public.model_zones z where z.model_id = p_model_id and z.layer_path is null)
      then 'zone_without_layer' end,
    case when exists (
        select 1 from public.model_zones z
        where z.model_id = p_model_id and z.layer_path is not null
          and (z.layer_width is distinct from p_base_width or z.layer_height is distinct from p_base_height)
      ) then 'layer_size_mismatch' end,
    case when exists (select 1 from public.model_zones z where z.model_id = p_model_id and z.default_swatch_id is null)
      then 'zone_without_default_color' end,
    case when exists (
        select 1 from public.model_zones z join public.swatches s on s.id = z.default_swatch_id
        where z.model_id = p_model_id and not s.active
      ) then 'default_color_inactive' end
  ], null);
$$;

create or replace function private.check_model_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  problems text[];
begin
  if new.published and (
    tg_op = 'INSERT'
    or not old.published
    or new.base_path is distinct from old.base_path
    or new.base_width is distinct from old.base_width
    or new.base_height is distinct from old.base_height
  ) then
    problems := private.publish_problems(new.id, new.base_path, new.base_width, new.base_height);
    if cardinality(problems) > 0 then
      raise exception 'Model cannot be published: %', array_to_string(problems, ', ')
        using errcode = 'check_violation', hint = 'publish_rules';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.check_zone_keeps_model_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  problems text[];
begin
  for m in
    -- for update: waits for a concurrent publish of this model; the row read after the wait is
    -- the committed one, so `published` and the base values are current.
    select id, published, base_path, base_width, base_height from public.models
    where id in (
      case when tg_op <> 'INSERT' then old.model_id end,
      case when tg_op <> 'DELETE' then new.model_id end
    )
    order by id
    for update
  loop
    if m.published then
      problems := private.publish_problems(m.id, m.base_path, m.base_width, m.base_height);
      if cardinality(problems) > 0 then
        raise exception 'Model cannot be published: %', array_to_string(problems, ', ')
          using errcode = 'check_violation', hint = 'publish_rules';
      end if;
    end if;
  end loop;
  return null;
end;
$$;

-- Deactivating a color that a published model uses as a default.
create function private.check_swatch_keeps_models_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  m record;
  problems text[];
begin
  for m in
    select distinct mo.id, mo.base_path, mo.base_width, mo.base_height
    from public.models mo join public.model_zones z on z.model_id = mo.id
    where mo.published and z.default_swatch_id = new.id
  loop
    problems := private.publish_problems(m.id, m.base_path, m.base_width, m.base_height);
    if cardinality(problems) > 0 then
      raise exception 'Model cannot be published: %', array_to_string(problems, ', ')
        using errcode = 'check_violation', hint = 'publish_rules';
    end if;
  end loop;
  return null;
end;
$$;

create trigger swatches_keep_models_publishable after update of active on public.swatches
  for each row when (old.active and not new.active)
  execute function private.check_swatch_keeps_models_publishable();

revoke execute on function private.check_swatch_keeps_models_publishable() from public, anon, authenticated;

update public.models m
set published = false
where published
  and cardinality(private.publish_problems(m.id, m.base_path, m.base_width, m.base_height)) > 0;
