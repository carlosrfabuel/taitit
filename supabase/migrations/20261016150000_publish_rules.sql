-- Day 7: publishing rules enforced by the database, not only by the admin panel.
--
-- A model can be published only when it is complete: a base image, 1 to 4 zones, every zone with a
-- layer of exactly the base image size and a default color. Image sizes are recorded at upload
-- (admin panel, tools/zones), so the rule can be checked here. The same check feeds the panel's
-- "Para publicar" list (rpc model_publish_problems), so both always agree.

alter table public.models
  add column base_width integer check (base_width between 1 and 10000),
  add column base_height integer check (base_height between 1 and 10000);

alter table public.model_zones
  add column layer_width integer check (layer_width between 1 and 10000),
  add column layer_height integer check (layer_height between 1 and 10000);

-- Problem codes for a model, given its base image values (NEW values when called from a trigger).
-- security definer: sees every zone regardless of the caller's RLS.
create function private.publish_problems(
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
      then 'zone_without_default_color' end
  ], null);
$$;

revoke execute on function private.publish_problems(uuid, text, integer, integer) from public, anon;
grant execute on function private.publish_problems(uuid, text, integer, integer) to authenticated;

-- For the admin panel. Invoker + RLS: returns nothing for a model the caller cannot see.
create function public.model_publish_problems(p_model_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select private.publish_problems(m.id, m.base_path, m.base_width, m.base_height)
  from public.models m
  where m.id = p_model_id;
$$;

revoke execute on function public.model_publish_problems(uuid) from public, anon;
grant execute on function public.model_publish_problems(uuid) to authenticated;

-- Publishing (or editing a published model) must leave it complete.
create function private.check_model_publishable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  problems text[];
begin
  if new.published then
    problems := private.publish_problems(new.id, new.base_path, new.base_width, new.base_height);
    if cardinality(problems) > 0 then
      raise exception 'Model cannot be published: %', array_to_string(problems, ', ')
        using errcode = 'check_violation', hint = 'publish_rules';
    end if;
  end if;
  return new;
end;
$$;

create trigger models_publishable before insert or update on public.models
  for each row execute function private.check_model_publishable();

-- Zone changes on a published model (delete, new layer, other size...) must keep it complete.
create function private.check_zone_keeps_model_publishable()
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
    select id, base_path, base_width, base_height from public.models
    where published and id in (
      case when tg_op <> 'INSERT' then old.model_id end,
      case when tg_op <> 'DELETE' then new.model_id end
    )
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

create trigger model_zones_keep_publishable after insert or update or delete on public.model_zones
  for each row execute function private.check_zone_keeps_model_publishable();

revoke execute on function private.check_model_publishable() from public, anon, authenticated;
revoke execute on function private.check_zone_keeps_model_publishable() from public, anon, authenticated;
