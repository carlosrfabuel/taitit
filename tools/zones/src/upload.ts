import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import sharp from 'sharp';
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

  // 1. Check everything before writing anything: a failed upload must not touch a live model.
  const size = async (f: string) => {
    const m = await sharp(join(dir, f)).metadata();
    return { width: m.width, height: m.height };
  };
  const base = await size(manifest.base);
  for (const z of manifest.zones) {
    const s = await size(z.file);
    if (s.width !== base.width || s.height !== base.height)
      throw new Error(
        `Layer ${z.file} is ${s.width}x${s.height}, the base image is ${base.width}x${base.height}.`,
      );
  }
  const refs = manifest.zones.map((z) => z.defaultRef).filter((r): r is string => !!r);
  const swatches = refs.length
    ? await db.from('swatches').select('id, ref, active, material').in('ref', refs)
    : { data: [], error: null };
  if (swatches.error) throw new Error(swatches.error.message);
  const swatchId = new Map((swatches.data ?? []).filter((s) => s.active).map((s) => [s.ref, s.id]));
  const badRefs = refs.filter((r) => !swatchId.has(r));
  if (badRefs.length)
    throw new Error(`Default color(s) not found or inactive: ${badRefs.join(', ')}. Nothing was uploaded.`);
  const material = new Map((swatches.data ?? []).map((s) => [s.ref, s.material]));
  const wrongMaterial = manifest.zones.filter(
    (z) => z.defaultRef && material.get(z.defaultRef) !== z.material,
  );
  if (wrongMaterial.length)
    throw new Error(
      `Default color of another material: ${wrongMaterial.map((z) => `${z.label} (${z.defaultRef})`).join(', ')}. Nothing was uploaded.`,
    );
  // Every zone of a published model needs a default color (database rule): refuse now, not halfway.
  const complete = manifest.zones.every((z) => z.defaultRef);
  if (manifest.published && !complete)
    throw new Error(
      'Published models need a default color (defaultRef) on every zone. Nothing was uploaded.',
    );

  const existing = await db
    .from('models')
    .select('id, published, base_path, base_width, base_height, model_zones(id, name, layer_path)')
    .eq('name', manifest.model)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  const old = existing.data;
  const keep = new Set(manifest.zones.map((z) => z.label));
  const stale = (old?.model_zones ?? []).filter((z) => !keep.has(z.name));

  // A published model stays published while it is updated when every step keeps it complete:
  // same image size, no zone removed, and a default color on every zone. Otherwise it is saved as a
  // draft and published at the end.
  const inPlace =
    !!old?.published &&
    complete &&
    old.base_width === base.width &&
    old.base_height === base.height &&
    !stale.length;

  // 2. Files under content-based names: a changed file gets a new name (the CDN can't serve an old
  //    copy), an unchanged file keeps its name.
  const stored = new Map<string, string>();
  for (const f of [manifest.base, ...manifest.zones.map((z) => z.file)]) {
    const body = readFileSync(join(dir, f));
    const ext = extname(f);
    const path = `${manifest.slug}/${basename(f, ext)}-${createHash('sha256').update(body).digest('hex').slice(0, 10)}${ext}`;
    const res = await db.storage.from('models').upload(path, body, {
      upsert: true, // same name = same content
      contentType: ext === '.png' ? 'image/png' : 'image/jpeg',
    });
    if (res.error) throw new Error(`Upload ${f} failed: ${res.error.message}`);
    stored.set(f, path);
    console.log(`  uploaded models/${path}`);
  }

  // 3. Rows.
  const modelFields = {
    name: manifest.model,
    category: manifest.category,
    size_ref: manifest.sizeRef,
    description: manifest.description,
    base_path: stored.get(manifest.base)!,
    base_width: base.width,
    base_height: base.height,
    published: inPlace,
  };
  const model = old
    ? await db.from('models').update(modelFields).eq('id', old.id).select('id').single()
    : await db.from('models').insert(modelFields).select('id').single();
  if (model.error) throw new Error(`Model row failed: ${model.error.message}`);
  const modelId = model.data.id;
  const wasLive = !!old?.published && !inPlace;
  if (wasLive) console.log('  model is unpublished during this upload (image size or zones changed)');

  try {
    // Stale zones first, so renamed zones can't push the model over the 4-zone limit.
    if (stale.length) {
      const del = await db
        .from('model_zones')
        .delete()
        .in(
          'id',
          stale.map((z) => z.id),
        );
      if (del.error) throw new Error(del.error.message);
    }
    for (const [order, z] of manifest.zones.entries()) {
      const row = {
        model_id: modelId,
        name: z.label,
        material: z.material,
        layer_path: stored.get(z.file)!,
        layer_width: base.width,
        layer_height: base.height,
        default_swatch_id: z.defaultRef ? swatchId.get(z.defaultRef)! : null,
        default_finish: z.defaultFinish,
        sort_order: order,
      };
      const found = (old?.model_zones ?? []).find((c) => c.name === z.label);
      const res = found
        ? await db.from('model_zones').update(row).eq('id', found.id)
        : await db.from('model_zones').insert(row);
      if (res.error) throw new Error(`Zone ${z.id} failed: ${res.error.message}`);
    }
    // 4. Final published state.
    if (manifest.published !== inPlace) {
      const pub = await db.from('models').update({ published: manifest.published }).eq('id', modelId);
      if (pub.error) throw new Error(`Publish failed: ${pub.error.message}`);
    }
  } catch (e) {
    if (wasLive || manifest.published)
      console.error(`  the model is NOT published now; fix the problem and run upload again`);
    throw e;
  }

  // 5. Files no longer used (previous versions, removed zones). Best effort: leftovers are never shown.
  const used = new Set(stored.values());
  const unused = [old?.base_path, ...(old?.model_zones ?? []).map((z) => z.layer_path)].filter(
    (p): p is string => !!p && !used.has(p),
  );
  if (unused.length) {
    const rm = await db.storage.from('models').remove(unused);
    if (rm.error) console.warn(`  warning: could not remove old files: ${rm.error.message}`);
    else console.log(`  removed ${unused.length} old file(s)`);
  }

  console.log(
    `  model "${manifest.model}" (${modelId}) with ${manifest.zones.length} zone(s) saved${manifest.published ? ', published' : ' (unpublished)'}`,
  );
  await db.auth.signOut();
}
