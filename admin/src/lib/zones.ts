import type { Finish, Material, ZoneRole } from '@taitit/shared';
import { supabase } from './supabase';
import { removeImages, uploadImage, type Size } from './images';

/** Same limit as the check constraint on public.model_zones.name. */
export const ZONE_NAME_MAX = 40;

export type ZoneRow = {
  id: string;
  model_id: string;
  name: string;
  material: Material;
  layer_path: string | null;
  layer_width: number | null;
  layer_height: number | null;
  default_swatch_id: string | null;
  default_finish: Finish | null;
  sort_order: number;
  role: ZoneRole | null;
  /** Tortoiseshell pattern for havana colors (written by tools/zones; see the zone_patterns migration). */
  pattern_path: string | null;
  pattern_hex: string | null;
  pattern_own: boolean;
};

export type ZoneInput = {
  name: string;
  role: ZoneRole | null;
  material: Material;
  default_swatch_id: string | null;
  default_finish: Finish | null;
};

const COLUMNS =
  'id, model_id, name, material, layer_path, layer_width, layer_height, default_swatch_id, default_finish, sort_order, role, pattern_path, pattern_hex, pattern_own';

export async function listZones(modelId: string): Promise<ZoneRow[]> {
  const { data, error } = await supabase
    .from('model_zones')
    .select(COLUMNS)
    .eq('model_id', modelId)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}

/**
 * Creates or updates a zone. A new layer is uploaded first; if the database refuses the row
 * (5th zone, wrong material, published model would break...) the new file is removed again.
 * The replaced layer file is removed only after the row points to the new one. A new layer drops the
 * zone's tortoiseshell pattern (it was made for the old one); its file goes too.
 */
export async function saveZone(
  modelId: string,
  zone: ZoneRow | null,
  input: ZoneInput,
  layer: { file: File; size: Size } | null,
  sortOrder: number,
): Promise<void> {
  // The layer and pattern stored now (the dialog may be out of date if the zone changed elsewhere).
  let previous: string | null = null;
  let previousPattern: string | null = null;
  if (zone && layer) {
    const current = await supabase
      .from('model_zones')
      .select('layer_path, pattern_path')
      .eq('id', zone.id)
      .maybeSingle();
    if (current.error) throw current.error;
    if (!current.data) throw { code: 'not_found', message: 'Zone not found' };
    previous = current.data.layer_path;
    previousPattern = current.data.pattern_path;
  }
  const path = layer ? await uploadImage(modelId, 'zone', layer.file) : null;
  const row = {
    name: input.name.trim(),
    role: input.role,
    material: input.material,
    default_swatch_id: input.default_swatch_id,
    default_finish: input.default_finish,
    ...(layer && path
      ? {
          layer_path: path,
          layer_width: layer.size.width,
          layer_height: layer.size.height,
          pattern_path: null,
          pattern_width: null,
          pattern_height: null,
          pattern_hex: null,
          pattern_own: false,
        }
      : {}),
  };
  const res = zone
    ? await supabase.from('model_zones').update(row).eq('id', zone.id).select('id')
    : await supabase
        .from('model_zones')
        .insert({ ...row, model_id: modelId, sort_order: sortOrder })
        .select('id');
  if (res.error || !res.data.length) {
    await removeImages([path]);
    throw res.error ?? { code: 'not_found', message: 'Zone not found' };
  }
  if (path && previous && previous !== path) await removeImages([previous]);
  if (path && previousPattern) await removeImages([previousPattern]);
}

export async function deleteZone(zone: ZoneRow): Promise<void> {
  const { data, error } = await supabase.from('model_zones').delete().eq('id', zone.id).select('id');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Zone not found' };
  await removeImages([zone.layer_path, zone.pattern_path]);
}

/** Every zone of every model (the thumbnail refresher checks all models at once). */
export async function listAllZones(): Promise<ZoneRow[]> {
  const { data, error } = await supabase.from('model_zones').select(COLUMNS).order('sort_order');
  if (error) throw error;
  return data;
}
