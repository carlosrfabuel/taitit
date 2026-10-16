-- PLACEHOLDER palettes until the client's color chart arrives.
-- Names, HEX values and references are invented; replace them with the real chart.
-- Idempotent: safe to run more than once.

insert into public.swatches (material, name, hex, ref, kind, alpha, finishes, sort_order)
values
  -- Metal: 16 colors, each available in gloss and matte
  ('metal', 'Black', '#1E1E22', 'PH-M01', 'metal', null, '{gloss,matte}', 1),
  ('metal', 'Graphite', '#3B3E45', 'PH-M02', 'metal', null, '{gloss,matte}', 2),
  ('metal', 'Gunmetal', '#5C5F66', 'PH-M03', 'metal', null, '{gloss,matte}', 3),
  ('metal', 'Silver', '#B9BDC4', 'PH-M04', 'metal', null, '{gloss,matte}', 4),
  ('metal', 'White', '#E9E6DF', 'PH-M05', 'metal', null, '{gloss,matte}', 5),
  ('metal', 'Gold', '#C9A45C', 'PH-M06', 'metal', null, '{gloss,matte}', 6),
  ('metal', 'Rose Gold', '#D4A08A', 'PH-M07', 'metal', null, '{gloss,matte}', 7),
  ('metal', 'Bronze', '#9A7044', 'PH-M08', 'metal', null, '{gloss,matte}', 8),
  ('metal', 'Copper', '#B4673E', 'PH-M09', 'metal', null, '{gloss,matte}', 9),
  ('metal', 'Navy Blue', '#24305E', 'PH-M10', 'metal', null, '{gloss,matte}', 10),
  ('metal', 'Electric Blue', '#2F4FB8', 'PH-M11', 'metal', null, '{gloss,matte}', 11),
  ('metal', 'Forest Green', '#2E5A43', 'PH-M12', 'metal', null, '{gloss,matte}', 12),
  ('metal', 'Military Green', '#68704A', 'PH-M13', 'metal', null, '{gloss,matte}', 13),
  ('metal', 'Burgundy', '#6E1E2E', 'PH-M14', 'metal', null, '{gloss,matte}', 14),
  ('metal', 'Red', '#C0263A', 'PH-M15', 'metal', null, '{gloss,matte}', 15),
  ('metal', 'Lavender', '#A59BD2', 'PH-M16', 'metal', null, '{gloss,matte}', 16),
  -- Acetate: solid
  ('acetate', 'Neon Green', '#4CFF5A', 'PH-A01', 'solid', null, '{}', 101),
  ('acetate', 'Black', '#1E1E22', 'PH-A02', 'solid', null, '{}', 102),
  ('acetate', 'White', '#F2EFE8', 'PH-A03', 'solid', null, '{}', 103),
  ('acetate', 'Yellow', '#F2C14E', 'PH-A04', 'solid', null, '{}', 104),
  ('acetate', 'Orange', '#F07A2A', 'PH-A05', 'solid', null, '{}', 105),
  ('acetate', 'Red', '#D7263D', 'PH-A06', 'solid', null, '{}', 106),
  ('acetate', 'Blue', '#2A6FDB', 'PH-A07', 'solid', null, '{}', 107),
  ('acetate', 'Pink', '#F28FB0', 'PH-A08', 'solid', null, '{}', 108),
  ('acetate', 'Olive Green', '#7A8450', 'PH-A09', 'solid', null, '{}', 109),
  -- Acetate: translucent
  ('acetate', 'Crystal', '#F4F1EA', 'PH-A10', 'translucent', 0.45, '{}', 110),
  ('acetate', 'Smoke', '#55565C', 'PH-A11', 'translucent', 0.60, '{}', 111),
  ('acetate', 'Translucent Blue', '#4A7FD0', 'PH-A12', 'translucent', 0.55, '{}', 112),
  ('acetate', 'Translucent Pink', '#E8434F', 'PH-A13', 'translucent', 0.55, '{}', 113),
  ('acetate', 'Amber', '#E0A040', 'PH-A14', 'translucent', 0.60, '{}', 114),
  -- Acetate: tortoiseshell (texture uploaded later; HEX is the fallback color)
  ('acetate', 'Classic Havana', '#7A4A1E', 'PH-A15', 'havana', null, '{}', 115),
  ('acetate', 'Honey Havana', '#C08A3E', 'PH-A16', 'havana', null, '{}', 116)
on conflict (ref) do nothing;
