-- Catalog thumbnails (Day 9): a small JPEG of the model in its default colors, rendered by the admin
-- panel with the shared recipe. It is a cache: thumb_key fingerprints what was drawn (base image,
-- layers, colors, finishes), and the app uses the thumbnail only when the key still matches the
-- current data; otherwise it renders the model live. A stale or missing thumbnail is never shown.

alter table public.models
  add column thumb_path text,
  add column thumb_key text check (char_length(thumb_key) <= 64);
