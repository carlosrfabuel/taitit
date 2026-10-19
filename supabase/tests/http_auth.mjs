// End-to-end auth + RLS test over real HTTP against the linked Supabase project.
// Creates pre-confirmed test users directly in the database (no emails are sent), signs them in
// through Supabase Auth exactly like the app, checks access rules and storage, then deletes everything.
// Run from the mvp folder: npm run test:http   (needs app/.env with the project URL + publishable key)
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  readFileSync('app/.env', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const URL_ = env.EXPO_PUBLIC_SUPABASE_URL;
const KEY = env.EXPO_PUBLIC_SUPABASE_KEY;

function sql(query) {
  // File + relative path: the project path contains a space, which breaks shell quoting.
  const file = `supabase/tests/.tmp-${randomUUID()}.sql`;
  writeFileSync(file, query);
  try {
    const res = spawnSync('npx', ['--yes', 'supabase@2.121.0', 'db', 'query', '--linked', '-f', file], {
      encoding: 'utf8',
      shell: true,
    });
    if (res.status !== 0) throw new Error(`SQL failed: ${res.stdout}\n${res.stderr}`);
    return res.stdout;
  } finally {
    unlinkSync(file);
  }
}

const results = [];
const check = (ok, name, detail = '') => results.push({ ok: !!ok, name, detail });
const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const pw = () => randomBytes(18).toString('base64url');
const run = randomBytes(4).toString('hex');
const users = {
  a: { id: randomUUID(), email: `http-a-${run}@example.com`, password: pw(), name: 'Cliente A' },
  b: { id: randomUUID(), email: `http-b-${run}@example.com`, password: pw(), name: 'Cliente B' },
  admin: { id: randomUUID(), email: `http-admin-${run}@example.com`, password: pw(), name: 'Admin' },
  unconfirmed: {
    id: randomUUID(),
    email: `http-u-${run}@example.com`,
    password: pw(),
    name: 'Sin confirmar',
  },
};
const modelId = randomUUID();
const swatchRef = `HTTP-${run}`;
// Files uploaded during the run, per bucket; removed through the Storage API in `finally`.
const uploaded = { orders: [], models: [] };
let adminClient = null;

function userInsert(u, confirmed) {
  // Token columns must be '' (not NULL) or GoTrue fails to load the user.
  return `
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new)
values ('00000000-0000-0000-0000-000000000000', '${u.id}', 'authenticated', 'authenticated', '${u.email}',
  extensions.crypt('${u.password}', extensions.gen_salt('bf')), ${confirmed ? 'now()' : 'null'},
  '{"provider":"email","providers":["email"]}', '{"full_name":"${u.name}"}', now(), now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), '${u.id}', '${u.id}',
  '{"sub":"${u.id}","email":"${u.email}","email_verified":${confirmed}}', 'email', now(), now(), now());`;
}

async function main() {
  sql(
    [
      userInsert(users.a, true),
      userInsert(users.b, true),
      userInsert(users.admin, true),
      userInsert(users.unconfirmed, false),
      `update public.profiles set role = 'admin' where id = '${users.admin.id}';`,
      // Account approval: A is approved by TAITIT (B stays pending).
      `update public.profiles set status = 'approved' where id = '${users.a.id}';`,
      // Built complete, then published (the publishing rules reject incomplete models).
      `insert into public.models (id, name, base_path, base_width, base_height) values ('${modelId}', 'HTTP TEST ${run}', 'test/base.jpg', 1600, 556);`,
      `insert into public.model_zones (model_id, name, material, default_swatch_id, layer_path, layer_width, layer_height)
        select '${modelId}', 'Frente', 'metal', id, 'test/frente.png', 1600, 556 from public.swatches where ref = 'PH-M01';`,
      `update public.models set published = true where id = '${modelId}';`,
    ].join('\n'),
  );

  // --- Sign-in errors -------------------------------------------------------
  {
    const c = client();
    const wrong = await c.auth.signInWithPassword({ email: users.a.email, password: 'wrong-password-123' });
    check(
      wrong.error?.code === 'invalid_credentials',
      'wrong password -> invalid_credentials',
      wrong.error?.code,
    );
    const unconf = await c.auth.signInWithPassword({
      email: users.unconfirmed.email,
      password: users.unconfirmed.password,
    });
    check(
      unconf.error?.code === 'email_not_confirmed',
      'unconfirmed email -> email_not_confirmed',
      unconf.error?.code,
    );
  }

  // --- Customer A -----------------------------------------------------------
  const a = client();
  const signA = await a.auth.signInWithPassword({ email: users.a.email, password: users.a.password });
  check(!signA.error && signA.data.session, 'customer A signs in', signA.error?.message);

  const profA = await a.from('profiles').select('*');
  check(
    profA.data?.length === 1 && profA.data[0].id === users.a.id,
    'A reads only own profile',
    JSON.stringify(profA.data?.map((p) => p.email)),
  );
  check(
    profA.data?.[0]?.email === users.a.email && profA.data?.[0]?.full_name === 'Cliente A',
    'sign-up trigger copied email + name',
  );

  const roleUp = await a.from('profiles').update({ role: 'admin' }).eq('id', users.a.id);
  check(roleUp.error?.code === '42501', 'A cannot change own role (42501)', roleUp.error?.code ?? 'NO ERROR');
  const nameUp = await a.from('profiles').update({ full_name: 'A editado' }).eq('id', users.a.id).select();
  check(
    !nameUp.error && nameUp.data?.[0]?.full_name === 'A editado',
    'A can update own name',
    nameUp.error?.message,
  );

  const models = await a.from('models').select('id').eq('id', modelId);
  check(models.data?.length === 1, 'A sees the published test model');
  const designA = await a.from('designs').insert({ model_id: modelId, name: 'Diseño A' }).select().single();
  check(
    !designA.error && designA.data?.user_id === users.a.id,
    'A saves a design (user_id set from session)',
    designA.error?.message,
  );

  // Order images: <user id>/<order attempt key>.jpg only (Day 16 rule).
  const fileA = `${users.a.id}/${randomUUID()}.jpg`;
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const upA = await a.storage.from('orders').upload(fileA, jpeg, { contentType: 'image/jpeg' });
  check(!upA.error, 'A uploads an order image to own folder', upA.error?.message);
  if (!upA.error) uploaded.orders.push(fileA);
  const upAgain = await a.storage.from('orders').upload(fileA, jpeg, { contentType: 'image/jpeg' });
  check(
    !!upAgain.error,
    'the same order image name cannot be uploaded twice',
    upAgain.error?.message ?? 'UPLOADED',
  );
  const otherName = `${users.a.id}/hack-${run}.png`;
  const upName = await a.storage.from('orders').upload(otherName, jpeg, { contentType: 'image/png' });
  check(!!upName.error, 'order images with any other name are refused', upName.error?.message ?? 'UPLOADED');
  if (!upName.error) uploaded.orders.push(otherName);
  const otherFolder = `${users.b.id}/${randomUUID()}.jpg`;
  const upOther = await a.storage.from('orders').upload(otherFolder, jpeg, { contentType: 'image/jpeg' });
  check(!!upOther.error, "A cannot upload into B's folder", upOther.error?.message ?? 'UPLOADED');
  if (!upOther.error) uploaded.orders.push(otherFolder);
  const upCatalog = await a.storage
    .from('models')
    .upload(`hack-${run}.png`, new Uint8Array([1]), { contentType: 'image/png' });
  check(!!upCatalog.error, 'A cannot upload catalog images', upCatalog.error?.message ?? 'UPLOADED');
  if (!upCatalog.error) uploaded.models.push(`hack-${run}.png`);

  const ordersA = await a.from('orders').insert({ model_name: 'X', idempotency_key: randomUUID() });
  check(
    ordersA.error?.code === '42501',
    'A cannot insert orders directly (42501)',
    ordersA.error?.code ?? 'NO ERROR',
  );

  // --- Customer B -----------------------------------------------------------
  const b = client();
  const signB = await b.auth.signInWithPassword({ email: users.b.email, password: users.b.password });
  check(!signB.error, 'customer B signs in', signB.error?.message);
  const bDesigns = await b.from('designs').select('id');
  check(bDesigns.data?.length === 0, "B cannot see A's design");
  const bEdit = await b.from('designs').update({ name: 'robado' }).eq('id', designA.data?.id).select();
  check(bEdit.data?.length === 0, "B cannot edit A's design");
  const bDl = await b.storage.from('orders').download(fileA);
  // Only meaningful if A's upload worked; otherwise the download fails for the wrong reason.
  check(
    !upA.error && !!bDl.error,
    "B cannot download A's order image",
    upA.error ? 'A upload failed' : bDl.error ? '' : 'DOWNLOADED',
  );
  const bProfiles = await b.from('profiles').select('id');
  check(bProfiles.data?.length === 1, 'B reads only own profile');

  // --- Admin ----------------------------------------------------------------
  const adm = client();
  const signAdm = await adm.auth.signInWithPassword({
    email: users.admin.email,
    password: users.admin.password,
  });
  check(!signAdm.error, 'admin signs in', signAdm.error?.message);
  if (!signAdm.error) adminClient = adm;

  // Catalog image management: upload, replace (upsert) and delete must all work for the admin.
  const cat = `catalog-${run}.png`;
  const catUp = await adm.storage
    .from('models')
    .upload(cat, new Uint8Array([137, 80, 78, 71]), { contentType: 'image/png' });
  if (!catUp.error) uploaded.models.push(cat);
  check(!catUp.error, 'admin uploads a catalog image', catUp.error?.message);
  const catUpsert = await adm.storage
    .from('models')
    .upload(cat, new Uint8Array([137, 80, 78, 71, 1]), { contentType: 'image/png', upsert: true });
  check(!catUpsert.error, 'admin replaces a catalog image (upsert)', catUpsert.error?.message);
  const catRm = await adm.storage.from('models').remove([cat]);
  check(
    !catRm.error && catRm.data?.length === 1,
    'admin deletes a catalog image',
    catRm.error?.message ?? `removed ${catRm.data?.length}`,
  );
  if (!catRm.error && catRm.data?.length === 1) uploaded.models = uploaded.models.filter((p) => p !== cat);
  const allProfiles = await adm
    .from('profiles')
    .select('id')
    .in(
      'id',
      Object.values(users).map((u) => u.id),
    );
  check(allProfiles.data?.length === 4, 'admin reads all test profiles', String(allProfiles.data?.length));
  const admDl = await adm.storage.from('orders').download(fileA);
  check(!admDl.error, "admin downloads A's order image", admDl.error?.message);
  const sw = await adm
    .from('swatches')
    .insert({
      material: 'metal',
      name: 'HTTP test',
      hex: '#123456',
      ref: swatchRef,
      kind: 'metal',
      finishes: ['gloss'],
    })
    .select()
    .single();
  check(!sw.error, 'admin creates a swatch', sw.error?.message);
  const admDesigns = await adm.from('designs').select('id').eq('id', designA.data?.id);
  check(admDesigns.data?.length === 0, "admin cannot read customers' private designs");

  // --- Sign-out ---------------------------------------------------------------
  await a.auth.signOut();
  const afterOut = await a.from('profiles').select('id');
  check(
    !!afterOut.error,
    'after sign-out, A is a guest again (profiles denied)',
    afterOut.error?.code ?? 'STILL READABLE',
  );
}

let crashed = null;
try {
  await main();
} catch (e) {
  crashed = e;
} finally {
  // Remove files through the Storage API (deleting SQL rows alone would orphan the stored files).
  for (const [bucket, paths] of Object.entries(uploaded)) {
    if (!paths.length) continue;
    if (!adminClient) {
      check(false, `cleanup: ${bucket} files`, 'no admin session to remove them');
      continue;
    }
    const rm = await adminClient.storage.from(bucket).remove(paths);
    check(
      !rm.error && rm.data?.length === paths.length,
      `cleanup: ${bucket} files removed via Storage API`,
      rm.error?.message ?? `${rm.data?.length}/${paths.length}`,
    );
  }
  try {
    sql(
      `delete from public.swatches where ref = '${swatchRef}';
       delete from public.models where id = '${modelId}';
       delete from auth.users where id in (${Object.values(users)
         .map((u) => `'${u.id}'`)
         .join(',')});`,
    );
    const left = sql(
      `select (select count(*) from auth.users where email like 'http-%-${run}@example.com') as users,
              (select count(*) from storage.objects where name like '%${run}%') as files`,
    );
    const users_ = /"users":\s*(\d+)/.exec(left)?.[1];
    const files_ = /"files":\s*(\d+)/.exec(left)?.[1];
    check(
      users_ === '0' && files_ === '0',
      'cleanup: no test users or files left',
      `users=${users_} files=${files_}`,
    );
  } catch (e) {
    check(false, 'cleanup', e.message);
  }
}

for (const r of results)
  console.log(`${r.ok ? 'PASS' : 'FAIL'} ${r.name}${r.ok || !r.detail ? '' : ` (${r.detail})`}`);
if (crashed) console.log(`CRASH ${crashed.message}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed || crashed ? 1 : 0);
