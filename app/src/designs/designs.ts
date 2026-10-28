import type { Finish, Json } from '@taitit/shared';
import type { CatalogSwatch, CatalogZone } from '@/catalog/catalog';
import { currentPick, type Picks } from '@/customize/customizer';
import { supabase } from '@/lib/supabase';

/** Name limits (database: 1..60 characters, trimmed). */
export const NAME_MAX = 60;

/**
 * What a design stores: the color and finish of every zone, not only the changed ones, so a design
 * reopens exactly as saved even if the admin later changes the model's default colors.
 */
export type Selection = { v: 1; zones: Record<string, { swatchId: string; finish: Finish | null }> };

export type Design = {
  id: string;
  modelId: string;
  name: string;
  selection: Selection;
  createdAt: string;
  updatedAt: string;
};

/** The design as it looks now: every zone with its current color. */
export function toSelection(zones: CatalogZone[], swatches: CatalogSwatch[], picks: Picks): Selection {
  const out: Selection = { v: 1, zones: {} };
  for (const zone of zones) {
    const { swatch, finish } = currentPick(zone, swatches, picks);
    if (swatch) out.zones[zone.id] = { swatchId: swatch.id, finish };
  }
  return out;
}

const FINISHES: (Finish | null)[] = ['gloss', 'matte', null];

/** Reads a stored selection defensively (it is JSON from the database): anything malformed is dropped. */
export function parseSelection(value: Json | unknown): Selection {
  const out: Selection = { v: 1, zones: {} };
  const zones = (value as { zones?: unknown } | null)?.zones;
  if (!zones || typeof zones !== 'object' || Array.isArray(zones)) return out;
  for (const [zoneId, entry] of Object.entries(zones as Record<string, unknown>)) {
    const e = entry as { swatchId?: unknown; finish?: unknown } | null;
    if (!e || typeof e.swatchId !== 'string') continue;
    const finish = (FINISHES as unknown[]).includes(e.finish ?? null)
      ? ((e.finish ?? null) as Finish | null)
      : null;
    out.zones[zoneId] = { swatchId: e.swatchId, finish };
  }
  return out;
}

/**
 * Picks to open a saved design with: exactly the stored colors and finishes (a stored "no finish"
 * stays none). A zone whose saved color is no longer offered (deactivated, or of another material)
 * shows its default color; a saved finish the color no longer offers becomes the color's first one.
 * Both are listed in `replaced`, so the customer can be told. Zones added to the model after saving
 * show their default; zones removed are ignored.
 */
export function restorePicks(
  zones: CatalogZone[],
  swatches: CatalogSwatch[],
  selection: Selection,
): { picks: Picks; replaced: string[] } {
  const picks: Picks = {};
  const replaced: string[] = [];
  for (const zone of zones) {
    const saved = selection.zones[zone.id];
    if (!saved) continue;
    const swatch = swatches.find((s) => s.id === saved.swatchId && s.material === zone.material);
    if (!swatch) {
      replaced.push(zone.name);
      continue;
    }
    const finishGone = saved.finish !== null && !swatch.finishes.includes(saved.finish);
    // Only worth telling when the color still has finishes to choose from: a color that no longer has
    // any (metal, since 2026-10-27) simply shows none.
    if (finishGone && swatch.finishes.length > 0) replaced.push(zone.name);
    picks[zone.id] = {
      swatchId: swatch.id,
      finish: finishGone ? (swatch.finishes[0] ?? null) : saved.finish,
    };
  }
  return { picks, replaced };
}

/** The stored selection limited to the model's current zones (zones removed since saving are ignored). */
export function storedFor(zones: CatalogZone[], selection: Selection): Selection {
  const out: Selection = { v: 1, zones: {} };
  for (const zone of zones) {
    const saved = selection.zones[zone.id];
    if (saved) out.zones[zone.id] = saved;
  }
  return out;
}

// The database counts characters (code points), not UTF-16 units: an emoji is one character.
const chars = (s: string) => Array.from(s);

/** "Name (copy)", kept within the name limit (never cutting a character in half). */
export function copyName(name: string) {
  const suffix = ' (copy)';
  return (
    chars(name)
      .slice(0, NAME_MAX - suffix.length)
      .join('')
      .trimEnd() + suffix
  );
}

/** Trimmed name, or an error message. */
export function validateName(name: string): { name: string } | { error: string } {
  const n = name.trim();
  if (!n) return { error: 'Enter a name.' };
  if (chars(n).length > NAME_MAX) return { error: `Use at most ${NAME_MAX} characters.` };
  return { name: n };
}

export const designKeys = {
  all: ['designs'] as const,
  list: (userId: string) => ['designs', userId] as const,
};

const COLUMNS = 'id, model_id, name, selection, created_at, updated_at';

type Row = {
  id: string;
  model_id: string;
  name: string;
  selection: Json;
  created_at: string;
  updated_at: string;
};

const fromRow = (r: Row): Design => ({
  id: r.id,
  modelId: r.model_id,
  name: r.name,
  selection: parseSelection(r.selection),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** The signed-in user's designs, newest change first (the database only returns their own). */
export async function fetchDesigns(): Promise<Design[]> {
  const { data, error } = await supabase
    .from('designs')
    .select(COLUMNS)
    .order('updated_at', { ascending: false });
  if (error) throw error;
  return data.map(fromRow);
}

export async function createDesign(input: { modelId: string; name: string; selection: Selection }) {
  const { data, error } = await supabase
    .from('designs')
    .insert({ model_id: input.modelId, name: input.name, selection: input.selection })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return fromRow(data);
}

/** Updates a design; fails when it no longer exists (deleted on another device). */
export async function updateDesign(id: string, patch: { name?: string; selection?: Selection }) {
  const { data, error } = await supabase
    .from('designs')
    .update(patch)
    .eq('id', id)
    .select(COLUMNS)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('design_missing');
  return fromRow(data);
}

export async function deleteDesign(id: string) {
  const { error } = await supabase.from('designs').delete().eq('id', id);
  if (error) throw error;
}

/** Compares selections whatever the key order (the database reorders JSON keys). */
export function selectionKey(selection: Selection): string {
  return JSON.stringify(
    Object.keys(selection.zones)
      .sort()
      .map((id) => [id, selection.zones[id]!.swatchId, selection.zones[id]!.finish]),
  );
}
