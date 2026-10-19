import type { Finish, Material, SwatchKind } from '@taitit/shared';
import type { CatalogModel, CatalogSwatch } from '@/catalog/catalog';
import { currentPick } from '@/customize/customizer';
import { restorePicks, type Selection } from '@/designs/designs';
import { supabase } from '@/lib/supabase';

/** Limits (database: orders.notes ≤ 1000, orders.shop_ref ≤ 60 characters). */
export const NOTES_MAX = 1000;
export const SHOP_REF_MAX = 60;

/** Width of the order image (the full photo width of today's models; enough for print and email). */
export const ORDER_IMAGE_WIDTH = 1600;

/** One customizable part as it will be ordered (the same fields order_items stores). */
export type OrderLine = {
  zoneId: string;
  zoneName: string;
  material: Material;
  swatchId: string;
  swatchName: string;
  hex: string;
  ref: string;
  kind: SwatchKind;
  alpha: number | null;
  textureUrl: string | null;
  finish: Finish | null;
};

/**
 * What would be ordered for this model and selection, part by part, in zone order. Colors that are
 * no longer available fall back to the zone default and are listed in `replaced` (the customer must
 * see that before confirming). Parts without any available color are listed in `missing`: such an
 * order can't be confirmed.
 */
export function orderLines(
  model: CatalogModel,
  swatches: CatalogSwatch[],
  selection: Selection,
): { lines: OrderLine[]; replaced: string[]; missing: string[] } {
  const zones = model.zones.filter((z) => z.layerUrl);
  const { picks, replaced } = restorePicks(zones, swatches, selection);
  const lines: OrderLine[] = [];
  const missing: string[] = [];
  for (const zone of zones) {
    const { swatch, finish } = currentPick(zone, swatches, picks);
    if (!swatch) {
      missing.push(zone.name);
      continue;
    }
    lines.push({
      zoneId: zone.id,
      zoneName: zone.name,
      material: zone.material,
      swatchId: swatch.id,
      swatchName: swatch.name,
      hex: swatch.hex,
      ref: swatch.ref,
      kind: swatch.kind,
      alpha: swatch.kind === 'translucent' ? swatch.alpha : null,
      textureUrl: swatch.kind === 'havana' ? swatch.textureUrl : null,
      finish,
    });
  }
  return { lines, replaced, missing };
}

// The database counts characters (code points), not UTF-16 units.
const length = (s: string) => Array.from(s).length;

/** Trimmed notes and shop reference, or field errors. Both are optional. */
export function validateOrderInput(input: {
  notes: string;
  shopRef: string;
}): { notes: string | null; shopRef: string | null } | { errors: { notes?: string; shopRef?: string } } {
  const notes = input.notes.trim();
  const shopRef = input.shopRef.trim();
  const errors: { notes?: string; shopRef?: string } = {};
  if (length(notes) > NOTES_MAX) errors.notes = `Use at most ${NOTES_MAX} characters.`;
  if (length(shopRef) > SHOP_REF_MAX) errors.shopRef = `Use at most ${SHOP_REF_MAX} characters.`;
  if (errors.notes || errors.shopRef) return { errors };
  return { notes: notes || null, shopRef: shopRef || null };
}

/** Storage path of an order image: one per order attempt, named after its idempotency key. */
export const orderImagePath = (userId: string, key: string) => `${userId}/${key}.jpg`;

/**
 * Uploads the order image to the private bucket. A retry of the same attempt (same key) finds the
 * file already there and treats that as done: the file name is the key, so it is the same image.
 */
export async function uploadOrderImage(userId: string, key: string, jpeg: Uint8Array): Promise<string> {
  const path = orderImagePath(userId, key);
  // An ArrayBuffer holding exactly these bytes (React Native uploads ArrayBuffers reliably).
  const body = jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) as ArrayBuffer;
  const { error } = await supabase.storage
    .from('orders')
    .upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error && !isAlreadyThere(error)) throw error;
  return path;
}

const isAlreadyThere = (error: { message?: string; statusCode?: string }) =>
  error.statusCode === '409' || /already exists|duplicate/i.test(error.message ?? '');
