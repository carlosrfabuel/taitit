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
  o_a uuid; o_b uuid; d_b uuid;
  n integer; n2 integer; t1 timestamptz; t2 timestamptz; txt text;
  seq_before bigint; seq_after bigint;
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

  insert into public.models (name, category, base_path, published) values ('TEST PUB', 'Graduadas', 'test/base.jpg', true) returning id into m_pub;
  insert into public.models (name, category, published) values ('TEST DRAFT', 'Sol', false) returning id into m_draft;
  insert into public.swatches (material, name, hex, ref, kind, finishes) values ('metal', 'T metal', '#111111', 'T-M', 'metal', '{gloss}') returning id into sw_metal;
  insert into public.swatches (material, name, hex, ref, kind) values ('acetate', 'T acet', '#222222', 'T-A', 'solid') returning id into sw_acet;
  insert into public.swatches (material, name, hex, ref, kind, active) values ('acetate', 'T off', '#333333', 'T-OFF', 'solid', false) returning id into sw_off;
  insert into public.model_zones (model_id, name, material, default_swatch_id) values
    (m_pub, 'Frente', 'metal', sw_metal), (m_pub, 'Aros', 'acetate', sw_acet), (m_draft, 'Frente', 'metal', null);

  insert into public.designs (user_id, model_id, name) values (a, m_pub, 'Diseño A');
  insert into public.designs (user_id, model_id, name) values (b, m_pub, 'Diseño B') returning id into d_b;
  insert into public.orders (number, user_id, customer_name, customer_email, model_id, model_name, idempotency_key)
    values (900001, a, 'Cliente A', 'test-a@example.com', m_pub, 'TEST PUB', gen_random_uuid()) returning id into o_a;
  insert into public.orders (number, user_id, customer_name, customer_email, model_id, model_name, idempotency_key)
    values (900002, b, 'Cliente B', 'test-b@example.com', m_pub, 'TEST PUB', gen_random_uuid()) returning id into o_b;
  insert into public.order_items (order_id, zone_name, material, swatch_name, hex, ref, kind) values
    (o_a, 'Frente', 'metal', 'T metal', '#111111', 'T-M', 'metal'),
    (o_b, 'Frente', 'metal', 'T metal', '#111111', 'T-M', 'metal');
  -- Backdate so the status test can prove the trigger refreshes this timestamp.
  update public.orders set status_updated_at = '2000-01-01' where id = o_a;

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
  update public.profiles set full_name = 'x' where id = b;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer updated another profile'; end if;

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

  select count(*) into n from public.orders;
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n3 customer sees %s orders (expected own 1)', n); end if;
  select count(*) into n from public.order_items;
  if n = 1 then passed := passed + 1; else failed := failed || format(E'\n3 customer sees %s order items (expected own 1)', n); end if;
  update public.orders set status = 'delivered' where id = o_a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer changed an order status'; end if;
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
  begin insert into storage.objects (bucket_id, name, owner_id) values ('orders', a::text || '/test.png', a::text); passed := passed + 1;
  exception when others then failed := failed || E'\n3 customer cannot upload to own order folder: ' || sqlerrm; end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('orders', b::text || '/test.png', a::text); failed := failed || E'\n3 customer uploaded into another user''s folder';
  exception when insufficient_privilege then passed := passed + 1; end;
  begin insert into storage.objects (bucket_id, name, owner_id) values ('models', 'hack.png', a::text); failed := failed || E'\n3 customer uploaded a catalog image';
  exception when insufficient_privilege then passed := passed + 1; end;

  -- Customer B cannot read A's order image
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select count(*) into n from storage.objects where bucket_id = 'orders' and name = a::text || '/test.png';
  if n = 0 then passed := passed + 1; else failed := failed || E'\n3 customer B can see customer A''s order image'; end if;

  -- -------------------------------------------------------------------------
  -- 4. Admin
  -- -------------------------------------------------------------------------
  perform set_config('request.jwt.claims', json_build_object('sub', adm, 'role', 'authenticated')::text, true);

  select count(*) into n from public.profiles where id in (a, b, adm);
  if n = 3 then passed := passed + 1; else failed := failed || format(E'\n4 admin sees %s of 3 test profiles', n); end if;
  select count(*) into n from public.models where id in (m_pub, m_draft);
  if n = 2 then passed := passed + 1; else failed := failed || E'\n4 admin does not see unpublished models'; end if;
  select count(*) into n from public.orders where id in (o_a, o_b);
  if n = 2 then passed := passed + 1; else failed := failed || E'\n4 admin does not see all orders'; end if;
  select count(*) into n from storage.objects where bucket_id = 'orders' and name = a::text || '/test.png';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4 admin cannot see order images'; end if;
  select count(*) into n from public.designs where id = d_b;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n4 admin can read private designs'; end if;
  insert into storage.objects (bucket_id, name, owner_id) values ('models', 'test/catalog.png', adm::text);
  select count(*) into n from storage.objects where bucket_id = 'models' and name = 'test/catalog.png';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4 admin cannot read catalog files (needed to replace/delete them)'; end if;

  select status_updated_at into t1 from public.orders where id = o_a;
  update public.orders set status = 'in_production' where id = o_a;
  get diagnostics n = row_count;
  select status_updated_at into t2 from public.orders where id = o_a;
  if n = 1 then passed := passed + 1; else failed := failed || E'\n4 admin cannot change order status'; end if;
  if t1 = '2000-01-01' and t2 > t1 then passed := passed + 1; else failed := failed || E'\n4 status_updated_at not maintained'; end if;
  begin update public.profiles set role = 'customer' where id = a; failed := failed || E'\n4 admin changed a role through the API (should be manual only)';
  exception when insufficient_privilege then passed := passed + 1; end;

  insert into public.swatches (material, name, hex, ref, kind) values ('acetate', 'Admin nuevo', '#444444', 'T-NEW', 'solid');
  passed := passed + 1;
  insert into public.model_zones (model_id, name, material) values (m_pub, 'Puente', 'metal'), (m_pub, 'Patillas', 'metal');
  passed := passed + 1;
  begin insert into public.model_zones (model_id, name, material) values (m_pub, 'Quinta', 'acetate'); failed := failed || E'\n4 a 5th zone was accepted';
  exception when check_violation then passed := passed + 1; end;
  begin insert into public.model_zones (model_id, name, material, default_swatch_id) values (m_draft, 'Aros', 'acetate', sw_metal); failed := failed || E'\n4 zone accepted a default swatch of the wrong material';
  exception when check_violation then passed := passed + 1; end;

  -- -------------------------------------------------------------------------
  -- 5. Constraints (as owner)
  -- -------------------------------------------------------------------------
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);

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

  -- -------------------------------------------------------------------------
  -- 6. Account deletion (default rule)
  -- -------------------------------------------------------------------------
  delete from auth.users where id = a;
  select count(*) into n from public.profiles where id = a;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n6 profile kept after account deletion'; end if;
  select count(*) into n from public.designs where user_id = a;
  if n = 0 then passed := passed + 1; else failed := failed || E'\n6 designs kept after account deletion'; end if;
  select count(*) into n from public.orders where id = o_a and user_id is null and customer_email = 'test-a@example.com';
  if n = 1 then passed := passed + 1; else failed := failed || E'\n6 order not kept with email copy and cleared user_id'; end if;

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
