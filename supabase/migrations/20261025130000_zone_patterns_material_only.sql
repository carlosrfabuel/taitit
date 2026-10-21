-- The stale-pattern trigger (20261025120000) also dropped the pattern when the layer changed and the
-- pattern path did not: a tool re-upload whose pattern file came out identical would lose it. The panel,
-- the only other writer of layers, clears the pattern itself when it uploads a new layer; the trigger
-- now only drops it from a zone that is no longer acetate.

create or replace function private.clear_stale_zone_pattern()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.pattern_path is not null and new.material <> 'acetate' then
    new.pattern_path := null;
    new.pattern_width := null;
    new.pattern_height := null;
    new.pattern_hex := null;
    new.pattern_own := false;
  end if;
  return new;
end;
$$;
