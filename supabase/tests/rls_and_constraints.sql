-- Security and constraint tests. Run with: npm run test:db (see supabase/tests/run.mjs).
--
-- Everything runs inside one DO block that always ends with RAISE EXCEPTION, so Postgres
-- rolls back every row it created: no test users or data are ever left in the database.
-- Each role is simulated the way Supabase does it: SET ROLE + request.jwt.claims (auth.uid()).

do $$
declare
  a constant uuid := 'aaaaaaaa-0000-4000-8000-000000000001';  -- customer A
  b constant uuid := 'bbbbbbbb-0000-4000-8000-000000000002';  -- customer B
  adm constant uuid := 'cccccccc-0000-4000-8000-000000000003'; -- admin
  m_pub uuid; m_draft uuid; sw_metal uuid; sw_acet uuid; sw_off uuid;
  o_a uuid; o_b uuid; d_b uuid; l_a uuid; l_b uuid;
  z1 uuid; z2 uuid; sel jsonb; res jsonb; res2 jsonb; k1 uuid; k2 uuid; k3 uuid; o_multi uuid;
  n integer; n2 integer; t1 timestamptz; t2 timestamptz; txt text;
  seq_before bigint; seq_after bigint;
  m_new uuid; z_new uuid; arr text[];
  passed integer := 0;
  failed text := '';

  -- Tiny assertion helpers (plpgsql has no nested functions, so they are inlined as blocks below).
