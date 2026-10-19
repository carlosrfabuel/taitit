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
  texturePath: string | null;
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
      texturePath: swatch.kind === 'havana' ? swatch.texturePath : null,
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

// ---------------------------------------------------------------------------
// Placing an order (Day 17)
// ---------------------------------------------------------------------------

/**
 * What the order is placed with: per part, the color and finish plus every detail the customer saw
 * (and the order image shows). The server refuses the order if any of them is no longer true.
 */
export type OrderSelection = {
  v: 1;
  zones: Record<
    string,
    {
      swatchId: string;
      finish: Finish | null;
      hex: string;
      ref: string;
      name: string;
      kind: SwatchKind;
      alpha: number | null;
      texturePath: string | null;
    }
  >;
};

export const linesToSelection = (lines: OrderLine[]): OrderSelection => ({
  v: 1,
  zones: Object.fromEntries(
    lines.map((l) => [
      l.zoneId,
      {
        swatchId: l.swatchId,
        finish: l.finish,
        hex: l.hex,
        ref: l.ref,
        name: l.swatchName,
        kind: l.kind,
        alpha: l.alpha,
        texturePath: l.texturePath,
      },
    ]),
  ),
});

/**
 * Identity of what is ordered: same model and same lines = same content. Used to keep one order
 * key per content until that order succeeds (see pendingOrders.ts).
 */
export const orderContentKey = (userId: string, modelId: string, lines: OrderLine[]) =>
  JSON.stringify([
    userId,
    modelId,
    lines.map((l) => [
      l.zoneId,
      l.swatchId,
      l.finish,
      l.hex,
      l.ref,
      l.swatchName,
      l.kind,
      l.alpha,
      l.texturePath,
    ]),
  ]);

/**
 * Creates the order (database function: one transaction, colors recomputed on the server). The same
 * key returns the order already created, so retries and double taps never order twice.
 */
export async function placeOrder(input: {
  key: string;
  modelId: string;
  selection: OrderSelection;
  notes: string | null;
  shopRef: string | null;
}): Promise<{ id: string; number: number; created: boolean }> {
  const { data, error } = await supabase.rpc('create_order', {
    p_key: input.key,
    p_model_id: input.modelId,
    p_selection: input.selection,
    ...(input.notes ? { p_notes: input.notes } : {}),
    ...(input.shopRef ? { p_shop_ref: input.shopRef } : {}),
  });
  if (error) throw error;
  const result = data as { id: string; number: number; created: boolean };
  return { id: result.id, number: result.number, created: result.created };
}

/** What to tell the customer when placing an order fails. */
export function orderErrorMessage(error: unknown): string {
  const message = (error as { message?: string } | null)?.message ?? '';
  if (message.includes('order_colors_changed'))
    return 'Some colors changed in the meantime. Review your design and try again.';
  if (message.includes('order_model_unavailable')) return 'This model is no longer available.';
  if (message.includes('row-level security') || message.includes('Unauthorized'))
    return "Couldn't upload the order image. Please contact TAITIT.";
  if (message.includes('order_image_missing') || message.includes('snapshot_failed'))
    return "Couldn't prepare the order image. Check your connection and try again.";
  return "Couldn't send the order. Check your connection and try again.";
}

// ---------------------------------------------------------------------------
// Sent orders (My orders)
// ---------------------------------------------------------------------------

export type OrderItem = {
  zoneName: string;
  material: Material;
  swatchName: string;
  hex: string;
  ref: string;
  finish: Finish | null;
  kind: SwatchKind;
  alpha: number | null;
  /** Public link to the tortoiseshell texture used (havana only). */
  textureUrl: string | null;
};

export type Order = {
  id: string;
  number: number;
  modelName: string;
  notes: string | null;
  shopRef: string | null;
  createdAt: string;
  imagePath: string | null;
  /** Temporary link to the private image (valid for an hour), null if it can't be made. */
  imageUrl: string | null;
  items: OrderItem[];
};

export const orderKeys = {
  all: ['orders'] as const,
  list: (userId: string) => ['orders', userId] as const,
  one: (userId: string, id: string) => ['orders', userId, id] as const,
};

const ORDER_COLUMNS =
  'id, number, model_name, notes, shop_ref, created_at, image_path, order_items(zone_name, material, swatch_name, hex, ref, finish, kind, alpha, texture_path, sort_order)';

type OrderRow = {
  id: string;
  number: number;
  model_name: string;
  notes: string | null;
  shop_ref: string | null;
  created_at: string;
  image_path: string | null;
  order_items: {
    zone_name: string;
    material: Material;
    swatch_name: string;
    hex: string;
    ref: string;
    finish: Finish | null;
    kind: SwatchKind;
    alpha: number | null;
    texture_path: string | null;
    sort_order: number;
  }[];
};

async function withImageUrls(rows: OrderRow[]): Promise<Order[]> {
  const paths = rows.map((r) => r.image_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    // One request for every image; a failure only leaves the images out.
    const { data } = await supabase.storage.from('orders').createSignedUrls(paths, 3600);
    for (const u of data ?? []) if (u.path && u.signedUrl) urls.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    modelName: r.model_name,
    notes: r.notes,
    shopRef: r.shop_ref,
    createdAt: r.created_at,
    imagePath: r.image_path,
    imageUrl: r.image_path ? (urls.get(r.image_path) ?? null) : null,
    items: [...r.order_items]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((i) => ({
        zoneName: i.zone_name,
        material: i.material,
        swatchName: i.swatch_name,
        hex: i.hex,
        ref: i.ref,
        finish: i.finish,
        kind: i.kind,
        alpha: i.alpha,
        textureUrl: i.texture_path
          ? supabase.storage.from('textures').getPublicUrl(i.texture_path).data.publicUrl
          : null,
      })),
  }));
}

/** Most recent orders listed (older ones: later, if anyone needs them). */
export const ORDERS_LIMIT = 100;

/**
 * The user's own orders, newest first. Filtered by user: an admin can read every order (database
 * rule for the admin panel), but "My orders" must only list their own.
 */
export async function fetchOrders(userId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(ORDERS_LIMIT);
  if (error) throw error;
  return withImageUrls(data as OrderRow[]);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the user's orders, or null if it doesn't exist, isn't theirs, or the link is malformed. */
export async function fetchOrder(userId: string, id: string): Promise<Order | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabase
    .from('orders')
    .select(ORDER_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? ((await withImageUrls([data as OrderRow]))[0] ?? null) : null;
}

/** Order summary as plain text (WhatsApp). */
export function orderText(
  order: Pick<Order, 'number' | 'modelName' | 'items' | 'shopRef' | 'notes'>,
): string {
  const finishName = { gloss: 'gloss', matte: 'matte' } as const;
  return [
    `TAITIT order #${order.number}`,
    `Model: ${order.modelName}`,
    ...order.items.map(
      (i) => `• ${i.zoneName}: ${i.swatchName}${i.finish ? ` (${finishName[i.finish]})` : ''}, ref. ${i.ref}`,
    ),
    ...(order.shopRef ? [`Reference: ${order.shopRef}`] : []),
    ...(order.notes ? [`Notes: ${order.notes}`] : []),
  ].join('\n');
}

/**
 * WhatsApp link with the summary. TAITIT's own number is still to come from the client: until then
 * WhatsApp asks which chat to send it to.
 */
export const WHATSAPP_NUMBER = '';
export const whatsappUrl = (text: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;

/** Order date as shown in My orders (e.g. Oct 18, 2026). */
export const formatOrderDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
