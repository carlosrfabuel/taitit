import type { Finish, Material, RenderPick, SwatchKind } from '@taitit/shared';
import type { CatalogSwatch, CatalogZone } from '@/catalog/catalog';

/** The customer's choices, per zone id. Zones without an entry show their default color. */
export type Picks = Record<string, RenderPick | undefined>;

/** Palette sections, in display order. Metal colors have their own kind; acetates have three. */
const GROUPS: { kind: SwatchKind; label: string }[] = [
  { kind: 'metal', label: 'Metal' },
  { kind: 'solid', label: 'Solid' },
  { kind: 'translucent', label: 'Translucent' },
  { kind: 'havana', label: 'Havana' },
];

export type PaletteGroup = { kind: SwatchKind; label: string; swatches: CatalogSwatch[] };

/** The colors a zone can take (its material only), grouped by type; empty groups are left out. */
export function paletteGroups(swatches: CatalogSwatch[], material: Material): PaletteGroup[] {
  const own = swatches
    .filter((s) => s.material === material)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  return GROUPS.map((g) => ({ ...g, swatches: own.filter((s) => s.kind === g.kind) })).filter(
    (g) => g.swatches.length > 0,
  );
}

/** A color the zone can use: it exists (active) and has the zone's material. */
const usable = (zone: CatalogZone, swatches: CatalogSwatch[], id: string | null | undefined) =>
  swatches.find((s) => s.id === id && s.material === zone.material) ?? null;

/**
 * What a zone currently shows: the customer's pick while that color is still available, otherwise
 * the zone's default. A color removed from the palette after it was picked falls back to the
 * default instead of leaving the zone uncolored.
 */
export function currentPick(
  zone: CatalogZone,
  swatches: CatalogSwatch[],
  picks: Picks,
): { swatch: CatalogSwatch | null; finish: Finish | null } {
  const pick = picks[zone.id];
  const picked = pick && usable(zone, swatches, pick.swatchId);
  const swatch = picked || usable(zone, swatches, zone.defaultSwatchId);
  if (!swatch || swatch.finishes.length === 0) return { swatch, finish: null };
  // A color with finishes always shows one (acetate: matte / gloss): the one picked, else the zone's
  // default, else the color's first (matte). A finish the color doesn't offer is never shown.
  const offered = (f: Finish | null | undefined): f is Finish => !!f && swatch.finishes.includes(f);
  const wanted = picked ? pick.finish : zone.defaultFinish;
  const finish = offered(wanted)
    ? wanted
    : offered(zone.defaultFinish)
      ? zone.defaultFinish
      : swatch.finishes[0]!;
  return { swatch, finish };
}

/** Picks that are still valid, for the renderer (invalid ones are dropped, so the default shows). */
export function effectivePicks(zones: CatalogZone[], swatches: CatalogSwatch[], picks: Picks): Picks {
  const out: Picks = {};
  for (const zone of zones) {
    const pick = picks[zone.id];
    if (pick && usable(zone, swatches, pick.swatchId)) out[zone.id] = pick;
  }
  return out;
}

/**
 * Applies a color to a zone. The finish the zone had is kept when the new color offers it;
 * otherwise the color's first finish is used (or none, if it has none).
 */
export function applySwatch(
  picks: Picks,
  zone: CatalogZone,
  swatches: CatalogSwatch[],
  swatch: CatalogSwatch,
): Picks {
  if (swatch.material !== zone.material) return picks;
  const { swatch: now, finish } = currentPick(zone, swatches, picks);
  if (now?.id === swatch.id) return picks; // already this color: nothing changes
  const next = finish && swatch.finishes.includes(finish) ? finish : (swatch.finishes[0] ?? null);
  return { ...picks, [zone.id]: { swatchId: swatch.id, finish: next } };
}

/**
 * The tips that follow this zone, if any (client rules 2026-10-20 and 2026-10-23): when the
 * secondary front and the tips are both acetate, the tips take the front's color and finish, so
 * they start the same, until the customer gives the tips a color of their own. Tips the customer
 * never touched always follow; tips showing the front's color still follow.
 */