begin
  -- -------------------------------------------------------------------------
  -- Setup as the database owner
  -- -------------------------------------------------------------------------
  -- Sequences ignore rollback, so test orders use explicit numbers and never call the sequence.
  -- (Restoring it with setval could rewind it below a real order created meanwhile.)
  select last_value into seq_before from public.order_number_seq;

  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values
    (a, 'test-a@example.com', '{"full_name":"Cliente A"}', 'authenticated', 'authenticated'),
    (b, 'test-b@example.com', '{"full_name":"Cliente B"}', 'authenticated', 'authenticated'),
    (adm, 'test-admin@example.com', '{}', 'authenticated', 'authenticated');
  update public.profiles set role = 'admin' where id = adm;
  -- Account approval: new accounts start pending; A is approved by TAITIT, B stays pending.
  select count(*) into n from public.profiles where id in (a, b) and status = 'pending';
  if n = 2 then passed := passed + 1; else failed := failed || E'\n1 new accounts do not start pending'; end if;
  -- Business details typed at sign-up arrive as metadata: trimmed, cut to the limits, blank = none.
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values ('eeeeeeee-0000-4000-8000-000000000005', 'test-e@example.com',
    jsonb_build_object('full_name', 'Ana', 'business_name', '  Optica Sol  ', 'tax_id', '   ', 'city', repeat('x', 200),
                       'phone', '600 000 000', 'address', 'Calle 1', 'postal_code', '46001'),
    'authenticated', 'authenticated');
  select count(*) into n from public.profiles
  where id = 'eeeeeeee-0000-4000-8000-000000000005' and business_name = 'Optica Sol' and tax_id is null
    and char_length(city) = 80 and phone = '600 000 000' and full_name = 'Ana';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n1 sign-up business details not copied (trim, limits, blanks)'; end if;
  select count(*) into n from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000005' and not private.business_complete(p);
  if n = 1 then passed := passed + 1; else failed := failed || E'\n1 details without a tax ID counted as complete'; end if;
  -- Repeated sign-up of an unconfirmed account: new sign-up data reaches the profile; once the email
  -- is confirmed, sign-up data changes no longer touch it.
  update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('business_name', 'Optica Luna', 'tax_id', 'B11111111', 'province', '')
  where id = 'eeeeeeee-0000-4000-8000-000000000005';
  select count(*) into n from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000005'
    and business_name = 'Optica Luna' and tax_id = 'B11111111' and phone = '600 000 000' and province is null;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n1 repeated sign-up (unconfirmed): new details not copied, or old ones lost'; end if;
  update auth.users set email_confirmed_at = now() where id = 'eeeeeeee-0000-4000-8000-000000000005';
  update auth.users set raw_user_meta_data = raw_user_meta_data || '{"business_name":"Changed later"}'::jsonb
  where id = 'eeeeeeee-0000-4000-8000-000000000005';
  select count(*) into n from public.profiles where id = 'eeeeeeee-0000-4000-8000-000000000005' and business_name = 'Optica Luna';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n1 confirmed account: sign-up data change overwrote the profile'; end if;
  -- White space of any kind is not a value (a tab, a no-break space).
  update public.profiles set tax_id = E'\t', business_name = 'Optica Sol' where id = 'eeeeeeee-0000-4000-8000-000000000005';
  select count(*) into n from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000005' and not private.business_complete(p);
  if n = 1 then passed := passed + 1; else failed := failed || E'\n1 a tab-only tax ID counted as filled in'; end if;
  update public.profiles set tax_id = U&'\00A0\00A0' where id = 'eeeeeeee-0000-4000-8000-000000000005';
  select count(*) into n from public.profiles p where p.id = 'eeeeeeee-0000-4000-8000-000000000005' and not private.business_complete(p);
  if n = 1 then passed := passed + 1; else failed := failed || E'\n1 a no-break-space tax ID counted as filled in'; end if;
  update public.profiles set status = 'approved' where id = a;

  -- TEST PUB is built complete (base image, zones with layers of the same size, default colors) and then
  -- published, as the publishing rules require.
  insert into public.models (name, category, base_path, base_width, base_height) values ('TEST PUB', 'Graduadas', 'test/base.jpg', 1600, 556) returning id into m_pub;
  insert into public.models (name, category, published) values ('TEST DRAFT', 'Sol', false) returning id into m_draft;
  insert into public.swatches (material, name, hex, ref, kind, finishes) values ('metal', 'T metal', '#111111', 'T-M', 'metal', '{gloss}') returning id into sw_metal;
  insert into public.swatches (material, name, hex, ref, kind) values ('acetate', 'T acet', '#222222', 'T-A', 'solid') returning id into sw_acet;
  insert into public.swatches (material, name, hex, ref, kind, active) values ('acetate', 'T off', '#333333', 'T-OFF', 'solid', false) returning id into sw_off;
  insert into public.model_zones (model_id, name, material, default_swatch_id, layer_path, layer_width, layer_height) values
    (m_pub, 'Frente', 'metal', sw_metal, 'test/frente.png', 1600, 556),
    (m_pub, 'Aros', 'acetate', sw_acet, 'test/aros.png', 1600, 556),
    (m_draft, 'Frente', 'metal', null, null, null, null);
  update public.models set published = true where id = m_pub;

  insert into public.designs (user_id, model_id, name) values (a, m_pub, 'Diseño A');
  insert into public.designs (user_id, model_id, name) values (b, m_pub, 'Diseño B') returning id into d_b;
  insert into public.orders (number, user_id, customer_name, customer_email, model_id, model_name, idempotency_key)
    values (900001, a, 'Cliente A', 'test-a@example.com', m_pub, 'TEST PUB', gen_random_uuid()) returning id into o_a;
  insert into public.orders (number, user_id, customer_name, customer_email, model_id, model_name, idempotency_key)
    values (900002, b, 'Cliente B', 'test-b@example.com', m_pub, 'TEST PUB', gen_random_uuid()) returning id into o_b;
  insert into public.order_lines (order_id, line_no, model_id, model_name, quantity) values (o_a, 1, m_pub, 'TEST PUB', 1) returning id into l_a;
  insert into public.order_lines (order_id, line_no, model_id, model_name, quantity) values (o_b, 1, m_pub, 'TEST PUB', 1) returning id into l_b;
  insert into public.order_items (order_id, line_id, zone_name, material, swatch_name, hex, ref, kind) values
    (o_a, l_a, 'Frente', 'metal', 'T metal', '#111111', 'T-M', 'metal'),
    (o_b, l_b, 'Frente', 'metal', 'T metal', '#111111', 'T-M', 'metal');

  -- 1. Sign-up trigger
  select count(*) into n from public.profiles where id in (a, b, adm) and email like 'test-%@example.com';
  if n = 3 then passed := passed + 1; else failed := failed || E'\n1 sign-up trigger did not create 3 profiles with email'; end if;
  select full_name into txt from public.profiles where id = a;
  if txt = 'Cliente A' then passed := passed + 1; else failed := failed || E'\n1 full_name not copied from metadata'; end if;
  -- A provider name longer than the column limit must be truncated, not break sign-up.
  begin
    insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values ('dddddddd-0000-4000-8000-000000000004', 'test-long@example.com',
      json_build_object('full_name', repeat('x', 300))::jsonb, 'authenticated', 'authenticated');
    select char_length(full_name) into n from public.profiles where id = 'dddddddd-0000-4000-8000-000000000004';
    if n = 120 then passed := passed + 1; else failed := failed || format(E'\n1 long name stored with length %s (expected 120)', n); end if;
  exception when others then failed := failed || E'\n1 sign-up with a long name failed: ' || sqlerrm; end;

  -- -------------------------------------------------------------------------
  -- 2. Guest (anon)
  -- -------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);

  select count(*) into n from public.models where id in (m_pub, m_draft);
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n2 guest sees %s test models (expected 1 published)', n); end if;
  select count(*) into n from public.model_zones where model_id = m_draft;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n2 guest sees zones of an unpublished model'; end if;
  select count(*) into n from public.swatches where ref = 'T-OFF';
  if n = 0 then passed := passed + 1; else failed := failed || E'\n2 guest sees an inactive swatch'; end if;
  begin perform 1 from public.profiles; failed := failed || E'\n2 guest can read profiles';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform 1 from public.orders; failed := failed || E'\n2 guest can read orders';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform 1 from public.designs; failed := failed || E'\n2 guest can read designs';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin insert into public.models (name) values ('HACK'); failed := failed || E'\n2 guest can insert models';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- -------------------------------------------------------------------------
  -- 3. Customer A
  -- -------------------------------------------------------------------------
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);

  select count(*) into n from public.profiles;
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n3 customer sees %s profiles (expected only own)', n); end if;
  update public.profiles set full_name = 'Nuevo nombre' where id = a;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 customer cannot update own name'; end if;
  begin update public.profiles set role = 'admin' where id = a; failed := failed || E'\n3 CRITICAL customer changed own role';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin update public.profiles set status = 'approved' where id = a; failed := failed || E'\n3 CRITICAL customer changed own approval status';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform public.set_account_status(b, 'approved'); failed := failed || E'\n3 CRITICAL customer approved an account';
  exception when insufficient_privilege then passed := passed + 1; end;
  update public.profiles set full_name = 'x' where id = b;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer updated another profile'; end if;
  -- A edits their own business details; never someone else's; limits enforced.
  update public.profiles set business_name = 'Optica A', tax_id = 'B12345678', phone = '600', address = 'Calle A', postal_code = '46001', city = 'Valencia', labeling = 'OPTICA A' where id = a;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 customer cannot edit own business details'; end if;
  select count(*) into n from public.profiles p where p.id = a and private.business_complete(p);
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 complete business details not recognized'; end if;
  update public.profiles set business_name = 'robado' where id = b;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer edited another account''s business details'; end if;
  begin update public.profiles set tax_id = repeat('9', 21) where id = a; failed := failed || E'\n3 over-long tax ID accepted';
  exception when check_violation then passed := passed + 1; end;
  -- Approved A: filling empty fields (above), contact changes and an unchanged save keep the approval;
  -- changing the business name or tax ID TAITIT approved sends the account back to review.
  select count(*) into n from public.profiles where id = a and status = 'approved';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 filling in empty business details removed the approval'; end if;
  update public.profiles set phone = '611 222 333', address = 'Calle B 2', city = 'Madrid', business_name = '  Optica A ' where id = a;
  select count(*) into n from public.profiles where id = a and status = 'approved';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 contact change / unchanged name removed the approval'; end if;
  update public.profiles set tax_id = 'B87654321' where id = a;
  select count(*) into n from public.profiles where id = a and status = 'pending' and reviewed_at is null and reviewed_by is null;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 approved customer changed the tax ID and stayed approved'; end if;
  perform set_config('role', 'postgres', true);
  update public.profiles set status = 'approved', reviewed_at = now() where id = a;
  perform set_config('role', 'authenticated', true);
  update public.profiles set business_name = 'Otra Optica' where id = a;
  select count(*) into n from public.profiles where id = a and status = 'pending';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 approved customer changed the business name and stayed approved'; end if;
  perform set_config('role', 'postgres', true);
  update public.profiles set status = 'approved', reviewed_at = now(), business_name = 'Optica A', tax_id = 'B12345678' where id = a;
  perform set_config('role', 'authenticated', true);

  select count(*) into n from public.designs;
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n3 customer sees %s designs (expected own 1)', n); end if;
  insert into public.designs (model_id, name) values (m_pub, 'Nuevo');
  passed := passed + 1;
  begin insert into public.designs (user_id, model_id) values (b, m_pub); failed := failed || E'\n3 customer created a design for another user';
  exception when insufficient_privilege then passed := passed + 1; end;
  update public.designs set name = 'robado' where id = d_b;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer edited another user''s design'; end if;
  delete from public.designs where id = d_b;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer deleted another user''s design'; end if;
  -- Day 14 rules: English default name, trimmed names, size cap on the stored selection.
  insert into public.designs (model_id) values (m_pub) returning name into txt;
  if txt = 'My design' then passed := passed + 1; else failed := failed || format(E'\n3 default design name is %s', txt); end if;
  begin insert into public.designs (model_id, name) values (m_pub, '  padded '); failed := failed || E'\n3 untrimmed design name accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.designs (model_id, name) values (m_pub, ' '); failed := failed || E'\n3 blank design name accepted';
  exception when check_violation then passed := passed + 1; end;
  insert into public.designs (model_id, selection)
    values (m_pub, jsonb_build_object('v', 1, 'zones', jsonb_build_object(gen_random_uuid()::text, jsonb_build_object('swatchId', gen_random_uuid()::text, 'finish', 'gloss'),
      gen_random_uuid()::text, jsonb_build_object('swatchId', gen_random_uuid()::text, 'finish', null),
      gen_random_uuid()::text, jsonb_build_object('swatchId', gen_random_uuid()::text, 'finish', 'matte'),
      gen_random_uuid()::text, jsonb_build_object('swatchId', gen_random_uuid()::text, 'finish', null))));
  passed := passed + 1; -- a real 4-zone selection fits
  begin insert into public.designs (model_id, selection) values (m_pub, jsonb_build_object('junk', repeat('x', 5000)));
    failed := failed || E'\n3 oversized design selection accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.designs (model_id, name) values (m_pub, E'\t'); failed := failed || E'\n3 tab-only design name accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.designs (model_id) values (m_draft); failed := failed || E'\n3 design created for an unpublished model';
  exception when check_violation then passed := passed + 1; end;
  begin update public.designs set model_id = m_draft where user_id = a; failed := failed || E'\n3 customer moved a design to another model';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin update public.designs set created_at = now() - interval '1 year' where user_id = a; failed := failed || E'\n3 customer rewrote a design date';
  exception when insufficient_privilege then passed := passed + 1; end;
  update public.designs set name = 'Renamed', selection = '{"v":1,"zones":{}}' where user_id = a and name = 'Nuevo';
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3 customer cannot rename / recolor own design'; end if;

  select count(*) into n from public.orders;
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n3 customer sees %s orders (expected own 1)', n); end if;
  select count(*) into n from public.order_items;
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n3 customer sees %s order items (expected own 1)', n); end if;
  select count(*) into n from public.order_lines;
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n3 customer sees %s order lines (expected own 1)', n); end if;
  begin insert into public.order_lines (order_id, line_no, model_name) values (o_a, 2, 'X'); failed := failed || E'\n3 customer added a frame to an order directly';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin insert into public.orders (user_id, model_name, idempotency_key) values (a, 'X', gen_random_uuid()); failed := failed || E'\n3 customer inserted an order directly';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin update public.orders set notes = 'x' where id = o_a; failed := failed || E'\n3 customer edited order notes';
  exception when insufficient_privilege then passed := passed + 1; end;
  select count(*) into n from public.models where id = m_draft;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer sees an unpublished model'; end if;
  begin insert into public.swatches (material, name, hex, ref, kind) values ('metal', 'h', '#000000', 'HACK', 'metal'); failed := failed || E'\n3 customer inserted a swatch';
  exception when insufficient_privilege then passed := passed + 1; end;
  update public.models set name = 'HACKED' where id = m_pub;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer renamed a model'; end if;
  -- The admin panel's login guard is only UI: the database itself must refuse customer model writes.
  begin insert into public.models (name) values ('HACK CUSTOMER'); failed := failed || E'\n3 customer created a model';
  exception when insufficient_privilege then passed := passed + 1; end;
  -- Inner block: always undone, so a broken policy is reported here instead of breaking later checks.
  begin
    delete from public.models where id = m_pub;
    get diagnostics n = row_count;
    raise exception 'undo:%', n;
  exception when raise_exception then
    if sqlerrm = 'undo:0' then passed := passed + 1; else failed := failed || E'\n3 customer deleted a model'; end if;
  end;

  -- Storage: own folder only
  begin insert into storage.objects (bucket_id, name, owner_id) values ('orders', a::text || '/11111111-2222-4333-8444-555555555555.jpg', a::text); passed := passed + 1;
  exception when others then failed := failed || E'\n3 customer cannot upload to own order folder: ' || sqlerrm; end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('orders', b::text || '/11111111-2222-4333-8444-555555555555.jpg', a::text); failed := failed || E'\n3 customer uploaded into another user''s folder';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('orders', a::text || '/test.png', a::text); failed := failed || E'\n3 order image with a free-form name accepted';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('models', 'hack.png', a::text); failed := failed || E'\n3 customer uploaded a catalog image';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- 3b. Orders with several frames (20261028120000): create_order_lines, and create_order (one frame,
  -- the app version already installed) on top of it. Real order numbers come from a sequence that
  -- rollback does not rewind, so these orders take theirs from a sequence created (and dropped) here.
  perform set_config('role', 'postgres', true);
  create sequence public.test_order_seq start with 900100;
  alter table public.orders alter column number set default nextval('public.test_order_seq');
  select id into z1 from public.model_zones where model_id = m_pub and name = 'Frente';
  select id into z2 from public.model_zones where model_id = m_pub and name = 'Aros';
  perform set_config('role', 'authenticated', true);
  sel := jsonb_build_object('v', 1, 'zones', jsonb_build_object(
    z1::text, jsonb_build_object('swatchId', sw_metal, 'hex', '#111111', 'ref', 'T-M', 'name', 'T metal', 'kind', 'metal', 'finish', 'gloss'),
    z2::text, jsonb_build_object('swatchId', sw_acet, 'hex', '#222222', 'ref', 'T-A', 'name', 'T acet', 'kind', 'solid')));
  k1 := gen_random_uuid(); k2 := gen_random_uuid(); k3 := gen_random_uuid();
  insert into storage.objects (bucket_id, name, owner_id) values
    ('orders', a::text || '/' || k1 || '.jpg', a::text),
    ('orders', a::text || '/' || k2 || '.jpg', a::text),
    ('orders', a::text || '/' || k3 || '.jpg', a::text);

  res := public.create_order_lines(k3, jsonb_build_array(
    jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 2, 'image_key', k1),
    jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 3, 'image_key', k2)), '  Paciente 12 ', 'REF-9');
  o_multi := (res ->> 'id')::uuid;
  if (res ->> 'created')::boolean and (res ->> 'number')::integer >= 900100 then passed := passed + 1; else failed := failed || E'\n3b two-frame order not created: ' || res::text; end if;
  select count(*) into n from public.orders
    where id = o_multi and quantity = 5 and model_name = 'TEST PUB' and notes = 'Paciente 12' and shop_ref = 'REF-9'
      and image_path = a::text || '/' || k1 || '.jpg' and business_name = 'Optica A';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3b order summary wrong (total frames, names, first image, notes, optician)'; end if;
  select count(*) into n from public.order_lines
    where order_id = o_multi and ((line_no = 1 and quantity = 2 and image_path = a::text || '/' || k1 || '.jpg')
                               or (line_no = 2 and quantity = 3 and image_path = a::text || '/' || k2 || '.jpg'));
  if n = 2 then passed := passed + 1; else failed := failed || format(E'\n3b %s of 2 frames stored right', n); end if;
  select count(*) into n from public.order_items i join public.order_lines l on l.id = i.line_id
    where i.order_id = o_multi and l.order_id = o_multi
      and ((i.zone_name = 'Frente' and i.ref = 'T-M' and i.finish = 'gloss')
        or (i.zone_name = 'Aros' and i.ref = 'T-A' and i.finish is null));
  if n = 4 then passed := passed + 1; else failed := failed || format(E'\n3b %s of 4 parts stored on their frame', n); end if;
  -- Both test zones share sort_order 0, so which one is first follows their ids: only check 0, 1 per frame.
  select count(*) into n from public.order_lines l
    where l.order_id = o_multi and (select array_agg(i.sort_order order by i.sort_order) from public.order_items i where i.line_id = l.id) = '{0,1}';
  if n = 2 then passed := passed + 1; else failed := failed || E'\n3b parts of a frame not numbered 0, 1'; end if;
  -- Retry / double tap: same key returns the same order, writes nothing.
  res2 := public.create_order_lines(k3, '[]'::jsonb);
  select count(*) into n from public.orders where idempotency_key = k3;
  if res2 ->> 'id' = res ->> 'id' and not (res2 ->> 'created')::boolean and n = 1 then passed := passed + 1; else failed := failed || E'\n3b retry with the same key ordered again'; end if;
  select count(*) into n from public.order_lines;
  if n = 3 then passed := passed + 1; else failed := failed || format(E'\n3b customer sees %s order lines (expected own 3)', n); end if;

  -- Refused, and nothing written: bad line lists, quantities, images, models, colors.
  select count(*) into n2 from public.orders;
  begin perform public.create_order_lines(gen_random_uuid(), '[]'::jsonb); failed := failed || E'\n3b empty order accepted';
  exception when check_violation then if sqlerrm = 'order_lines_invalid' then passed := passed + 1; else failed := failed || E'\n3b empty order: ' || sqlerrm; end if; end;
  begin perform public.create_order_lines(gen_random_uuid(), (select jsonb_agg(jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1)) from generate_series(1, 51))); failed := failed || E'\n3b 51 frames accepted';
  exception when check_violation then if sqlerrm = 'order_lines_invalid' then passed := passed + 1; else failed := failed || E'\n3b 51 frames: ' || sqlerrm; end if; end;
  begin perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 100, 'image_key', k1))); failed := failed || E'\n3b quantity 100 accepted';
  exception when check_violation then if sqlerrm = 'order_quantity_invalid' then passed := passed + 1; else failed := failed || E'\n3b quantity 100: ' || sqlerrm; end if; end;
  begin perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1.5, 'image_key', k1))); failed := failed || E'\n3b quantity 1.5 accepted';
  exception when check_violation then if sqlerrm = 'order_quantity_invalid' then passed := passed + 1; else failed := failed || E'\n3b quantity 1.5: ' || sqlerrm; end if; end;
  begin perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1),
      jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1))); failed := failed || E'\n3b two frames with one image accepted';
  exception when check_violation then if sqlerrm = 'order_image_missing' then passed := passed + 1; else failed := failed || E'\n3b shared image: ' || sqlerrm; end if; end;
  begin perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1),
      jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', gen_random_uuid()))); failed := failed || E'\n3b frame without uploaded image accepted';
  exception when check_violation then if sqlerrm = 'order_image_missing' then passed := passed + 1; else failed := failed || E'\n3b missing image: ' || sqlerrm; end if; end;
  begin perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1),
      jsonb_build_object('model_id', m_draft, 'selection', sel, 'quantity', 1, 'image_key', k2))); failed := failed || E'\n3b frame of an unpublished model accepted';
  exception when check_violation then if sqlerrm = 'order_model_unavailable' then passed := passed + 1; else failed := failed || E'\n3b unpublished model: ' || sqlerrm; end if; end;
  begin perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(
      jsonb_build_object('model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1),
      jsonb_build_object('model_id', m_pub, 'selection', jsonb_set(sel, array['zones', z2::text, 'hex'], '"#999999"'), 'quantity', 1, 'image_key', k2))); failed := failed || E'\n3b changed color accepted';
  exception when check_violation then if sqlerrm = 'order_colors_changed' then passed := passed + 1; else failed := failed || E'\n3b changed color: ' || sqlerrm; end if; end;
  select count(*) into n from public.orders;
  if n = n2 then passed := passed + 1; else failed := failed || E'\n3b a refused order left rows behind'; end if;

  -- The installed app's call: one frame, image named after the order key, quantity kept.
  k1 := gen_random_uuid();
  insert into storage.objects (bucket_id, name, owner_id) values ('orders', a::text || '/' || k1 || '.jpg', a::text);
  res := public.create_order(k1, m_pub, sel, null, null, 4);
  select count(*) into n from public.orders o join public.order_lines l on l.order_id = o.id
    where o.id = (res ->> 'id')::uuid and o.quantity = 4 and l.line_no = 1 and l.quantity = 4
      and l.image_path = a::text || '/' || k1 || '.jpg' and o.image_path = l.image_path
      and (select count(*) from public.order_items i where i.line_id = l.id) = 2;
  if (res ->> 'created')::boolean and n = 1 then passed := passed + 1; else failed := failed || E'\n3b old create_order did not place a one-frame order'; end if;

  -- 3c. Customizing form per frame (20261029130000): whole mm 1-200, labeling <= 25, notes <= 500.
  k2 := gen_random_uuid();
  insert into storage.objects (bucket_id, name, owner_id) values ('orders', a::text || '/' || k2 || '.jpg', a::text);
  res := public.create_order_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object(
    'model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k2,
    'form', jsonb_build_object('templeLength', 140, 'bridgeSize', 18, 'ringSizeA', 52, 'ringSizeB', 40,
                               'templeLabeling', '  JUAN P.  ', 'notes', ' Lentes 1.6 ', 'unusedButNull', null) - 'unusedButNull')));
  select count(*) into n from public.order_lines
    where order_id = (res ->> 'id')::uuid and temple_length = 140 and bridge_size = 18 and ring_size_a = 52
      and ring_size_b = 40 and temple_labeling = 'JUAN P.' and notes = 'Lentes 1.6';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3c customizing form not stored (trimmed) on its frame'; end if;
  k3 := gen_random_uuid();
  insert into storage.objects (bucket_id, name, owner_id) values ('orders', a::text || '/' || k3 || '.jpg', a::text);
  res := public.create_order_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object(
    'model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k3,
    'form', jsonb_build_object('templeLength', null, 'templeLabeling', '   ', 'notes', ''))));
  select count(*) into n from public.order_lines
    where order_id = (res ->> 'id')::uuid and temple_length is null and bridge_size is null and temple_labeling is null and notes is null;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n3c empty form fields not stored as empty'; end if;
  select count(*) into n2 from public.orders;
  for txt in select unnest(array[
    '{"templeLength": 201}', '{"bridgeSize": 0}', '{"ringSizeA": 52.5}', '{"ringSizeB": "40"}',
    '{"templeLabeling": "ABCDEFGHIJKLMNOPQRSTUVWXYZ"}', '{"notes": 5}', '{"colour": "red"}', '"140"'
  ]) loop
    begin
      perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object(
        'model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1, 'form', txt::jsonb)));
      failed := failed || E'\n3c invalid form accepted: ' || txt;
    exception when check_violation then
      if sqlerrm = 'order_form_invalid' then passed := passed + 1; else failed := failed || E'\n3c ' || txt || ': ' || sqlerrm; end if;
    end;
  end loop;
  begin
    perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object(
      'model_id', m_pub, 'selection', sel, 'quantity', 1, 'image_key', k1, 'form', jsonb_build_object('notes', repeat('x', 501)))));
    failed := failed || E'\n3c frame notes over 500 characters accepted';
  exception when check_violation then passed := passed + 1; end;
  select count(*) into n from public.orders;
  if n = n2 then passed := passed + 1; else failed := failed || E'\n3c a refused form left an order behind'; end if;
  begin update public.order_lines set temple_labeling = 'HACK' where order_id = o_a; get diagnostics n = row_count;
    if n = 0 then passed := passed + 1; else failed := failed || E'\n3c customer edited a frame form after ordering'; end if;
  exception when insufficient_privilege then passed := passed + 1; end;

  perform set_config('role', 'postgres', true);
  alter table public.orders alter column number set default nextval('public.order_number_seq');
  drop sequence public.test_order_seq;
  perform set_config('role', 'authenticated', true);

  -- Customer B cannot read A's order image
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  -- B is pending approval: may not upload order images (nor order: create_order checks the same rule).
  begin insert into storage.objects (bucket_id, name, owner_id) values ('orders', b::text || '/11111111-2222-4333-8444-555555555555.jpg', b::text); failed := failed || E'\n3 pending account uploaded an order image';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform public.create_order(gen_random_uuid(), m_pub, '{}'::jsonb); failed := failed || E'\n3 pending account placed an order';
  exception when insufficient_privilege then
    if sqlerrm = 'account_not_approved' then passed := passed + 1; else failed := failed || E'\n3 pending order refused for the wrong reason: ' || sqlerrm; end if;
  end;
  begin perform public.create_order_lines(gen_random_uuid(), jsonb_build_array(jsonb_build_object('model_id', m_pub, 'selection', '{}'::jsonb, 'quantity', 1, 'image_key', gen_random_uuid()))); failed := failed || E'\n3 pending account placed a multi-frame order';
  exception when insufficient_privilege then
    if sqlerrm = 'account_not_approved' then passed := passed + 1; else failed := failed || E'\n3 pending multi-frame order refused for the wrong reason: ' || sqlerrm; end if;
  end;
  select count(*) into n from storage.objects where bucket_id = 'orders' and name = a::text || '/11111111-2222-4333-8444-555555555555.jpg';
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer B can see customer A''s order image'; end if;
  select count(*) into n from public.order_lines where order_id = o_multi;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3b customer B can see customer A''s frames'; end if;

  -- -------------------------------------------------------------------------
  -- 4. Admin
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);

  -- Admin approves B (and can undo it); never their own account.
  if public.set_account_status(b, 'approved') = 'approved' then passed := passed + 1; else failed := failed || E'\n4 admin approval returned a wrong status'; end if;
  select count(*) into n from public.profiles where id = b and status = 'approved' and reviewed_by = adm and reviewed_at is not null;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4 approval not recorded (status, reviewer, date)'; end if;
  perform public.set_account_status(b, 'rejected');
  select count(*) into n from public.profiles where id = b and status = 'rejected';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4 admin cannot reject an account'; end if;
  begin perform public.set_account_status(adm, 'rejected'); failed := failed || E'\n4 admin changed their own account status';
  exception when check_violation then passed := passed + 1; end;

  select count(*) into n from public.profiles where id in (a, b, adm);
  if n = 3 then passed := passed + 1; else failed := failed || format(E'\n4 admin sees %s of 3 test profiles', n); end if;
  select count(*) into n from public.models where id in (m_pub, m_draft);
  if n = 2 then passed := passed + 1; else failed := failed || E'\n4 admin does not see unpublished models'; end if;
  select count(*) into n from public.orders where id in (o_a, o_b);
  if n = 2 then passed := passed + 1; else failed := failed || E'\n4 admin does not see all orders'; end if;
  select count(*) into n from storage.objects where bucket_id = 'orders' and name = a::text || '/11111111-2222-4333-8444-555555555555.jpg';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4 admin cannot see order images'; end if;
  select count(*) into n from public.designs where id = d_b;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n4 admin can read private designs'; end if;
  insert into storage.objects (bucket_id, name, owner_id) values ('models', 'test/catalog.png', adm::text);
  select count(*) into n from storage.objects where bucket_id = 'models' and name = 'test/catalog.png';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4 admin cannot read catalog files (needed to replace/delete them)'; end if;

  -- Orders have no status and are read-only once created, for the admin too.
  begin update public.orders set notes = 'x' where id = o_a; failed := failed || E'\n4 admin edited an order';
  exception when insufficient_privilege then passed := passed + 1; end;
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'orders' and column_name like 'status%')
    then passed := passed + 1; else failed := failed || E'\n4 orders still have a status column'; end if;
  begin update public.profiles set role = 'customer' where id = a; failed := failed || E'\n4 admin changed a role through the API (should be manual only)';
  exception when insufficient_privilege then passed := passed + 1; end;

  insert into public.swatches (material, name, hex, ref, kind) values ('acetate', 'Admin nuevo', '#444444', 'T-NEW', 'solid');
  passed := passed + 1;
  insert into public.model_zones (model_id, name, material, default_swatch_id, layer_path, layer_width, layer_height) values
    (m_pub, 'Puente', 'metal', sw_metal, 'test/puente.png', 1600, 556),
    (m_pub, 'Patillas', 'metal', sw_metal, 'test/patillas.png', 1600, 556);
  passed := passed + 1;
  begin insert into public.model_zones (model_id, name, material) values (m_pub, 'Quinta', 'acetate'); failed := failed || E'\n4 a 5th zone was accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.model_zones (model_id, name, material, default_swatch_id) values (m_draft, 'Aros', 'acetate', sw_metal); failed := failed || E'\n4 zone accepted a default swatch of the wrong material';
  exception when check_violation then passed := passed + 1; end;
  -- Zone roles (2026-10-20): main metal is metal, tips are acetate, one zone per role and model.
  begin insert into public.model_zones (model_id, name, material, role) values (m_draft, 'Main', 'acetate', 'main'); failed := failed || E'\n4 an acetate "main metal" zone was accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.model_zones (model_id, name, material, role) values (m_draft, 'Tips', 'metal', 'tips'); failed := failed || E'\n4 metal tips were accepted';
  exception when check_violation then passed := passed + 1; end;
  insert into public.model_zones (model_id, name, material, role) values (m_draft, 'Secondary A', 'metal', 'secondary');
  passed := passed + 1; -- the secondary front can be metal
  begin insert into public.model_zones (model_id, name, material, role) values (m_draft, 'Secondary B', 'acetate', 'secondary'); failed := failed || E'\n4 a second "secondary front" on one model was accepted';
  exception when unique_violation then passed := passed + 1; end;
  delete from public.model_zones where model_id = m_draft and name = 'Secondary A';

  -- -------------------------------------------------------------------------
  -- 4b. Publishing rules (as admin): only complete models can be published, and stay complete
  -- -------------------------------------------------------------------------
  arr := public.model_publish_problems(m_draft);
  if arr @> array['no_base_image', 'zone_without_layer', 'zone_without_default_color'] then passed := passed + 1;
  else failed := failed || format(E'\n4b draft problems are %s', arr); end if;
  arr := public.model_publish_problems(m_pub);
  if arr = '{}' then passed := passed + 1; else failed := failed || format(E'\n4b complete model has problems %s', arr); end if;

  insert into public.models (name, base_path, base_width, base_height) values ('TEST NEW', 'test/new.jpg', 1600, 556) returning id into m_new;
  begin update public.models set published = true where id = m_new; failed := failed || E'\n4b model without zones was published';
  exception when check_violation then
    if sqlerrm like '%no_zones%' then passed := passed + 1; else failed := failed || E'\n4b wrong error: ' || sqlerrm; end if;
  end;
  insert into public.model_zones (model_id, name, material, default_swatch_id, layer_path, layer_width, layer_height)
    values (m_new, 'Frente', 'metal', sw_metal, 'test/new-frente.png', 800, 556) returning id into z_new;
  begin update public.models set published = true where id = m_new; failed := failed || E'\n4b layer of another size was published';
  exception when check_violation then
    if sqlerrm like '%layer_size_mismatch%' then passed := passed + 1; else failed := failed || E'\n4b wrong error: ' || sqlerrm; end if;
  end;
  update public.model_zones set layer_width = 1600 where id = z_new;
  update public.models set published = true where id = m_new;
  passed := passed + 1; -- complete model publishes
  begin update public.model_zones set layer_width = 100 where id = z_new; failed := failed || E'\n4b published model got a layer of another size';
  exception when check_violation then passed := passed + 1; end;
  begin update public.models set base_width = 2000 where id = m_new; failed := failed || E'\n4b published model got a base image of another size';
  exception when check_violation then passed := passed + 1; end;
  begin update public.model_zones set default_swatch_id = null where id = z_new; failed := failed || E'\n4b published zone lost its default color';
  exception when check_violation then passed := passed + 1; end;
  begin delete from public.model_zones where id = z_new; failed := failed || E'\n4b last zone of a published model was deleted';
  exception when check_violation then passed := passed + 1; end;
  update public.models set published = false where id = m_new;
  delete from public.model_zones where id = z_new;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4b zone of an unpublished model could not be deleted'; end if;
  -- Deleting a whole published model (zones cascade) must not be blocked by the zone rule.
  insert into public.models (name, base_path, base_width, base_height) values ('TEST DEL', 'test/del.jpg', 1600, 556) returning id into m_new;
  insert into public.model_zones (model_id, name, material, default_swatch_id, layer_path, layer_width, layer_height)
    values (m_new, 'Frente', 'metal', sw_metal, 'test/del-frente.png', 1600, 556);
  update public.models set published = true where id = m_new;
  delete from public.models where id = m_new;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4b published model could not be deleted'; end if;

  -- The problems list is for admins: customers get nothing for drafts, guests cannot call it.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  if public.model_publish_problems(m_draft) is null then passed := passed + 1;
  else failed := failed || E'\n4b customer read problems of a draft model'; end if;
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin arr := public.model_publish_problems(m_draft); failed := failed || E'\n4b guest called model_publish_problems';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- -------------------------------------------------------------------------
  -- 5. Constraints (as owner)
  -- -------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

  -- 4c. Publishing rules, review fixes (as owner: one check needs to switch a trigger off)
  -- A published model from before the rules (made here with the trigger off) can still be reordered
  -- and renamed; only publishing again or changing its base image runs the check.
  alter table public.models disable trigger models_publishable;
  insert into public.models (name, published, base_path) values ('TEST LEGACY', true, 'test/legacy.jpg') returning id into m_new;
  alter table public.models enable trigger models_publishable;
  update public.models set sort_order = 99, name = 'TEST LEGACY 2' where id = m_new;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4c older published model cannot be reordered or renamed'; end if;
  begin update public.models set base_path = 'test/legacy2.jpg' where id = m_new; failed := failed || E'\n4c older published model got a new base image without the check';
  exception when check_violation then passed := passed + 1; end;
  delete from public.models where id = m_new;
  -- Default colors must be active.
  begin update public.swatches set active = false where id = sw_metal; failed := failed || E'\n4c color used by a published model was deactivated';
  exception when check_violation then passed := passed + 1; end;
  begin delete from public.swatches where id = sw_acet; failed := failed || E'\n4c color used by a published model was deleted';
  exception when check_violation then passed := passed + 1; end;
  insert into public.models (name, base_path, base_width, base_height) values ('TEST INACTIVE', 'test/i.jpg', 1600, 556) returning id into m_new;
  insert into public.model_zones (model_id, name, material, default_swatch_id, layer_path, layer_width, layer_height)
    values (m_new, 'Aros', 'acetate', sw_off, 'test/i-aros.png', 1600, 556);
  if private.publish_problems(m_new, 'test/i.jpg', 1600, 556) = array['default_color_inactive'] then passed := passed + 1;
  else failed := failed || format(E'\n4c inactive default not reported: %s', private.publish_problems(m_new, 'test/i.jpg', 1600, 556)); end if;
  begin update public.models set published = true where id = m_new; failed := failed || E'\n4c model with an inactive default color was published';
  exception when check_violation then passed := passed + 1; end;
  delete from public.models where id = m_new;

  begin insert into public.swatches (material, name, hex, ref, kind) values ('acetate', 'x', '#555555', 'T-TR', 'translucent'); failed := failed || E'\n5 translucent swatch without alpha accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.swatches (material, name, hex, ref, kind) values ('acetate', 'x', '#555555', 'T-MK', 'metal'); failed := failed || E'\n5 metal kind on acetate accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.swatches (material, name, hex, ref, kind) values ('metal', 'x', 'red', 'T-HEX', 'metal'); failed := failed || E'\n5 invalid HEX accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.swatches (material, name, hex, ref, kind) values ('metal', 'x', '#555555', 'T-M', 'metal'); failed := failed || E'\n5 duplicate reference accepted';
  exception when unique_violation then passed := passed + 1; end;
  begin update public.models set published = true where id = m_draft; failed := failed || E'\n5 model published without base image';
  exception when check_violation then passed := passed + 1; end;
  -- Order numbers come from the sequence (checked by definition, so the test never consumes numbers).
  select pg_get_expr(d.adbin, d.adrelid) into txt
  from pg_attrdef d join pg_attribute att on att.attrelid = d.adrelid and att.attnum = d.adnum
  where d.adrelid = 'public.orders'::regclass and att.attname = 'number';
  select start_value into n from pg_sequences where schemaname = 'public' and sequencename = 'order_number_seq';
  if txt like '%nextval(%order_number_seq%' and n = 1001 then passed := passed + 1;
  else failed := failed || format(E'\n5 order number default is %s, start %s', txt, n); end if;
  begin
    insert into public.orders (number, user_id, model_name, idempotency_key) values (900003, a, 'X', '11111111-1111-4111-8111-111111111111');
    insert into public.orders (number, user_id, model_name, idempotency_key) values (900004, a, 'X', '11111111-1111-4111-8111-111111111111');
    failed := failed || E'\n5 duplicate idempotency key accepted';
  exception when unique_violation then passed := passed + 1; end;

  create table public._test_default_privileges (id integer);
  if not has_table_privilege('anon', 'public._test_default_privileges', 'select')
     and not has_table_privilege('authenticated', 'public._test_default_privileges', 'select') then
    passed := passed + 1;
  else failed := failed || E'\n5 a new table is automatically exposed to the API roles'; end if;

  -- A color used as a zone default keeps its material (zone rule: same material).
  begin update public.swatches set material = 'acetate', kind = 'solid', finishes = '{}' where id = sw_metal;
    failed := failed || E'\n5 material of a color in use changed';
  exception when check_violation then passed := passed + 1; end;
  update public.swatches set name = 'T metal renamed' where id = sw_metal;
  passed := passed + 1; -- other edits of a color in use still work

  -- -------------------------------------------------------------------------
  -- 5b. Tortoiseshell patterns for havana colors (zone_patterns migrations)
  -- -------------------------------------------------------------------------
  -- A pattern needs all its fields, and its average color as #RRGGBB.
  begin update public.model_zones set pattern_path = 'test/aros-pattern.jpg' where model_id = m_pub and name = 'Aros';
    failed := failed || E'\n5b a pattern without size and color was accepted';
  exception when check_violation then passed := passed + 1; end;
  begin update public.model_zones set pattern_path = 'test/aros-pattern.jpg', pattern_width = 1600, pattern_height = 556, pattern_hex = 'brown'
    where model_id = m_pub and name = 'Aros';
    failed := failed || E'\n5b a bad pattern color was accepted';
  exception when check_violation then passed := passed + 1; end;
  -- A complete pattern of the base image's size, on a published model: accepted.
  update public.model_zones set pattern_path = 'test/aros-pattern.jpg', pattern_width = 1600, pattern_height = 556,
    pattern_hex = '#483932', pattern_own = true where model_id = m_pub and name = 'Aros';
  select count(*) into n from public.model_zones where model_id = m_pub and name = 'Aros' and pattern_own and pattern_hex = '#483932';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5b a valid pattern was not saved'; end if;
  -- Guests read it (the app draws it).
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  select count(*) into n from public.model_zones where model_id = m_pub and pattern_path = 'test/aros-pattern.jpg' and pattern_hex = '#483932';
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5b guests cannot read the pattern'; end if;
  -- A published model can't get a pattern of another size; a metal zone can't get one at all.
  begin update public.model_zones set pattern_width = 800 where model_id = m_pub and name = 'Aros';
    failed := failed || E'\n5b a pattern of another size was accepted on a published model';
  exception when check_violation then passed := passed + 1; end;
  -- (an update is dropped by the trigger; an insert is refused by the check)
  update public.model_zones set pattern_path = 'test/frente-pattern.jpg', pattern_width = 1600, pattern_height = 556, pattern_hex = '#111111'
    where model_id = m_pub and name = 'Frente';
  select count(*) into n from public.model_zones where model_id = m_pub and name = 'Frente' and pattern_path is null;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5b a metal zone kept a pattern'; end if;
  begin insert into public.model_zones (model_id, name, material, pattern_path, pattern_width, pattern_height, pattern_hex)
      values (m_draft, 'Metal con patrón', 'metal', 'test/x.jpg', 1600, 556, '#111111');
    failed := failed || E'\n5b a metal zone was created with a pattern';
  exception when check_violation then passed := passed + 1; end;
  -- A new layer written by the tool keeps the pattern written with it (the panel clears it itself).
  update public.model_zones set layer_path = 'test/aros-v2.png' where model_id = m_pub and name = 'Aros';
  select count(*) into n from public.model_zones where model_id = m_pub and name = 'Aros' and pattern_path = 'test/aros-pattern.jpg';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5b a layer change dropped the pattern'; end if;
  -- A zone that becomes metal drops its pattern instead of failing.
  insert into public.model_zones (model_id, name, material, pattern_path, pattern_width, pattern_height, pattern_hex, pattern_own)
    values (m_draft, 'Terminales', 'acetate', 'test/t-pattern.jpg', 1600, 556, '#524040', true) returning id into z_new;
  update public.model_zones set material = 'metal' where id = z_new;
  select count(*) into n from public.model_zones where id = z_new and pattern_path is null and pattern_hex is null and pattern_width is null and not pattern_own;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5b a zone turned metal kept its pattern'; end if;
  -- Publishing checks the pattern size like the layers'.
  insert into public.models (name, category, base_path, base_width, base_height) values ('TEST PAT', 'Sol', 'test/b2.jpg', 1600, 556) returning id into m_new;
  insert into public.model_zones (model_id, name, material, default_swatch_id, layer_path, layer_width, layer_height, pattern_path, pattern_width, pattern_height, pattern_hex)
    values (m_new, 'Aros', 'acetate', sw_acet, 'test/a2.png', 1600, 556, 'test/p2.jpg', 800, 278, '#483932');
  arr := private.publish_problems(m_new, 'test/b2.jpg', 1600, 556);
  if arr = array['pattern_size_mismatch'] then passed := passed + 1; else failed := failed || E'\n5b publish problems: ' || array_to_string(arr, ','); end if;
  begin update public.models set published = true where id = m_new;
    failed := failed || E'\n5b a model with a pattern of another size was published';
  exception when check_violation then passed := passed + 1; end;

  -- -------------------------------------------------------------------------
  -- 5c. Registration fields (20261026120000): name for the glasses, contact email, bank account,
  --     delivery and commercial addresses (none = same as the main address)
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, raw_user_meta_data, aud, role)
  values ('ffffffff-0000-4000-8000-000000000006', 'test-f@example.com',
    jsonb_build_object('full_name', 'Fe', 'labeling', '  OPTICA FE  ', 'contact_email', ' facturas@optica-fe.es ',
      'bank_account', 'ES12 3456 7890', 'delivery_address', 'Almacen 3', 'delivery_postal_code', '46980', 'delivery_city', 'Paterna',
      'commercial_address', 'Gran Via 1', 'commercial_city', 'Madrid'),
    'authenticated', 'authenticated');
  select count(*) into n from public.profiles
  where id = 'ffffffff-0000-4000-8000-000000000006' and labeling = 'OPTICA FE' and contact_email = 'facturas@optica-fe.es'
    and bank_account = 'ES12 3456 7890' and delivery_address = 'Almacen 3' and delivery_postal_code = '46980'
    and delivery_city = 'Paterna' and delivery_province is null
    and commercial_address is null and commercial_postal_code is null and commercial_city is null;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5c sign-up: new fields not copied, or an incomplete commercial address kept'; end if;
  -- Never a failed sign-up: an invalid contact email is dropped, a long value cut to the limit.
  begin
    insert into auth.users (id, email, raw_user_meta_data, aud, role)
    values ('ffffffff-0000-4000-8000-000000000007', 'test-g@example.com',
      jsonb_build_object('contact_email', 'not-an-email', 'labeling', repeat('x', 100)), 'authenticated', 'authenticated');
    select count(*) into n from public.profiles
    where id = 'ffffffff-0000-4000-8000-000000000007' and contact_email is null and char_length(labeling) = 60;
    if n = 1 then passed := passed + 1; else failed := failed || E'\n5c sign-up: invalid contact email kept or long name for the glasses not cut'; end if;
  exception when others then failed := failed || E'\n5c sign-up with an invalid contact email failed: ' || sqlerrm; end;
  begin update public.profiles set contact_email = 'nope' where id = 'ffffffff-0000-4000-8000-000000000006';
    failed := failed || E'\n5c invalid contact email accepted';
  exception when check_violation then passed := passed + 1; end;
  begin update public.profiles set delivery_address = null where id = 'ffffffff-0000-4000-8000-000000000006';
    failed := failed || E'\n5c delivery address without its street accepted';
  exception when check_violation then passed := passed + 1; end;
  begin update public.profiles set commercial_city = 'Madrid' where id = 'ffffffff-0000-4000-8000-000000000006';
    failed := failed || E'\n5c commercial address with only a city accepted';
  exception when check_violation then passed := passed + 1; end;
  begin update public.profiles set delivery_city = U&'\00A0' where id = 'ffffffff-0000-4000-8000-000000000006';
    failed := failed || E'\n5c delivery city of only a no-break space accepted';
  exception when check_violation then passed := passed + 1; end;
  begin update public.profiles set bank_account = repeat('1', 43) where id = 'ffffffff-0000-4000-8000-000000000006';
    failed := failed || E'\n5c over-long bank account accepted';
  exception when check_violation then passed := passed + 1; end;
  update public.profiles set delivery_address = null, delivery_postal_code = null, delivery_city = null, delivery_province = null
  where id = 'ffffffff-0000-4000-8000-000000000006';
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5c delivery address cannot go back to "same as the main one"'; end if;
  -- Required to order: the name for the glasses, like the other required details.
  update public.profiles set business_name = 'Optica Fe', tax_id = 'B22222222', phone = '600', address = 'Calle F',
    postal_code = '46001', city = 'Valencia' where id = 'ffffffff-0000-4000-8000-000000000006';
  select count(*) into n from public.profiles p where p.id = 'ffffffff-0000-4000-8000-000000000006' and private.business_complete(p);
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5c complete details with a name for the glasses not recognized'; end if;
  update public.profiles set labeling = '   ' where id = 'ffffffff-0000-4000-8000-000000000006';
  select count(*) into n from public.profiles p where p.id = 'ffffffff-0000-4000-8000-000000000006' and not private.business_complete(p);
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5c details without a name for the glasses counted as complete'; end if;
  -- The customer edits their own new fields (column grants), never someone else's.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', 'ffffffff-0000-4000-8000-000000000006', 'role', 'authenticated')::text, true);
  update public.profiles set labeling = 'OPTICA FE 2', contact_email = 'otro@optica-fe.es', bank_account = null,
    commercial_address = 'Gran Via 1', commercial_postal_code = '28013', commercial_city = 'Madrid'
  where id = 'ffffffff-0000-4000-8000-000000000006';
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n5c customer cannot edit own registration fields'; end if;
  update public.profiles set labeling = 'robado' where id = a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n5c customer edited another account''s name for the glasses'; end if;
  perform set_config('role', 'postgres', true);

  -- -------------------------------------------------------------------------
  -- 5d. Color references are unique within their material (20261026130000): metal 2F and acetate 2F
  -- -------------------------------------------------------------------------
  begin
    insert into public.swatches (material, name, hex, ref, kind) values ('acetate', 'T same ref', '#444444', 'T-M', 'solid');
    passed := passed + 1;
  exception when unique_violation then failed := failed || E'\n5d an acetate cannot reuse a metal''s reference'; end;
  begin
    insert into public.swatches (material, name, hex, ref, kind) values ('metal', 'T dup', '#555555', 'T-M', 'metal');
    failed := failed || E'\n5d two metals with the same reference accepted';
  exception when unique_violation then passed := passed + 1; end;

  -- -------------------------------------------------------------------------
  -- 6. Account deletion: from the app with delete_my_account() (Day 20), default rule for the data
  -- -------------------------------------------------------------------------
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
  begin perform public.delete_my_account(); failed := failed || E'\n6 a guest could call delete_my_account';
  exception when insufficient_privilege then passed := passed + 1; end;
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);
  begin perform public.delete_my_account(); failed := failed || E'\n6 an admin deleted their own account from the app';
  exception when insufficient_privilege then
    if sqlerrm = 'admin_account' then passed := passed + 1; else failed := failed || E'\n6 admin refused for the wrong reason: ' || sqlerrm; end if;
  end;
  -- TAITIT deletes an account on request (delete_customer_account): admins only, customers only.
  begin perform public.delete_customer_account(adm); failed := failed || E'\n6 an admin deleted their own account from the panel';
  exception when check_violation then passed := passed + 1; end;
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  begin perform public.delete_customer_account(a); failed := failed || E'\n6 CRITICAL a customer deleted another account';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin perform public.delete_customer_account(adm); failed := failed || E'\n6 CRITICAL a customer deleted the admin';
  exception when insufficient_privilege then passed := passed + 1; end;
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.delete_my_account();
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  select count(*) into n from auth.users where id = a;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n6 delete_my_account left the user'; end if;
  select count(*) into n from auth.users where id in (b, adm);
  if n = 2 then passed := passed + 1; else failed := failed || E'\n6 deleting A touched other accounts'; end if;
  select count(*) into n from public.profiles where id = a;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n6 profile kept after account deletion'; end if;
  select count(*) into n from public.designs where user_id = a;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n6 designs kept after account deletion'; end if;
  select count(*) into n from public.orders where id = o_a and user_id is null and customer_email = 'test-a@example.com';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n6 order not kept with email copy and cleared user_id'; end if;
  select count(*) into n from public.order_lines where order_id = o_multi;
  if n = 2 then passed := passed + 1; else failed := failed || E'\n6 frames of an order lost with the account'; end if;

  select last_value into seq_after from public.order_number_seq;
  if seq_after = seq_before then passed := passed + 1; else failed := failed || E'\n7 the test consumed order numbers'; end if;

  -- Always roll back: report through the exception message.
  if failed = '' then
    raise exception 'RESULT: PASS % checks (all test data rolled back)', passed;
  else
    raise exception 'RESULT: FAIL (% passed)%', passed, failed;
  end if;
end;
$$;
