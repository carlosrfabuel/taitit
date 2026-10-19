-- Saved designs (Day 14).
-- The app is English (client decision): the default name follows.
alter table public.designs alter column name set default 'My design';

-- The selection is one small entry per zone (at most 4 zones): {"v":1,"zones":{"<zone id>":{"swatchId":…,"finish":…}}}.
-- A size cap keeps a client from storing arbitrary data in it.
alter table public.designs
  add constraint designs_selection_size check (octet_length(selection::text) <= 4096);

-- Names are trimmed and not blank (the app trims too; this keeps the rule for any client).
alter table public.designs
  add constraint designs_name_trimmed check (name = btrim(name));

-- "My designs" lists the newest changes first.
create index designs_user_updated_idx on public.designs (user_id, updated_at desc);
