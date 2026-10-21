// Same gloss as the app and admin renderers (direct file import: Node runs this TypeScript as is).
import { SHADE_GAIN, SHADE_TOP, glossAt, highlightOf, patternMatrix } from '@taitit/shared/src/render.ts';
import { hexToRgb, type GroupConfig, type ZoneConfig } from './config.ts';
import { blurChannel, luminance, type Raster } from './image.ts';
import { NONE, type Segmentation } from './segment.ts';
import { zonePattern, type Pattern } from './patterns.ts';

export type Layers = {
  /** Photo with every zone painted as background, so translucent colors show "through" correctly. */
  base: Raster;
  /** One per zone: gray = shading and highlight (shared/src/render.ts, SHADE_TOP), alpha = zone mask. */
  zones: Raster[];
  /** Zones painted in flat debug colors over the photo. */
  debug: Raster;
  /** One per zone: the tortoiseshell pattern for havana colors (acetate zones), else null. */
  patterns: (Pattern | null)[];
};

const DEBUG_COLORS: [number, number, number][] = [
  [40, 40, 220],
  [230, 60, 60],
  [250, 170, 0],
  [30, 170, 90],
];

/** Blur sigma (px at output size) of the light denoise of the photo's shading. */
const DENOISE = 1;

/**
 * Opacity of an edge pixel of zone `id`: how much of it is the part rather than what lies next to it
 * outside every zone (background, a clear lens), within 3 px (an anti-aliased ramp is that wide). The
 * mix is measured along the line from that area's color to the part's color nearby; a light part next to
 * a light area can't be told apart that way and leans to opaque. Opaque: a pixel between two parts (a
 * seam), or next to something dark outside the zones (a hole, a screw): renderers show the background
 * color under a zone, and a partly clear pixel there would show as a white dot or rim.
 */
function edgeAlpha(photo: Raster, seg: Segmentation, id: number, i: number, globalBg: number[]): number {
  const { width, height, data } = photo;
  const x = i % width;
  const y = (i / width) | 0;
  const R = 3;
  const part = [0, 0, 0];
  const back = [0, 0, 0];
  let np = 0;
  let nb = 0;
  for (let dy = -R; dy <= R; dy++) {
    for (let dx = -R; dx <= R; dx++) {
      if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
      const j = i + dx + dy * width;
      if (seg.zone[j] === NONE) {
        for (let c = 0; c < 3; c++) back[c]! += data[j * 4 + c]!;
        nb++;
      } else if (seg.zone[j] === id && !seg.edge[j]) {
        for (let c = 0; c < 3; c++) part[c]! += data[j * 4 + c]!;
        np++;
      }
    }
  }
  if (!nb) return 1;
  const b = back.map((v) => v / nb);
  if (Math.hypot(b[0]! - globalBg[0]!, b[1]! - globalBg[1]!, b[2]! - globalBg[2]!) > 60) return 1;
  if (!np) return 0.5;
  const p = part.map((v) => v / np);
  const d = p.map((v, c) => v - b[c]!);
  const d2 = d[0]! ** 2 + d[1]! ** 2 + d[2]! ** 2;
  let proj = 0;
  for (let c = 0; c < 3; c++) proj += (data[i * 4 + c]! - b[c]!) * d[c]!;
  const mix = Math.max(0, Math.min(1, proj / Math.max(1, d2)));
  const trust = Math.min(1, Math.sqrt(d2) / 60);
  return 1 - (1 - mix) * trust;
}

