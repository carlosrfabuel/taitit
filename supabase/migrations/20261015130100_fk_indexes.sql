-- Indexes for foreign keys flagged by the Supabase performance advisor, so deleting a
-- swatch or a model doesn't scan whole tables to clear references.
create index if not exists model_zones_default_swatch_id_idx on public.model_zones (default_swatch_id);
create index if not exists orders_model_id_idx on public.orders (model_id);
