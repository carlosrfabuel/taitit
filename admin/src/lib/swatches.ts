import type { Finish, Material, RenderSwatch, SwatchKind } from '@taitit/shared';
import { supabase } from './supabase';
import { publicUrl, removeImages, uploadImage } from './images';

export type SwatchRow = {
  id: string;
  material: Material;
  name: string;
  hex: string;
  ref: string;
  kind: SwatchKind;
  alpha: number | null;
  texture_path: string | null;
  finishes: Finish[];
  active: boolean;
  sort_order: number;
};

export type SwatchInput = {
  material: Material;
  name: string;
  hex: string;
  ref: string;
  kind: SwatchKind;
  alpha: number | null;
  finishes: Finish[];
  active: boolean;
};

/** Same limits as the check constraints on public.swatches. */
export const SWATCH_LIMITS = { name: 60, ref: 30 } as const;
const HEX = /^#[0-9A-Fa-f]{6}$/;

export const swatchKeys = { all: ['swatches'] as const };

const COLUMNS = 'id, material, name, hex, ref, kind, alpha, texture_path, finishes, active, sort_order';

export async function listSwatches(): Promise<SwatchRow[]> {
  const { data, error } = await supabase.from('swatches').select(COLUMNS).order('sort_order').order('name');
  if (error) throw error;
  return data;
}

export const textureUrl = (s: Pick<SwatchRow, 'texture_path'>) =>
  s.texture_path ? publicUrl(s.texture_path, 'textures') : null;

/** The renderer's view of a swatch (shared/src/render.ts). */
export const toRenderSwatch = (s: SwatchRow): RenderSwatch => ({
  id: s.id,
  hex: s.hex,
  kind: s.kind,
  alpha: s.alpha,
  textureUrl: textureUrl(s),
  finishes: s.finishes,
});

/** "#1e1e22", "1E1E22" → "#1E1E22"; anything else is returned as typed (and rejected by validation). */
export const normalizeHex = (v: string) => {
  const t = v.trim();
  const h = t.startsWith('#') ? t : `#${t}`;
  return HEX.test(h) ? h.toUpperCase() : t;
};

export type SwatchErrors = Partial<Record<'name' | 'hex' | 'ref' | 'alpha' | 'finishes', string>>;

export function validateSwatch(input: SwatchInput): SwatchErrors {
  const e: SwatchErrors = {};
  const name = input.name.trim();
  const ref = input.ref.trim();
  if (!name) e.name = 'Introduce el nombre del color.';
  else if (name.length > SWATCH_LIMITS.name) e.name = `Máximo ${SWATCH_LIMITS.name} caracteres.`;
  if (!HEX.test(normalizeHex(input.hex))) e.hex = 'Formato no válido. Ejemplo: #1E1E22';
  if (!ref) e.ref = 'Introduce la referencia interna.';
  else if (ref.length > SWATCH_LIMITS.ref) e.ref = `Máximo ${SWATCH_LIMITS.ref} caracteres.`;
  if (input.kind === 'translucent' && (input.alpha == null || !(input.alpha > 0 && input.alpha <= 1)))
    e.alpha = 'Indica una opacidad entre 5 % y 100 %.';
  if (input.material === 'metal' && input.finishes.length === 0) e.finishes = 'Elige al menos un acabado.';
  return e;
}

/** Database columns, consistent with the swatch rules (kind ↔ material, alpha only when translucent). */
const toColumns = (input: SwatchInput) => ({
  material: input.material,
  name: input.name.trim(),
  hex: normalizeHex(input.hex),
  ref: input.ref.trim(),
  kind: input.material === 'metal' ? ('metal' as const) : input.kind,
  alpha: input.kind === 'translucent' ? input.alpha : null,
  // Finishes are a metal choice (gloss / matte); acetate colors have none.
  finishes: input.material === 'metal' ? input.finishes : [],
  active: input.active,
});

/**
 * Creates or updates a color. A new texture is uploaded first and removed again if the database
 * refuses the row; the replaced texture is removed only after the row points to the new one.
 * `texture: null` keeps the current texture, `'remove'` clears it.
 */
export async function saveSwatch(
  swatch: SwatchRow | null,
  input: SwatchInput,
  texture: File | 'remove' | null,
  sortOrder: number,
): Promise<void> {
  const keepsTexture = input.kind === 'havana' && texture !== 'remove';
  const path =
    texture instanceof File && input.kind === 'havana'
      ? await uploadImage(
          input.ref.trim().replace(/[^A-Za-z0-9_-]/g, '_') || 'swatch',
          'texture',
          texture,
          'textures',
        )
      : null;
  const row = {
    ...toColumns(input),
    ...(path ? { texture_path: path } : keepsTexture ? {} : { texture_path: null }),
  };
  const res = swatch
    ? await supabase.from('swatches').update(row).eq('id', swatch.id).select('id')
    : await supabase
        .from('swatches')
        .insert({ ...row, sort_order: sortOrder })
        .select('id');
  if (res.error || !res.data.length) {
    await removeImages([path], 'textures');
    throw res.error ?? { code: 'not_found', message: 'Swatch not found' };
  }
  const old = swatch?.texture_path;
  if (old && (path || !keepsTexture)) await removeImages([old], 'textures');
}

export async function deleteSwatch(swatch: SwatchRow): Promise<void> {
  const { data, error } = await supabase.from('swatches').delete().eq('id', swatch.id).select('id');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Swatch not found' };
  await removeImages([swatch.texture_path], 'textures');
}
