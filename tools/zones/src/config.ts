import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import type { Crop } from './image.ts';

/** Contract limit, mirrored in the database (model_zones trigger). */
export const MAX_ZONES = 4;

export type ZoneConfig = {
  /** Stable id used in file names and as the zone name in the database. */
  id: string;
  /** Spanish label shown in the app. */
  label: string;
  material: 'metal' | 'acetate';
  /** Internal swatch reference used as the default color (e.g. "PH-M01"). */
  defaultRef?: string;
  defaultFinish?: 'gloss' | 'matte';
  /** How strongly the photo's light/shadow shows through the new color (default 0.55; dark metal ~0.9). */
  contrast?: number;
  /** Blur sigma for the shading of patterned originals (tortoiseshell), so the pattern doesn't bleed. */
  smooth?: number;
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
};

/** Manual correction: inside `rect` (output pixels), pixels of zone `from` become zone `to`. */
export type FixConfig = {
  rect: [x1: number, y1: number, x2: number, y2: number];
  from: string;
  to: string;
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
  zones: ZoneConfig[];
  groups: GroupConfig[];
  fixes?: FixConfig[];
};

export function loadConfig(file: string): { config: ModelConfig; inputPath: string } {
  const config = JSON.parse(readFileSync(file, 'utf8')) as ModelConfig;
  const errors: string[] = [];
  if (!config.name) errors.push('name is required');
  if (!config.input) errors.push('input is required');
  if (!config.zones?.length) errors.push('at least one zone is required');
  if (config.zones?.length > MAX_ZONES)
    errors.push(`max ${MAX_ZONES} zones per model (got ${config.zones.length})`);
  const ids = new Set(config.zones?.map((z) => z.id));
  if (ids.size !== config.zones?.length) errors.push('zone ids must be unique');
  for (const z of config.zones ?? []) {
    if (!/^[a-z0-9-]+$/.test(z.id)) errors.push(`zone id "${z.id}" must be lowercase letters, digits or "-"`);
    if (z.material !== 'metal' && z.material !== 'acetate')
      errors.push(`zone "${z.id}": material must be metal or acetate`);
  }
  for (const g of config.groups ?? []) {
    if (!g.attach) {
      const targets = g.split ? [g.split.zone, g.split.rest] : [g.zone];
      for (const t of targets)
        if (!t || !ids.has(t)) errors.push(`group "${g.name}" targets unknown zone "${t}"`);
    }
    for (const c of g.colors)
      if (!/^#[0-9a-fA-F]{6}$/.test(c)) errors.push(`group "${g.name}": bad color ${c}`);
  }
  for (const f of config.fixes ?? []) {
    if (!ids.has(f.from) || !ids.has(f.to)) errors.push(`fix ${JSON.stringify(f.rect)} uses an unknown zone`);
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
