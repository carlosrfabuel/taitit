import { hexToRgb, type ZoneConfig } from './config.ts';
import { blurChannel, luminance, type Raster } from './image.ts';
import { NONE, type Segmentation } from './segment.ts';

export type Layers = {
  /** Photo with every zone painted as background, so translucent colors show "through" correctly. */
  base: Raster;
  /** One per zone: gray = normalized shading (photo light/shadow), alpha = zone mask. */
  zones: Raster[];
  /** Zones painted in flat debug colors over the photo. */
  debug: Raster;
};

const DEBUG_COLORS: [number, number, number][] = [
  [40, 40, 220],
  [230, 60, 60],
  [250, 170, 0],
  [30, 170, 90],
];

const percentile = (sorted: Float32Array, p: number) =>
  sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;

export async function buildLayers(raster: Raster, seg: Segmentation, zones: ZoneConfig[]): Promise<Layers> {
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

    // Robust stats from interior pixels only (edges are mixed with the background).
    const vals: number[] = [];
    for (let i = 0; i < n; i++) if (seg.zone[i] === id && !seg.edge[i]) vals.push(source[i]!);
    const sorted = Float32Array.from(vals).sort();
    const lo = sorted.length ? percentile(sorted, 0.02) : 0;
    const med = sorted.length ? percentile(sorted, 0.5) : 128;
    const hi = sorted.length ? percentile(sorted, 0.98) : 255;
    const range = Math.max(8, hi - lo);
    const contrast = z.contrast ?? 0.55;

    const layer = new Uint8Array(n * 4);
    for (let i = 0; i < n; i++) {
      if (seg.zone[i] !== id) continue;
      // Median maps to 0.86: colors keep most of their brightness, highlights/shadows stay visible.
      const shade = Math.max(0.5, Math.min(1, 0.86 + ((source[i]! - med) / range) * contrast));
      const v = Math.round(shade * 255);
      const alpha = seg.edge[i] ? Math.max(0, Math.min(255, ((245 - lum[i]!) / 120) * 255)) : 255;
      layer[i * 4] = v;
      layer[i * 4 + 1] = v;
      layer[i * 4 + 2] = v;
      layer[i * 4 + 3] = alpha;
    }
    out.push({ width, height, data: layer });
  }

  const base = new Uint8Array(data);
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

  return {
    base: { width, height, data: base },
    zones: out,
    debug: { width, height, data: debug },
  };
}

/**
 * Same math as the app's Skia renderer: base, then per zone color × shading, blended by the mask.
 * `alpha` < 1 simulates translucent acetate; `gloss` adds a soft highlight band.
 */
export function composite(layers: Layers, picks: { hex: string; alpha?: number; gloss?: boolean }[]): Raster {
  const { width, height } = layers.base;
  const out = new Uint8Array(layers.base.data);
  layers.zones.forEach((layer, k) => {
    const pick = picks[k];
    if (!pick) return;
    const [cr, cg, cb] = hexToRgb(pick.hex);
    const opacity = pick.alpha ?? 1;
    for (let y = 0; y < height; y++) {
      // Gloss: brighter band near the top third, like a studio light reflection.
      const glossBoost = pick.gloss ? 0.35 * Math.max(0, 1 - Math.abs(y / height - 0.2) / 0.12) : 0;
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        const a = (layer.data[i * 4 + 3]! / 255) * opacity;
        if (a === 0) continue;
        const s = layer.data[i * 4]! / 255;
        const mix = (base: number, c: number) => {
          const shaded = c * s;
          const lit = shaded + (255 - shaded) * glossBoost;
          return Math.round(base + (lit - base) * a);
        };
        out[i * 4] = mix(out[i * 4]!, cr);
        out[i * 4 + 1] = mix(out[i * 4 + 1]!, cg);
        out[i * 4 + 2] = mix(out[i * 4 + 2]!, cb);
      }
    }
  });
  return { width, height, data: out };
}
