-- Carlos numbers metal and acetate colors separately (2026-10-21: "aunque tengan la misma numeración,
-- al ser materiales diferentes, no importa"): metal 2F and acetate 2F are different colors. A
-- reference is unique within its material. Same constraint name, so the admin's message still applies.
alter table public.swatches drop constraint swatches_ref_key;
alter table public.swatches add constraint swatches_ref_key unique (material, ref);
