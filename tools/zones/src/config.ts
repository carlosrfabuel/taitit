import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Crop } from './image.ts';

/** Contract limit, mirrored in the database (model_zones trigger). */
export const MAX_ZONES = 4;

export type ZoneConfig = {
  /** Stable id used in file names and as the zone name in the database. */
  id: string;
  /** Name shown in the app (English): "Main metal", "Secondary front", "Tips". */
  label: string;
  material: 'metal' | 'acetate';
  /** Which of the three zones every model has (Carlos, 2026-10-20): main metal (with the temples),
   * secondary front, tips. Main metal is metal and tips are acetate (database rule). */
  role?: 'main' | 'secondary' | 'tips';
  /** Internal swatch reference used as the default color (e.g. "PH-M01"). */
  defaultRef?: string;
  defaultFinish?: 'gloss' | 'matte';
  /** How much of the photo's shadows shows in the new color: exponent of the darkness ratio (default
   * 0.8; 1 = as photographed, lower = softer). Highlights always show as photographed. */
  shadow?: number;
  /** Blur sigma for the shading of patterned originals (tortoiseshell), so the pattern doesn't bleed. */
  smooth?: number;
  /** Tortoiseshell pattern used for havana colors (acetate zones): "own" = this part as photographed
   * (it is tortoiseshell in the photo), "borrowed" (default) = textures/tortoise.jpg shaded like the
   * zone, "none" = flat havana color. */
  pattern?: 'own' | 'borrowed' | 'none';
};

/** Pixels whose color is close to one of `colors` belong to this group. */
export type GroupConfig = {
  name: string;
  colors: string[];
  /** Max RGB distance to a group color (default 60). */
  tolerance?: number;
  /** Whole group goes to one zone… */
  zone?: string;
  /** …or the `largest` connected regions go to `zone` and the rest to `rest`. */
  split?: { largest: number; zone: string; rest: string };
  /** Regions smaller than this many pixels are ignored (noise). */
  minRegion?: number;
  /** Only pixels at least this saturated (max-min RGB) join; excludes grayish shadows and clear parts. */
  minSaturation?: number;
  /** Instead of `zone`/`split`: each region joins the zone it touches (highlights); isolated regions are ignored. */
  attach?: boolean;
  /** Only pixels inside this rectangle (output pixels) join: e.g. the grey gloss of one tip, a color
   * that elsewhere would catch the nose pads. */
  within?: [x1: number, y1: number, x2: number, y2: number];
  /** Shade these pixels against their own color, not the rest of their zone: a part photographed in
   * another color (KARL's black temples, gold in production) then looks like the rest of the zone. */
  ownShading?: boolean;
};

/** Manual correction: inside `rect` or `poly` (output pixels), pixels of zone `from` become zone `to`,
 * or no zone at all with `"none"` (e.g. a floor shadow the color of white metal). */
export type FixConfig = {
  rect?: [x1: number, y1: number, x2: number, y2: number];
  /** Instead of `rect`: a polygon [[x, y], ...], for a boundary that isn't horizontal or vertical (a
   * tip ending where a slanted rim passes in front of it; a rectangle there leaves a square notch). */
  poly?: [x: number, y: number][];
  from: string;
  to: string;
  /** Change only connected pieces of `from` that lie entirely inside the area (e.g. a white lens bevel
   * next to a white frame piece, which a plain rectangle would also cut into). */
  piecesInside?: boolean;
  /** The changed pixels shade with the rest of their new zone, not with the color group they matched
   * (a group with `ownShading`): e.g. the dark grain of a gold part, matched as the black front. */
  shadeAsZone?: boolean;
  note?: string;
};

/**
 * Two parts of the same color crossing in the photo (a far tip passing behind a rim): color can't tell
 * them apart, so inside `box` both are taken as straight bands, fitted from the pixels already sure
 * (`behind`'s visible pieces, `front`'s pixels off that band). Pixels on the behind band and off the
 * front band become `behind`; the crossing itself stays `front` (it is in front).
 */
export type CrossingConfig = {
  box: [x1: number, y1: number, x2: number, y2: number];
  front: string;
  behind: string;
  note?: string;
};

export type ModelConfig = {
  name: string;
  category?: string;
  sizeRef?: string;
  description?: string;
  published?: boolean;
  input: string;
  crop?: Crop | 'auto';
  outputWidth?: number;
  backgroundThreshold?: number;
  /** Passes of edge growth into anti-aliased pixels (default 1). 3 also closes the dark seams (3-4 px)
   * between two zones, which otherwise keep the photo's color as a thin line. */
  edgeGrow?: number;
  zones: ZoneConfig[];
  groups: GroupConfig[];
  fixes?: FixConfig[];
  /** Same-color crossings to separate, after the fixes. */
  crossings?: CrossingConfig[];
};

