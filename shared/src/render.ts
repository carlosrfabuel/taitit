import type { Finish, SwatchKind } from './types';

/**
 * Recolor recipe shared by every renderer (app: Skia; admin: Canvas 2D; tools/zones: preview).
 * Per zone, over the base image:
 *   1. fill = swatch color as photographed (photographed(), see PHOTO_BLACK), or its tortoiseshell texture
 *   2. multiply by the layer's shading (the photo's shadows): gray × SHADE_GAIN, capped at 1
 *   3. screen the layer's highlight (the photo's light parts: lit faces, a temple seen through the
 *      lens): highlightOf(gray), toward white
 *   4. gloss finish: screen a soft white band (see GLOSS)
 *   5. clip to the layer's alpha (the zone's shape)
 *   6. draw with the swatch opacity (translucent acetate shows the base through)
 * Pixel math (0..1): f = c·min(1, gray·SHADE_GAIN) ; f = f + (1 − f)·highlightOf(gray) ;
 *   lit = f + (1 − f)·gloss ; out = out + (lit − out)·alpha·opacity
 *
 * Havana colors on a zone with a tortoiseshell pattern replace steps 1-3: fill = the pattern image
 * through patternMatrix(color). The pattern stores, per pixel, how the real tortoiseshell differs from
 * its average color: brightness ratio (red) and colorfulness ratio (green), both ÷ PATTERN_SCALE, light
 * and shadow included. The color is drawn as  luma(c)·brightness + (c − luma(c))·colorfulness : dark
 * spots become a dark, duller c, honey areas a light, richer c, and the hue is always c's. A c lighter
 * than the pattern's average draws more and more from the blue channel, made for a light havana
 * (PATTERN_LIGHT, patternMatrix).
 */

/**
 * A zone layer's gray holds two things (tools/zones/src/layers.ts). From 0 to SHADE_TOP: the shading;
 * SHADE_TOP is the zone's typical brightness (the color drawn as itself), darker is the photo's shadows.
 * Above SHADE_TOP: the highlight, how far toward white (0 at SHADE_TOP, 1 at white).
 * A renderer without the highlight step (app builds before 2026-10-20) still draws such a layer
 * sensibly: light parts somewhat brighter than the color.
 */
export const SHADE_TOP = 0.86;

/** Shading multiplier: gray × SHADE_GAIN, capped at 1 (the color as itself at the typical brightness). */
export const SHADE_GAIN = 1 / SHADE_TOP;

/** Highlight amount (0..1, toward white) of a layer gray (0..1). */
export const highlightOf = (gray: number): number =>
  Math.max(0, Math.min(1, (gray - SHADE_TOP) / (1 - SHADE_TOP)));

/**
 * A swatch's HEX is its nominal color (Carlos's chart: 0 = #FFFFFF, 7 = #000000). In the photos real
 * materials under studio light never reach those: white metal comes out about #E5E5E5 (CELEST), black
 * about #2F2F2F (PHILEAS, DONA). Renderers draw a color as photographed: in linear light, nominal
 * black..white maps to PHOTO_BLACK..PHOTO_WHITE. Without it a white frame vanished into the white
 * background and a black one was a flat silhouette (2026-10-21). The swatch chips keep the nominal HEX.
 */
export const PHOTO_BLACK = 0.0284; // linear light, sRGB 47
export const PHOTO_WHITE = 0.7835; // linear light, sRGB 229

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toSrgb = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** The color a renderer draws for a swatch HEX (see PHOTO_BLACK), as #RRGGBB. */
export function photographed(hex: string): string {
  return (
    '#' +
    rgb(hex)
      .map((v) => {
        const lin = PHOTO_BLACK + (PHOTO_WHITE - PHOTO_BLACK) * toLinear(v / 255);
        return Math.round(255 * toSrgb(lin))
          .toString(16)
          .padStart(2, '0');
      })
      .join('')
      .toUpperCase()
  );
}

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
  /** Public URL of the zone's tortoiseshell pattern (acetate zones). */
  patternUrl: string | null;
  /** The pattern is the zone's own, from the photo (else a real one borrowed from another photo). */
  patternOwn: boolean;
  /** The pattern's average color (see patternMatrix); without it light havanas may reach white. */
  patternHex?: string | null;
};

export type RenderPick = { swatchId: string | null; finish: Finish | null };

export type RenderLayer = {
  zoneId: string;
  layerUrl: string;
  /** The color as drawn: the swatch's HEX as photographed (photographed()). */
  hex: string;
  textureUrl: string | null;
  /** Havana on a zone with a pattern: the pattern image and the color matrix that draws it. */
  patternUrl: string | null;
  patternMatrix: number[] | null;
  /** 0..1; below 1 only for translucent acetate. */
  opacity: number;
  gloss: boolean;
};

const rgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Brightness and colorfulness ratios in pattern images are stored divided by this (0..4 fits 0..1). */
export const PATTERN_SCALE = 4;

export const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/**
 * Soft tortoiseshell contrast: a brightness ratio as is up to the average (1), above it compressed toward
 * 1 + PATTERN_KNEE (honey patches; darker spots unchanged).
 */
export const PATTERN_KNEE = 0.3;
export const patternSoft = (ratio: number): number =>
  ratio <= 1 ? ratio : 1 + PATTERN_KNEE * (1 - Math.exp(-(ratio - 1) / PATTERN_KNEE));

/**
 * The light havana the blue channel of pattern images is made for (luma as drawn: cream marble 11 is
 * 0.70). Blue holds the brightness for such a color: the zone's light as on flat colors (shading, then
 * the highlight toward white) times the soft contrast (borrowed patterns), or the photo's brightness with
 * soft contrast (own patterns). Red is exact for the pattern's own average color and darker; a light
 * color drawn from red alone turned honey patches and the light, see-through parts of tips white (cream
 * marble 11, 2026-10-21).
 */
export const PATTERN_LIGHT = 0.7;

/**
 * 4×5 color matrix (Skia's layout, 0..1 values) that draws a pattern image in the havana color `hex`:
 * out = luma·S·((1 − w)·red + w·blue) + (channel − luma)·((1 − w)·S·green + w). Rounded so every
 * renderer sees the same numbers.
 * w goes from 0 for colors no lighter than the pattern's average `patternHex` (drawn exactly as before,
 * the average itself as photographed) to 1 at PATTERN_LIGHT and lighter. On the blue side the color keeps
 * its own colorfulness (honey patches are several times more colorful than a dark pattern's average:
 * a cream would turn yellow).
 */
export function patternMatrix(hex: string, patternHex?: string | null): number[] {
  const [r, g, b] = rgb(hex).map((v) => v / 255) as [number, number, number];
  const y = luma(r, g, b);
  let w = 0;
  if (patternHex) {
    const yp = luma(...(rgb(patternHex).map((v) => v / 255) as [number, number, number]));
    if (y > yp) w = yp >= PATTERN_LIGHT ? 1 : Math.min(1, (y - yp) / (PATTERN_LIGHT - yp));
  }
  const k = PATTERN_SCALE;
  const round = (v: number) => Math.round(v * 1e4) / 1e4;
  const row = (c: number) => [
    round(k * y * (1 - w)),
    round(k * (c - y) * (1 - w)),
    round(k * y * w),
    0,
    round((c - y) * w),
  ];
  return [...row(r), ...row(g), ...row(b), 0, 0, 0, 1, 0];
}

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
  // Ties broken by id: every renderer (and the key) must see the same order whatever the query returned.
  const ordered = [...input.zones].sort(
    (a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  for (const zone of ordered) {
    const pick = input.picks?.[zone.id];
    const swatch = byId.get((pick ? pick.swatchId : zone.defaultSwatchId) ?? '');
    if (!zone.layerUrl || !swatch) continue;
    const finish = pick ? pick.finish : zone.defaultFinish;
    // Havana: the zone's own photo pattern first, then the color's texture, then a borrowed pattern.
    const havana = swatch.kind === 'havana';
    const hex = photographed(swatch.hex);
    const pattern =
      havana && zone.patternUrl && (zone.patternOwn || !swatch.textureUrl)
        ? { url: zone.patternUrl, matrix: patternMatrix(hex, zone.patternHex) }
        : null;
    layers.push({
      zoneId: zone.id,
      layerUrl: zone.layerUrl,
      hex,
      textureUrl: havana && !pattern ? swatch.textureUrl : null,
      patternUrl: pattern?.url ?? null,
      patternMatrix: pattern?.matrix ?? null,
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
  // Paths without scheme and host: the admin and the app may reach the same files through different
  // addresses (local dev, a custom domain) and must still agree.
  const rel = (url: string | null) => (url ? url.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '') : null);
  const text = JSON.stringify([
    rel(plan.baseUrl),
    plan.width,
    plan.height,
    // Pattern fields only when used: plans without patterns keep the keys they had before.
    plan.layers.map((l) => [
      rel(l.layerUrl),
      l.hex.toUpperCase(),
      rel(l.textureUrl),
      l.opacity,
      l.gloss,
      // (the pattern's matrix comes from the color, already in the key)
      ...(l.patternUrl ? [rel(l.patternUrl)] : []),
    ]),
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
  // v8: light havanas drawn from the pattern's light-color channel (2026-10-21; v7: their honey
  // patches capped below white; v6: colors drawn as photographed; v5: highlight step; v4: shading ×
  // SHADE_GAIN). Thumbnails drawn before no longer match and are redrawn.
  return `v8-${(a >>> 0).toString(16).padStart(8, '0')}${(b >>> 0).toString(16).padStart(8, '0')}`;
}