function followingTips(
  picks: Picks,
  zones: CatalogZone[],
  zone: CatalogZone,
  swatches: CatalogSwatch[],
): CatalogZone | null {
  if (zone.role !== 'secondary') return null;
  const tips = zones.find((z) => z.role === 'tips');
  if (!tips || tips.id === zone.id || tips.material !== zone.material) return null;
  if (!picks[tips.id]) return tips;
  const front = currentPick(zone, swatches, picks).swatch;
  return front && currentPick(tips, swatches, picks).swatch?.id === front.id ? tips : null;
}

/** The tips copy the front's color and finish as they are in `next`. */
function copyToTips(next: Picks, zone: CatalogZone, tips: CatalogZone, swatches: CatalogSwatch[]): Picks {
  const { swatch, finish } = currentPick(zone, swatches, next);
  return swatch ? { ...next, [tips.id]: { swatchId: swatch.id, finish } } : next;
}

/**
 * The customer picks a color for a zone; following tips take it too (with the front's finish). Tips
 * the customer gave their own color keep it. One change (one undo step) either way.
 */
export function chooseSwatch(
  picks: Picks,
  zones: CatalogZone[],
  zone: CatalogZone,
  swatches: CatalogSwatch[],
  swatch: CatalogSwatch,
): Picks {
  const next = applySwatch(picks, zone, swatches, swatch);
  if (next === picks) return next;
  const tips = followingTips(picks, zones, zone, swatches);
  return tips ? copyToTips(next, zone, tips, swatches) : next;
}

/** The customer picks a finish for a zone; following tips take the same finish. One undo step. */
export function chooseFinish(
  picks: Picks,
  zones: CatalogZone[],
  zone: CatalogZone,
  swatches: CatalogSwatch[],
  finish: Finish,
): Picks {
  const next = applyFinish(picks, zone, swatches, finish);
  if (next === picks) return next;
  const tips = followingTips(picks, zones, zone, swatches);
  return tips ? copyToTips(next, zone, tips, swatches) : next;
}

/** Sets the finish of a zone's current color; ignored when the color doesn't offer it. */
export function applyFinish(
  picks: Picks,
  zone: CatalogZone,
  swatches: CatalogSwatch[],
  finish: Finish,
): Picks {
  const { swatch, finish: now } = currentPick(zone, swatches, picks);
  if (!swatch || !swatch.finishes.includes(finish) || now === finish) return picks;
  return { ...picks, [zone.id]: { swatchId: swatch.id, finish } };
}

/** True when the design differs from the model's original combination. */
export function isCustomized(zones: CatalogZone[], swatches: CatalogSwatch[], picks: Picks): boolean {
  return zones.some((zone) => {
    const now = currentPick(zone, swatches, picks);
    const original = currentPick(zone, swatches, {});
    return now.swatch?.id !== original.swatch?.id || now.finish !== original.finish;
  });
}

/** Undo history: the current picks plus earlier states, newest last. */
export type History = { picks: Picks; past: Picks[] };

/** Steps kept for undo; older ones are dropped. */
export const MAX_UNDO = 50;

export const emptyHistory: History = { picks: {}, past: [] };

/** Records a change; a change that changes nothing is not an undo step. */
export function commit(history: History, next: Picks): History {
  if (next === history.picks) return history;
  return { picks: next, past: [...history.past, history.picks].slice(-MAX_UNDO) };
}

export function undo(history: History): History {
  const previous = history.past[history.past.length - 1];
  return previous ? { picks: previous, past: history.past.slice(0, -1) } : history;
}

/** Back to the original combination, as one undo step (so a reset can be undone). */
export function reset(history: History, zones: CatalogZone[], swatches: CatalogSwatch[]): History {
  return isCustomized(zones, swatches, history.picks) ? commit(history, {}) : history;
}
