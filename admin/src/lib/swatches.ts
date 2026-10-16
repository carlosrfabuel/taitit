import type { Finish, Material, SwatchKind } from '@taitit/shared';
import { supabase } from './supabase';

export type SwatchRow = {
  id: string;
  material: Material;
  name: string;
  hex: string;
  ref: string;
  kind: SwatchKind;
  alpha: number | null;
  finishes: Finish[];
  active: boolean;
  sort_order: number;
};

export const swatchKeys = { all: ['swatches'] as const };

export async function listSwatches(): Promise<SwatchRow[]> {
  const { data, error } = await supabase
    .from('swatches')
    .select('id, material, name, hex, ref, kind, alpha, finishes, active, sort_order')
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data;
}