export function loadConfig(file: string): { config: ModelConfig; inputPath: string } {
  const config = JSON.parse(readFileSync(file, 'utf8')) as ModelConfig;
  const errors: string[] = [];
  if (!config.name) errors.push('name is required');
  if (!config.input) errors.push('input is required');
  if (!config.zones?.length) errors.push('at least one zone is required');
  if (
    config.edgeGrow !== undefined &&
    !(Number.isInteger(config.edgeGrow) && config.edgeGrow >= 1 && config.edgeGrow <= 5)
  )
    errors.push('edgeGrow must be a whole number from 1 to 5');
  if (config.zones?.length > MAX_ZONES)
    errors.push(`max ${MAX_ZONES} zones per model (got ${config.zones.length})`);
  const ids = new Set(config.zones?.map((z) => z.id));
  if (ids.size !== config.zones?.length) errors.push('zone ids must be unique');
  for (const z of config.zones ?? []) {
    if (!/^[a-z0-9-]+$/.test(z.id)) errors.push(`zone id "${z.id}" must be lowercase letters, digits or "-"`);
    if (z.material !== 'metal' && z.material !== 'acetate')
      errors.push(`zone "${z.id}": material must be metal or acetate`);
    if (z.role && !['main', 'secondary', 'tips'].includes(z.role))
      errors.push(`zone "${z.id}": role must be main, secondary or tips`);
    if (z.role === 'main' && z.material !== 'metal')
      errors.push(`zone "${z.id}": the main metal must be metal`);
    if (z.role === 'tips' && z.material !== 'acetate')
      errors.push(`zone "${z.id}": the tips must be acetate`);
    if (z.pattern && !['own', 'borrowed', 'none'].includes(z.pattern))
      errors.push(`zone "${z.id}": pattern must be own, borrowed or none`);
    if (z.pattern && z.pattern !== 'none' && z.material !== 'acetate')
      errors.push(`zone "${z.id}": only acetate zones have a tortoiseshell pattern`);
    if (z.shadow !== undefined && !(z.shadow > 0 && z.shadow <= 1.5))
      errors.push(`zone "${z.id}": shadow must be a number above 0, up to 1.5`);
    if ('contrast' in z) errors.push(`zone "${z.id}": "contrast" was replaced by "shadow" (see README)`);
  }
  const roles = (config.zones ?? []).map((z) => z.role).filter(Boolean);
  if (new Set(roles).size !== roles.length) errors.push('each role (main, secondary, tips) can be used once');
  for (const g of config.groups ?? []) {
    if (!g.attach) {
      const targets = g.split ? [g.split.zone, g.split.rest] : [g.zone];
      for (const t of targets)
        if (!t || !ids.has(t)) errors.push(`group "${g.name}" targets unknown zone "${t}"`);
    }
    for (const c of g.colors)
      if (!/^#[0-9a-fA-F]{6}$/.test(c)) errors.push(`group "${g.name}": bad color ${c}`);
    if (
      g.within &&
      (g.within.length !== 4 ||
        !g.within.every(Number.isFinite) ||
        g.within[0] > g.within[2] ||
        g.within[1] > g.within[3])
    )
      errors.push(`group "${g.name}": within must be [x1, y1, x2, y2]`);
  }
  for (const c of config.crossings ?? []) {
    if (!ids.has(c.front) || !ids.has(c.behind) || c.front === c.behind)
      errors.push(`crossing ${JSON.stringify(c.box)}: front and behind must be two different zones`);
    if (!(Array.isArray(c.box) && c.box.length === 4 && c.box.every((v) => typeof v === 'number')))
      errors.push(`crossing ${JSON.stringify(c.box)}: box must be [x1, y1, x2, y2]`);
  }
  for (const f of config.fixes ?? []) {
    const where = JSON.stringify(f.rect ?? f.poly);
    if (!ids.has(f.from) || (f.to !== 'none' && !ids.has(f.to)))
      errors.push(`fix ${where} uses an unknown zone`);
    const point = (p: unknown) => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number');
    if (!f.rect === !f.poly) errors.push(`fix ${where}: give either rect or poly`);
    if (f.rect && !(f.rect.length === 4 && f.rect.every((v) => typeof v === 'number')))
      errors.push(`fix ${where}: rect must be [x1, y1, x2, y2]`);
    if (f.poly && !(f.poly.length >= 3 && f.poly.every(point)))
      errors.push(`fix ${where}: poly must be at least 3 points [x, y]`);
  }
  if (errors.length) throw new Error(`Invalid config ${file}:\n - ${errors.join('\n - ')}`);
  return { config, inputPath: resolve(dirname(file), config.input) };
}

export const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
