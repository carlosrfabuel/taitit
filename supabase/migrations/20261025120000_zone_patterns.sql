-- Havana (tortoiseshell) colors drawn with a real pattern (client, 2026-10-20: "the same pattern as
-- the original"). An acetate zone can carry a pattern image, the same size as the base image:
--   pattern_own = true:  the zone's own pixels from the photo (parts that are tortoiseshell in it);
--   pattern_own = false: a real tortoiseshell pattern from another photo, shaded like this zone.
-- pattern_hex is the pattern's average color: renderers tint the pattern by (swatch color / pattern_hex),
-- so a havana color equal to pattern_hex shows the photo as it is (see shared/src/render.ts).
-- Written by tools/zones; the admin panel only reads them.

alter table public.model_zones
  add column pattern_path text,
  add column pattern_width integer check (pattern_width > 0),
  add column pattern_height integer check (pattern_height > 0),
  add column pattern_hex text check (pattern_hex ~ '^#[0-9A-F]{6}$'),
  add column pattern_own boolean not null default false,
  add constraint model_zones_pattern_complete check (
    (pattern_path is null) = (pattern_hex is null)
    and (pattern_path is null) = (pattern_width is null)
    and (pattern_path is null) = (pattern_height is null)
    and (pattern_path is not null or not pattern_own)
  ),
  add constraint model_zones_pattern_acetate check (pattern_path is null or material = 'acetate');

-- A pattern belongs to the layer it was made with: a new layer from the panel, or a zone that is no
-- longer acetate, drops it (the panel removes the file). The tool writes layer and pattern together.
-- (Narrowed to the material case in 20261025130000.)
create function private.clear_stale_zone_pattern()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pattern_path is not null and (
    new.material <> 'acetate'
    or (new.layer_path is distinct from old.layer_path and new.pattern_path is not distinct from old.pattern_path)
  ) then
    new.pattern_path := null;
    new.pattern_width := null;
    new.pattern_height := null;
    new.pattern_hex := null;
    new.pattern_own := false;
  end if;
  return new;
end;
$$;

create trigger model_zones_clear_stale_pattern before update on public.model_zones
  for each row execute function private.clear_stale_zone_pattern();

revoke execute on function private.clear_stale_zone_pattern() from public, anon, authenticated;

-- Publishing also needs every pattern to have the base image's size (like the layers).
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
    case when exists (
        select 1 from public.model_zones z
        where z.model_id = p_model_id and z.pattern_path is not null
          and (z.pattern_width is distinct from p_base_width or z.pattern_height is distinct from p_base_height)
      ) then 'pattern_size_mismatch' end,
    case when exists (select 1 from public.model_zones z where z.model_id = p_model_id and z.default_swatch_id is null)
      then 'zone_without_default_color' end,
    case when exists (
        select 1 from public.model_zones z join public.swatches s on s.id = z.default_swatch_id
        where z.model_id = p_model_id and not s.active
      ) then 'default_color_inactive' end
  ], null);
$$;