const percentile = (sorted: Float32Array, p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;

export async function buildLayers(
  raster: Raster,
  seg: Segmentation,
  zones: ZoneConfig[],
  groups: GroupConfig[] = [],
  texture: Raster | null = null,
): Promise<Layers> {
  const { width, height, data } = raster;
  const n = width * height;

  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = luminance(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!);

  // Background color sampled from the photo (studio white is rarely pure white).
  let bgR = 0;
  let bgG = 0;
  let bgB = 0;
  let bgN = 0;
  for (let i = 0; i < n; i += 7) {
    if (!seg.background[i]) continue;
    bgR += data[i * 4]!;
    bgG += data[i * 4 + 1]!;
    bgB += data[i * 4 + 2]!;
    bgN++;
  }
  const bg = bgN ? [bgR / bgN, bgG / bgN, bgB / bgN] : [255, 255, 255];

  const blurred = new Map<number, Float32Array>();
  const out: Raster[] = [];

  for (let k = 0; k < zones.length; k++) {
    const z = zones[k]!;
    const id = k + 1;
    let source: Float32Array<ArrayBufferLike> = lum;
    if (z.smooth && z.smooth > 0) {
      if (!blurred.has(z.smooth)) blurred.set(z.smooth, await blurChannel(lum, width, height, z.smooth));
      source = blurred.get(z.smooth)!;
    }

    // Robust stats from interior pixels only (edges are mixed with the background). Groups with
    // `ownShading` get their own stats (key = group index); everything else shares key -1.
    const statsKey = (i: number) => {
      const g = seg.group[i]!;
      return g >= 0 && groups[g]?.ownShading ? g : -1;
    };
    const vals = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      if (seg.zone[i] !== id || seg.edge[i]) continue;
      const key = statsKey(i);
      if (!vals.has(key)) vals.set(key, []);
      vals.get(key)!.push(source[i]!);
    }
    const medians = new Map<number, number>();
    for (const [key, v] of vals) {
      if (key !== -1 && v.length < 50) continue; // too few pixels: shade with the rest of the zone
      medians.set(key, Math.max(4, percentile(Float32Array.from(v).sort(), 0.5)));
    }
    const fallback = medians.get(-1) ?? [...medians.values()][0] ?? 128;
    const keyOf = (i: number) =>
      medians.has(statsKey(i)) ? statsKey(i) : medians.has(-1) ? -1 : [...medians.keys()][0];

    // Light denoise (JPEG noise, a matte finish's grain): a dark original's noise would otherwise show as
    // a rough surface in a light color. Blurred within the pixels shaded together only, so neither the
    // background nor a neighbouring part bleeds in.
    const clean = new Float32Array(source);
    for (const key of medians.keys()) {
      const mask = new Float32Array(n);
      const masked = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        if (seg.zone[i] !== id || seg.edge[i] || keyOf(i) !== key) continue;
        mask[i] = 255;
        masked[i] = source[i]!;
      }
      const [num, den] = await Promise.all([
        blurChannel(masked, width, height, DENOISE),
        blurChannel(mask, width, height, DENOISE),
      ]);
      for (let i = 0; i < n; i++) if (mask[i]) clean[i] = den[i]! ? (num[i]! / den[i]!) * 255 : source[i]!;
    }

    // Per pixel, against the typical (median) brightness of its part (shared/src/render.ts, SHADE_TOP):
    // darker = the photo's shadow ratio, softened by `shadow`; lighter = that far toward white (a lit
    // face; a temple seen through the lens is lighter and duller in the photo, and stays so in any color).
    const shadow = z.shadow ?? 0.8;
    const shade = new Float32Array(n);
    const light = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (seg.zone[i] !== id) continue;
      const med = medians.get(keyOf(i)!) ?? fallback;
      const v = clean[i]!;
      shade[i] = Math.pow(Math.min(1, v / med), shadow);
      light[i] = v > med ? Math.min(1, (v - med) / Math.max(8, 255 - med)) : 0;
    }
    // Edge pixels that mix with the outside are lighter because of it (their alpha does that part): no
    // lighter than the part next to them, or every edge would get a light rim. A seam between two parts
    // (opaque) keeps its own light: a bright bevel line is real.
    const alpha = new Float32Array(n);
    for (let i = 0; i < n; i++)
      if (seg.zone[i] === id) alpha[i] = seg.edge[i] ? edgeAlpha(raster, seg, id, i, bg) : 1;
    for (let i = 0; i < n; i++) {
      if (seg.zone[i] !== id || alpha[i] === 1 || !light[i]) continue;
      const x = i % width;
      const y = (i / width) | 0;
      let near = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const j = i + dx + dy * width;
          if (x + dx < 0 || x + dx >= width || y + dy < 0 || y + dy >= height) continue;
          if (seg.zone[j] === id && !seg.edge[j]) near = Math.max(near, light[j]!);
        }
      light[i] = Math.min(light[i]!, near);
    }

    // Encoded as one gray (SHADE_TOP·shade, or above SHADE_TOP the highlight), error-diffused
    // (Floyd–Steinberg) within the zone: the highlight has only ~36 levels, which would show as bands.
    const target = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (seg.zone[i] !== id) continue;
      target[i] = 255 * (light[i]! > 0 ? SHADE_TOP + light[i]! * (1 - SHADE_TOP) : SHADE_TOP * shade[i]!);
    }
    const layer = new Uint8Array(n * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (seg.zone[i] !== id) continue;
        const v = Math.max(0, Math.min(255, Math.round(target[i]!)));
        const err = target[i]! - v;
        const spread = (dx: number, dy: number, w: number) => {
          const j = i + dx + dy * width;
          if (x + dx >= 0 && x + dx < width && y + dy < height && seg.zone[j] === id) target[j]! += err * w;
        };
        spread(1, 0, 7 / 16);
        spread(-1, 1, 3 / 16);
        spread(0, 1, 5 / 16);
        spread(1, 1, 1 / 16);
        layer[i * 4] = v;
        layer[i * 4 + 1] = v;
        layer[i * 4 + 2] = v;
        layer[i * 4 + 3] = Math.round(255 * alpha[i]!);
      }
    }
    out.push({ width, height, data: layer });
  }

  // Clear parts outside every zone (nose pads, lens edges) reflect the frame's photo color, which stays
  // in the base whatever color is picked: a red pad on a blue frame. Their color is taken out where it
  // matches a zone's (a part really colored otherwise, e.g. a red ring, keeps it).
  const zoneChroma = zones.map((_, k) => {
    const v: number[][] = [[], [], []];
    for (let i = 0; i < n; i += 3)
      if (seg.zone[i] === k + 1 && !seg.edge[i]) for (let c = 0; c < 3; c++) v[c]!.push(data[i * 4 + c]!);
    const med = v.map((a) => (a.sort((x, y) => x - y), a[a.length >> 1] ?? 128));
    const y = luminance(med[0]!, med[1]!, med[2]!);
    return med.map((m) => m - y);
  });
  const reflections = new Set<number>();
  for (let i = 0; i < n; i++) {
    if (seg.zone[i] !== NONE || seg.background[i]) continue;
    const y = lum[i]!;
    const c = [data[i * 4]! - y, data[i * 4 + 1]! - y, data[i * 4 + 2]! - y];
    const len = Math.hypot(c[0]!, c[1]!, c[2]!);
    if (len < 12) continue;
    for (const z of zoneChroma) {
      const zl = Math.hypot(z[0]!, z[1]!, z[2]!);
      if (zl < 25) continue;
      if ((c[0]! * z[0]! + c[1]! * z[1]! + c[2]! * z[2]!) / (len * zl) > 0.85) {
        reflections.add(i);
        break;
      }
    }
  }

  const base = new Uint8Array(data);
  for (const i of reflections)
    for (let c = 0; c < 3; c++) base[i * 4 + c] = Math.round(lum[i]! + (data[i * 4 + c]! - lum[i]!) * 0.2);
  const debug = new Uint8Array(data);
  for (let i = 0; i < n; i++) {
    const z = seg.zone[i]!;
    if (z === NONE) continue;
    base[i * 4] = bg[0]!;
    base[i * 4 + 1] = bg[1]!;
    base[i * 4 + 2] = bg[2]!;
    const c = DEBUG_COLORS[(z - 1) % DEBUG_COLORS.length]!;
    debug[i * 4] = c[0];
    debug[i * 4 + 1] = c[1];
    debug[i * 4 + 2] = c[2];
  }

  const patterns = zones.map((z, k) => {
    const mode = z.material === 'acetate' ? (z.pattern ?? 'borrowed') : 'none';
    return mode === 'none' ? null : zonePattern(raster, seg, k + 1, mode, out[k]!, texture);
  });

  return {
    base: { width, height, data: base },
    zones: out,
    debug: { width, height, data: debug },
    patterns,
  };
}

