import type { Finish, SwatchKind } from './types';

/**
 * Recolor recipe shared by every renderer (app: Skia; admin: Canvas 2D; tools/zones: preview).
 * Per zone, over the base image:
 *   1. fill = swatch color, or its tortoiseshell texture
 *   2. multiply by the layer's gray shading (the photo's light and shadow)
 *   3. gloss finish: screen a soft white band (see GLOSS)
 *   4. clip to the layer's alpha (the zone's shape)
 *   5. draw with the swatch opacity (translucent acetate shows the base through)
 * Pixel math: lit = c·s + (1 − c·s)·g ; out = out + (lit − out)·alpha·opacity
 */

/** Gloss highlight: a soft horizontal band, strongest at `center` (fraction of image height). */
export const GLOSS = { strength: 0.35, center: 0.2, halfWidth: 0.12 } as const;

/** Gloss amount (0..strength) at a vertical position, y as a fraction of the image height. */
export const glossAt = (y: number): number =>
  GLOSS.strength * Math.max(0, 1 - Math.abs(y - GLOSS.center) / GLOSS.halfWidth);

/** Gradient stops for renderers that draw the band as a vertical linear gradient (position, amount). */
export const GLOSS_STOPS: [number, number][] = [
  [GLOSS.center - GLOSS.halfWidth, 0],
  [GLOSS.center, GLOSS.strength],
  [GLOSS.center + GLOSS.halfWidth, 0],
];

export type RenderSwatch = {
  id: string;
  hex: string;
  kind: SwatchKind;
  alpha: number | null;
  /** Public URL of the tortoiseshell texture, if any. */
  textureUrl: string | null;
  finishes: Finish[];
};

export type RenderZone = {
  id: string;
  /** Public URL of the zone layer (alpha = shape, gray = shading). */
  layerUrl: string | null;
  defaultSwatchId: string | null;
  defaultFinish: Finish | null;
  sortOrder: number;
};

export type RenderPick = { swatchId: string | null; finish: Finish | null };

export type RenderLayer = {
  zoneId: string;
  layerUrl: string;
  hex: string;
  textureUrl: string | null;
  /** 0..1; below 1 only for translucent acetate. */
  opacity: number;
  gloss: boolean;
};

export type RenderPlan = { baseUrl: string; width: number; height: number; layers: RenderLayer[] };

/**
 * Layers to draw, in zone order. A zone uses its pick when there is one (a pick of `swatchId: null`
 * means "no color"), else its default. Zones without a layer or without any color are skipped
 * (the base image shows there, as in the photo's cleared area).
 */
export function buildRenderPlan(input: {
  baseUrl: string;
  width: number;
  height: number;
  zones: RenderZone[];
  swatches: RenderSwatch[];
  picks?: Record<string, RenderPick | undefined>;
}): RenderPlan {
  const byId = new Map(input.swatches.map((s) => [s.id, s]));
  const layers: RenderLayer[] = [];
  for (const zone of [...input.zones].sort((a, b) => a.sortOrder - b.sortOrder)) {
    const pick = input.picks?.[zone.id];
    const swatch = byId.get((pick ? pick.swatchId : zone.defaultSwatchId) ?? '');
    if (!zone.layerUrl || !swatch) continue;
    const finish = pick ? pick.finish : zone.defaultFinish;
    layers.push({
      zoneId: zone.id,
      layerUrl: zone.layerUrl,
      hex: swatch.hex,
      textureUrl: swatch.kind === 'havana' ? swatch.textureUrl : null,
      opacity: swatch.kind === 'translucent' ? (swatch.alpha ?? 1) : 1,
      // Gloss only when the color offers it (a stored finish the color doesn't have is ignored).
      gloss: finish === 'gloss' && swatch.finishes.includes('gloss'),
    });
  }
  return { baseUrl: input.baseUrl, width: input.width, height: input.height, layers };
}

/** Width of the catalog thumbnail rendered by the admin panel (JPEG). */
export const THUMB_WIDTH = 800;

/**
 * Fingerprint of everything a plan draws (images, colors, textures, opacity, gloss): the same plan
 * always gives the same key. The admin stores it with the thumbnail; the app compares it with the
 * key of the current data and only shows the thumbnail when they match.
 */
export function renderKey(plan: RenderPlan): string {
  const text = JSON.stringify([
    plan.baseUrl,
    plan.width,
    plan.height,
    plan.layers.map((l) => [l.layerUrl, l.hex.toUpperCase(), l.textureUrl, l.opacity, l.gloss]),
  ]);
  // Two 32-bit FNV-1a-style hashes (different seeds, odd multipliers): short, stable on every JS
  // engine, plenty for a cache key. The multipliers must be odd, or bits are lost at every step.
  let a = 0x811c9dc5;
  let b = 0x1b873593;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
  }
  return `v2-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
