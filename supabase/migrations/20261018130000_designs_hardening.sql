-- Review fixes for saved designs.
-- 1. Customers only write what the app writes: a new design (model, name, selection) and later its
--    name and selection. Before, every column was writable: a client could point a design at an
--    unpublished model or rewrite its id and dates. (user_id stays protected by the policies too.)
revoke insert, update on public.designs from authenticated;
grant insert (model_id, name, selection) on public.designs to authenticated;
grant update (name, selection) on public.designs to authenticated;

-- 2. New designs only for published models (RLS on models does not apply to foreign key checks).
create function public.check_design_model() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.models where id = new.model_id and published) then
    raise exception 'design_model_unavailable' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function public.check_design_model() from public, anon, authenticated;
create trigger designs_model_check before insert on public.designs
  for each row execute function public.check_design_model();

-- 3. "Not blank" for every client: btrim only strips spaces, so a tab-only name passed.
alter table public.designs drop constraint designs_name_trimmed;
alter table public.designs
  add constraint designs_name_trimmed check (name ~ '\S' and name !~ '^\s' and name !~ '\s$');