/**
 * Same math as the app's Skia renderer: base, then per zone color × shading + highlight, blended by the mask.
 * `alpha` < 1 simulates translucent acetate; `gloss` adds a soft highlight band; `pattern` draws a
 * havana color with the zone's tortoiseshell pattern (through its color matrix, instead of color × shading).
 */
export function composite(
  layers: Layers,
  picks: { hex: string; alpha?: number; gloss?: boolean; pattern?: boolean }[],
): Raster {
  const { width, height } = layers.base;
  const out = new Uint8Array(layers.base.data);
  layers.zones.forEach((layer, k) => {
    const pick = picks[k];
    if (!pick) return;
    const rgb = hexToRgb(pick.hex);
    const pattern = pick.pattern ? layers.patterns[k] : null;
    const m = pattern ? patternMatrix(pick.hex) : null;
    const opacity = pick.alpha ?? 1;
    for (let y = 0; y < height; y++) {
      // Gloss: brighter band near the top third, like a studio light reflection.
      const glossBoost = pick.gloss ? glossAt(y / height) : 0;
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const a = (layer.data[i * 4 + 3]! / 255) * opacity;
        if (a === 0) continue;
        const gray = layer.data[i * 4]! / 255;
        const s = Math.min(1, gray * SHADE_GAIN);
        const hl = highlightOf(gray);
        for (let c = 0; c < 3; c++) {
          const p = pattern?.raster.data;
          const fill =
            p && m
              ? Math.max(
                  0,
                  Math.min(
                    255,
                    m[c * 5]! * p[i * 4]! +
                      m[c * 5 + 1]! * p[i * 4 + 1]! +
                      m[c * 5 + 2]! * p[i * 4 + 2]! +
                      255 * m[c * 5 + 4]!,
                  ),
                )
              : rgb[c]! * s + (255 - rgb[c]! * s) * hl;
          const lit = fill + (255 - fill) * glossBoost;
          out[i * 4 + c] = Math.round(out[i * 4 + c]! + (lit - out[i * 4 + c]!) * a);
        }
      }
    }
  });
  return { width, height, data: out };
}
