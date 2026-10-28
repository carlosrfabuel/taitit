-- Finishes (Carlos, 2026-10-27): metal colors have no matte / gloss, every acetate color has both.
-- Matte is listed first (a new pick starts with the color's first finish) and is the acetate parts'
-- default. Orders already placed keep the finish they were sent with (order_items are copies).

update public.swatches set finishes = '{}' where material = 'metal' and finishes <> '{}';
update public.swatches set finishes = '{matte,gloss}' where material = 'acetate' and finishes <> '{matte,gloss}';

update public.model_zones set default_finish = null where material = 'metal' and default_finish is not null;
update public.model_zones set default_finish = 'matte'
  where material = 'acetate' and default_finish is distinct from 'matte';

-- Saved designs: a metal part keeps its color, without a finish (the app would drop it anyway; this
-- keeps "Saved" designs from showing "Save changes").
update public.designs d
set selection = jsonb_set(d.selection, '{zones}', (
  select coalesce(jsonb_object_agg(
           e.key,
           case when z.material = 'metal' then e.value || '{"finish": null}'::jsonb else e.value end
         ), '{}'::jsonb)
  from jsonb_each(d.selection -> 'zones') e
  left join public.model_zones z on z.id::text = e.key
))
where jsonb_typeof(d.selection -> 'zones') = 'object'
  and exists (
    select 1 from jsonb_each(d.selection -> 'zones') e
    join public.model_zones z on z.id::text = e.key
    where z.material = 'metal' and e.value ->> 'finish' is not null
  );
