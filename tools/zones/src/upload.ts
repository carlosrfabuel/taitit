import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@taitit/shared';
import type { Manifest } from './cli.ts';

// Reads the project URL + publishable key from app/.env (same values the app uses).
function projectEnv() {
  const file = resolve(import.meta.dirname, '..', '..', '..', 'app', '.env');
  const env = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.startsWith('#'))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
  );
  const url = process.env.SUPABASE_URL ?? env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_KEY ?? env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) throw new Error('Missing Supabase URL/key (app/.env or SUPABASE_URL/SUPABASE_KEY).');
  return { url, key };
}

/**
 * Uploads a built model as an admin user: the same access rules as the admin panel apply
 * (no service-role key needed). Credentials come from ZONES_ADMIN_EMAIL / ZONES_ADMIN_PASSWORD.
 */
export async function upload(dir: string, manifest: Manifest) {
  const email = process.env.ZONES_ADMIN_EMAIL;
  const password = process.env.ZONES_ADMIN_PASSWORD;
  if (!email || !password)
    throw new Error('Set ZONES_ADMIN_EMAIL and ZONES_ADMIN_PASSWORD (an admin account).');

  const { url, key } = projectEnv();
  const db = createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`Sign-in failed: ${signIn.error.message}`);
  const me = await db.from('profiles').select('role').eq('id', signIn.data.user.id).single();
  if (me.data?.role !== 'admin') throw new Error(`${email} is not an admin.`);

  // 1. Files -> models bucket, under the model's slug.
  const files = [manifest.base, ...manifest.zones.map((z) => z.file)];
  for (const f of files) {
    const body = readFileSync(join(dir, f));
    const res = await db.storage.from('models').upload(`${manifest.slug}/${f}`, body, {
      upsert: true,
      contentType: f.endsWith('.png') ? 'image/png' : 'image/jpeg',
    });
    if (res.error) throw new Error(`Upload ${f} failed: ${res.error.message}`);
    console.log(`  uploaded models/${manifest.slug}/${f}`);
  }

  // 2. Model row (matched by name).
  const existing = await db.from('models').select('id').eq('name', manifest.model).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const modelFields = {
    name: manifest.model,
    category: manifest.category,
    size_ref: manifest.sizeRef,
    description: manifest.description,
    base_path: `${manifest.slug}/${manifest.base}`,
    published: manifest.published,
  };
  const model = existing.data
    ? await db.from('models').update(modelFields).eq('id', existing.data.id).select('id').single()
    : await db.from('models').insert(modelFields).select('id').single();
  if (model.error) throw new Error(`Model row failed: ${model.error.message}`);
  const modelId = model.data.id;

  // 3. Zones: the database name is the Spanish label shown in the app; zones no longer in the manifest are removed.
  const refs = manifest.zones.map((z) => z.defaultRef).filter((r): r is string => !!r);
  const swatches = refs.length
    ? await db.from('swatches').select('id, ref').in('ref', refs)
    : { data: [], error: null };
  if (swatches.error) throw new Error(swatches.error.message);
  const swatchId = new Map((swatches.data ?? []).map((s) => [s.ref, s.id]));
  for (const r of refs)
    if (!swatchId.has(r)) console.warn(`  warning: default swatch ${r} not found; zone left without default`);

  const current = await db.from('model_zones').select('id, name').eq('model_id', modelId);
  if (current.error) throw new Error(current.error.message);
  const keep = new Set(manifest.zones.map((z) => z.label));
  const stale = (current.data ?? []).filter((z) => !keep.has(z.name)).map((z) => z.id);
  if (stale.length) {
    const del = await db.from('model_zones').delete().in('id', stale);
    if (del.error) throw new Error(del.error.message);
  }
  for (const [order, z] of manifest.zones.entries()) {
    const row = {
      model_id: modelId,
      name: z.label,
      material: z.material,
      layer_path: `${manifest.slug}/${z.file}`,
      default_swatch_id: z.defaultRef ? (swatchId.get(z.defaultRef) ?? null) : null,
      default_finish: z.defaultFinish,
      sort_order: order,
    };
    const found = (current.data ?? []).find((c) => c.name === z.label);
    const res = found
      ? await db.from('model_zones').update(row).eq('id', found.id)
      : await db.from('model_zones').insert(row);
    if (res.error) throw new Error(`Zone ${z.id} failed: ${res.error.message}`);
  }
  console.log(
    `  model "${manifest.model}" (${modelId}) with ${manifest.zones.length} zone(s) saved${manifest.published ? ', published' : ' (unpublished)'}`,
  );
  await db.auth.signOut();
}
