import type { Finish, Material, ZoneRole } from '@taitit/shared';
import { supabase } from './supabase';

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
 * Saves a zone's settings (name, role, material, default color and finish). Its shape (layer and
 * pattern) is made and uploaded with the zone tool.
 */
export async function saveZone(zoneId: string, input: ZoneInput): Promise<void> {
  const { data, error } = await supabase
    .from('model_zones')
    .update({
      name: input.name.trim(),
      role: input.role,
      material: input.material,
      default_swatch_id: input.default_swatch_id,
      default_finish: input.default_finish,
    })
    .eq('id', zoneId)
    .select('id');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Zone not found' };
}

/** Every zone of every model (the thumbnail refresher checks all models at once). */
export async function listAllZones(): Promise<ZoneRow[]> {
  const { data, error } = await supabase.from('model_zones').select(COLUMNS).order('sort_order');
  if (error) throw error;
  return data;
}
