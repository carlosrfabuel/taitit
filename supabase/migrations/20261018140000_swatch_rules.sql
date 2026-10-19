-- Review fixes for colors (swatches).

-- 1. Deactivating a color vs publishing a model at the same time: both checks used to read the other
--    side's old state, so both could commit and leave a published model with an inactive default.
--    Now the deactivation locks every model that uses the color as a default (in id order, so two
--    deactivations can't deadlock). A concurrent publish holds that row: the lock waits for it and
--    the row is re-read, published or not, before the check. A publish that comes second waits for
--    this lock and then sees the color as inactive (publish_problems).
create or replace function private.check_swatch_keeps_models_publishable()
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
    select mo.id, mo.published, mo.base_path, mo.base_width, mo.base_height
    from public.models mo
    where exists (select 1 from public.model_zones z where z.model_id = mo.id and z.default_swatch_id = new.id)
    order by mo.id
    for update
  loop
    continue when not m.published;
    problems := private.publish_problems(m.id, m.base_path, m.base_width, m.base_height);
    if cardinality(problems) > 0 then
      raise exception 'Model cannot be published: %', array_to_string(problems, ', ')
        using errcode = 'check_violation', hint = 'publish_rules';
    end if;
  end loop;
  return null;
end;
$$;

-- 2. A color's material can't change while a zone uses it as its default: the zone rule
--    (zone material = color material) is only checked when a zone is written.
create function private.check_swatch_material()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.model_zones where default_swatch_id = new.id) then
    raise exception 'swatch_material_in_use' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_swatch_material() from public, anon, authenticated;
create trigger swatches_material_in_use before update of material on public.swatches
  for each row when (old.material is distinct from new.material)
  execute function private.check_swatch_material();
