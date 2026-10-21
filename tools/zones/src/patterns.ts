// Tortoiseshell patterns for havana colors (see the zone_patterns migration and shared/src/render.ts).
// Every acetate zone gets one: "own" = the zone's pixels from the photo (parts that are tortoiseshell
// in it); "borrowed" = a real tortoiseshell texture (textures/tortoise.jpg, made from a photo with
// `npm run zones -- texture-image`) shaded like the zone. Renderers draw it in the chosen havana color.
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { PATTERN_LIGHT, PATTERN_SCALE, SHADE_GAIN, highlightOf, patternSoft } from '@taitit/shared/src/render.ts';
import { luminance, type Raster } from './image.ts';
import { connectedRegions, type Segmentation } from './segment.ts';

export const TEXTURE = resolve(import.meta.dirname, '..', 'textures', 'tortoise.jpg');

export type Pattern = { raster: Raster; hex: string; own: boolean };

const toHex = (rgb: number[]) =>
  '#' +
  rgb
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')
    .toUpperCase();

/** Pixels of zone `id` away from its anti-aliased border (the colors that are really the part's). */
const interior = (seg: Segmentation, id: number, i: number) => seg.zone[i] === id && !seg.edge[i];

/** Distance of an RGB color from gray (its colorfulness), same measure as the renderers' matrix. */
const chroma = (r: number, g: number, b: number) => {
  const y = luminance(r, g, b);
  return Math.hypot(r - y, g - y, b - y);
};

/**
 * Contrast for a light havana (blue channel): dark spots half as deep, honey patches soft (patternSoft).
 * A tortoiseshell's spots at full depth were near black on a cream (2026-10-21).
 */
const lightContrast = (a: number) => (a < 1 ? 1 - (1 - a) / 2 : patternSoft(a));

/**
 * Per pixel of zone `id`: 1 / the average of `f` over the pixel's piece (interior pixels), so each piece
 * averages 1. Without it a tip lying on a darker stretch came out darker than the color (MIKA, OLIVIA).
 */
function pieceNorm(seg: Segmentation, id: number, width: number, height: number, f: (i: number) => number) {
  const n = width * height;
  const pieces = connectedRegions(Uint8Array.from(seg.zone, (z) => (z === id ? 1 : 0)), width, height);
  const sum = new Float64Array(pieces.sizes.length);
  const cnt = new Float64Array(pieces.sizes.length);
  for (let i = 0; i < n; i++) {
    if (!interior(seg, id, i)) continue;
    const l = pieces.labels[i]!;
    sum[l]! += f(i);
    cnt[l]!++;
  }
  return (i: number) => {
    const l = pieces.labels[i]!;
    return l >= 0 && cnt[l]! && sum[l]! ? cnt[l]! / sum[l]! : 1;
  };
}

/** Ratios are stored ÷ PATTERN_SCALE in 0..255: 1 (the average) is 64. */
const encode = (ratio: number) =>
  Math.round((Math.max(0, Math.min(PATTERN_SCALE - 0.01, ratio)) / PATTERN_SCALE) * 255);

/**
 * The pattern image for zone `id` (1-based, as in the segmentation), full size: per pixel the
 * tortoiseshell's brightness (red) and colorfulness (green) relative to its average color, light and
 * shadow included, and the brightness for a light havana (blue, see PATTERN_LIGHT; shared/src/render.ts
 * draws it). Outside the zone all are 1 (never shown; keeps the file small). `hex` is that average
 * color: a havana of exactly that color shows the pattern as photographed (own) or as the TAITIT sample
 * chip (borrowed).
 */
export function zonePattern(
  photo: Raster,
  seg: Segmentation,
  id: number,
  mode: 'own' | 'borrowed',
  shade: Raster,
  texture: Raster | null,
): Pattern {
  const { width, height } = photo;
  const n = width * height;
  const ky = new Float32Array(n).fill(1);
  const kc = new Float32Array(n).fill(1);
  const kb = new Float32Array(n).fill(1); // brightness for a light havana (shared PATTERN_LIGHT)
  let avg: number[];
  if (mode === 'own') {
    // The photo against its own average color (over the zone, away from its anti-aliased border).
    const sum = [0, 0, 0];
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (!interior(seg, id, i)) continue;
      for (let c = 0; c < 3; c++) sum[c]! += photo.data[i * 4 + c]!;
      count++;
    }
    avg = sum.map((v) => (count ? v / count : 128));
    const my = Math.max(1, luminance(avg[0]!, avg[1]!, avg[2]!));
    const mc = Math.max(6, chroma(avg[0]!, avg[1]!, avg[2]!));
    for (let i = 0; i < n; i++) {
      if (seg.zone[i] !== id) continue;
      const r = photo.data[i * 4]!;
      const g = photo.data[i * 4 + 1]!;
      const b = photo.data[i * 4 + 2]!;
      ky[i] = luminance(r, g, b) / my;
      kc[i] = chroma(r, g, b) / mc;
    }
    // The photo's lightest few pixels (the lens bevel, a highlight) capped at the zone's own range, or a
    // light havana would show them as a bright line along the edges.
    for (const k of [ky, kc]) {
      const vals: number[] = [];
      for (let i = 0; i < n; i++) if (interior(seg, id, i)) vals.push(k[i]!);
      vals.sort((a, b) => a - b);
      const cap = vals.length ? vals[Math.floor(vals.length * 0.97)]! : PATTERN_SCALE;
      for (let i = 0; i < n; i++) if (seg.zone[i] === id && k[i]! > cap) k[i] = cap;
    }
    const norm = pieceNorm(seg, id, width, height, (i) => lightContrast(ky[i]!));
    for (let i = 0; i < n; i++) if (seg.zone[i] === id) kb[i] = lightContrast(ky[i]!) * norm(i);
  } else {
    if (!texture)
      throw new Error(`No tortoiseshell texture at ${TEXTURE}: run "npm run zones -- texture" first.`);
    const tw = texture.width;
    const th = texture.height;
    const tn = tw * th;
    const sum = [0, 0, 0];
    for (let i = 0; i < tn; i++) for (let c = 0; c < 3; c++) sum[c]! += texture.data[i * 4 + c]!;
    avg = sum.map((v) => v / tn);
    const my = Math.max(1, luminance(avg[0]!, avg[1]!, avg[2]!));
    const mc = Math.max(6, chroma(avg[0]!, avg[1]!, avg[2]!));
    const at = (x: number, y: number, ox: number, oy: number) => (((y + oy) % th) * tw + ((x + ox) % tw)) * 4;
    const ratios = (t: number) => {
      const r = texture.data[t]!;
      const g = texture.data[t + 1]!;
      const b = texture.data[t + 2]!;
      return [luminance(r, g, b) / my, chroma(r, g, b) / mc] as const;
    };
    // Where the texture lies over the zone: a small zone (a tip) may otherwise fall mostly on one dark
    // spot. Of a few fixed offsets, the one whose average over the zone is closest to the texture's own
    // (a fair mix of honey and dark spots), among those whose wrap lines (where the texture repeats,
    // not seamlessly) cross the fewest zone pixels: a wrap shows as a straight seam across the part.
    let best = { ox: 0, oy: 0, wrap: Infinity, score: Infinity };
    for (let k = 0; k < 48; k++) {
      const ox = (k * 397 + id * 131) % tw;
      const oy = (k * 211 + id * 89) % th;
      let wrap = 0;
      const wx = tw - ox;
      const wy = th - oy;
      if (ox > 0 && wx < width) for (let y = 0; y < height; y++) if (seg.zone[y * width + wx] === id) wrap++;
      if (oy > 0 && wy < height) for (let x = 0; x < width; x++) if (seg.zone[wy * width + x] === id) wrap++;
      if (wrap > best.wrap) continue;
      let sy = 0;
      let sc = 0;
      let cnt = 0;
      for (let i = 0; i < n; i += 3) {
        if (!interior(seg, id, i)) continue;
        const [a, b] = ratios(at(i % width, (i / width) | 0, ox, oy));
        sy += a;
        sc += b;
        cnt++;
      }
      const score = cnt ? (sy / cnt - 1) ** 2 + (sc / cnt - 1) ** 2 : 0;
      if (wrap < best.wrap || score < best.score) best = { ox, oy, wrap, score };
    }
    // The zone's light, as renderers draw it on flat colors (shared/src/render.ts): shading, then the
    // highlight toward white. Exact for a havana as light as the texture's average; patterns have no
    // separate highlight step.
    const yRef = my / 255;
    const norm = pieceNorm(seg, id, width, height, (i) =>
      lightContrast(ratios(at(i % width, (i / width) | 0, best.ox, best.oy))[0]),
    );
    for (let i = 0; i < n; i++) {
      if (seg.zone[i] !== id) continue;
      const [a, b] = ratios(at(i % width, (i / width) | 0, best.ox, best.oy));
      const gray = shade.data[i * 4]! / 255;
      const s = Math.min(1, gray * SHADE_GAIN);
      const h = highlightOf(gray);
      ky[i] = a * s + h * (1 / yRef - a * s);
      kc[i] = b * s * (1 - h);
      // Lit like a flat color (highlight toward white, as for PATTERN_LIGHT).
      kb[i] = lightContrast(a) * norm(i) * s * (1 - h) + h / PATTERN_LIGHT;
    }
  }
  const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = encode(ky[i]!);
    data[i * 4 + 1] = encode(kc[i]!);
    data[i * 4 + 2] = encode(kb[i]!);
    data[i * 4 + 3] = 255;
  }
  return { raster: { width, height, data }, hex: toHex(avg), own: mode === 'own' };
}

/** Pattern images keep full color resolution (4:4:4): the ratios live in separate channels. */
export function writePattern(raster: Raster, file: string) {
  return sharp(Buffer.from(raster.data), { raw: { width: raster.width, height: raster.height, channels: 4 } })
    .removeAlpha()
    .jpeg({ quality: 92, chromaSubsampling: '4:4:4', mozjpeg: true })
    .toFile(file);
}

export async function loadTexture(): Promise<Raster | null> {
  if (!existsSync(TEXTURE)) return null;
  const { data, info } = await sharp(TEXTURE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
  };
}

/**
 * Builds textures/tortoise.jpg from real tortoiseshell: the usable pixels of a photo (a zone that is
 * tortoiseshell in a model photo, or a sample chip of the acetate):
 * square patches lying fully inside the zone (flipped and turned too), quilted over a large canvas:
 * each block matches its neighbours in the overlap and is joined along the least visible cut.
 * Deterministic (fixed seed), so a rebuild gives the same file.
 */
export async function buildTexture(
  photo: Raster,
  usable: (i: number) => boolean,
  size = 1600,
  heightPx = 720,
  patch = 24,
) {
  // The photo itself (not the saved pattern JPEG, whose color blocks would repeat in the texture).
  const pattern = photo;
  const { width } = pattern;
  // Patches fully inside the zone, every 4 px.
  const patches: { x: number; y: number }[] = [];
  for (let y = 0; y + patch <= pattern.height; y += 4) {
    for (let x = 0; x + patch <= width; x += 4) {
      // Every pixel inside the zone, 2 px from its anti-aliased edge too.
      let inside = x >= 2 && y >= 2 && x + patch + 2 <= width && y + patch + 2 <= pattern.height;
      for (let dy = -2; dy < patch + 2 && inside; dy++)
        for (let dx = -2; dx < patch + 2 && inside; dx++)
          if (!usable((y + dy) * width + x + dx)) inside = false;
      if (!inside) continue;
      // Not where the lens bevel or a white highlight shows through (light grey, little color):
      // they would repeat as grey marks all over the texture.
      let grey = 0;
      for (let dy = 0; dy < patch; dy++)
        for (let dx = 0; dx < patch; dx++) {
          const i = ((y + dy) * width + x + dx) * 4;
          const r = pattern.data[i]!,
            g = pattern.data[i + 1]!,
            b = pattern.data[i + 2]!;
          const l = 0.299 * r + 0.587 * g + 0.114 * b;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          if ((l > 90 && sat < 30) || (l > 180 && sat < 70)) grey++;
        }
      if (grey <= patch * patch * 0.01) patches.push({ x, y });
    }
  }
  if (patches.length < 20)
    throw new Error(
      `Only ${patches.length} patches fit inside the zone: use a wider zone or a smaller --patch.`,
    );
  // Candidates: every patch in 8 orientations (flips and quarter turns), as RGB floats.
  const P = patch;
  const cands: Float32Array[] = [];
  for (const p of patches) {
    for (let o = 0; o < 8; o++) {
      const c = new Float32Array(P * P * 3);
      for (let dy = 0; dy < P; dy++)
        for (let dx = 0; dx < P; dx++) {
          let sx = o & 1 ? P - 1 - dx : dx;
          let sy = o & 2 ? P - 1 - dy : dy;
          if (o & 4) [sx, sy] = [sy, sx];
          const si = ((p.y + sy) * width + p.x + sx) * 4;
          for (let k = 0; k < 3; k++) c[(dy * P + dx) * 3 + k] = pattern.data[si + k]!;
        }
      cands.push(c);
    }
  }

  // Image quilting (Efros & Freeman 2001): blocks laid in rows with an overlap; each block is a
  // candidate that matches what is already there in the overlap, joined along the cut of least
  // difference, so the real pattern continues without a visible grid.
  const O = Math.max(4, Math.round(P / 3));
  const S = P - O;
  const cols = Math.ceil((size - O) / S);
  const rows = Math.ceil((heightPx - O) / S);
  const W = cols * S + O;
  const H = rows * S + O;
  const img = new Float32Array(W * H * 3);
  let seed = 20261020;
  const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  const diff2 = (c: Float32Array, dx: number, dy: number, ox: number, oy: number) => {
    const ci = (dy * P + dx) * 3;
    const ii = ((oy + dy) * W + ox + dx) * 3;
    return (c[ci]! - img[ii]!) ** 2 + (c[ci + 1]! - img[ii + 1]!) ** 2 + (c[ci + 2]! - img[ii + 2]!) ** 2;
  };
  for (let by = 0; by < rows; by++) {
    for (let bx = 0; bx < cols; bx++) {
      const ox = bx * S;
      const oy = by * S;
      let pick: Float32Array;
      if (bx === 0 && by === 0) pick = cands[Math.floor(rand() * cands.length)]!;
      else {
        // Error in the overlap for a random subset of candidates; pick among the near-best.
        const tries = Math.min(cands.length, 400);
        const scored: { c: Float32Array; e: number }[] = [];
        for (let t = 0; t < tries; t++) {
          const c = cands[Math.floor(rand() * cands.length)]!;
          let e = 0;
          if (bx > 0)
            for (let dy = 0; dy < P; dy++) for (let dx = 0; dx < O; dx++) e += diff2(c, dx, dy, ox, oy);
          if (by > 0)
            for (let dy = 0; dy < O; dy++)
              for (let dx = bx > 0 ? O : 0; dx < P; dx++) e += diff2(c, dx, dy, ox, oy);
          scored.push({ c, e });
        }
        const best = Math.min(...scored.map((x) => x.e));
        const good = scored.filter((x) => x.e <= best * 1.1 + 1);
        pick = good[Math.floor(rand() * good.length)]!.c;
      }
      // Minimum-error cuts: vertical through the left overlap, horizontal through the top one.
      const mask = new Uint8Array(P * P).fill(1);
      if (bx > 0) {
        const cost = new Float32Array(P * O);
        for (let dy = 0; dy < P; dy++)
          for (let dx = 0; dx < O; dx++) cost[dy * O + dx] = diff2(pick, dx, dy, ox, oy);
        for (let dy = 1; dy < P; dy++)
          for (let dx = 0; dx < O; dx++) {
            let m = cost[(dy - 1) * O + dx]!;
            if (dx > 0) m = Math.min(m, cost[(dy - 1) * O + dx - 1]!);
            if (dx < O - 1) m = Math.min(m, cost[(dy - 1) * O + dx + 1]!);
            cost[dy * O + dx]! += m;
          }
        let cx = 0;
        for (let dx = 1; dx < O; dx++) if (cost[(P - 1) * O + dx]! < cost[(P - 1) * O + cx]!) cx = dx;
        for (let dy = P - 1; dy >= 0; dy--) {
          for (let dx = 0; dx < cx; dx++) mask[dy * P + dx] = 0;
          if (dy > 0) {
            let nx = cx;
            for (const d of [-1, 1]) {
              const x2 = cx + d;
              if (x2 >= 0 && x2 < O && cost[(dy - 1) * O + x2]! < cost[(dy - 1) * O + nx]!) nx = x2;
            }
            cx = nx;
          }
        }
      }
      if (by > 0) {
        const cost = new Float32Array(O * P);
        for (let dx = 0; dx < P; dx++)
          for (let dy = 0; dy < O; dy++) cost[dx * O + dy] = diff2(pick, dx, dy, ox, oy);
        for (let dx = 1; dx < P; dx++)
          for (let dy = 0; dy < O; dy++) {
            let m = cost[(dx - 1) * O + dy]!;
            if (dy > 0) m = Math.min(m, cost[(dx - 1) * O + dy - 1]!);
            if (dy < O - 1) m = Math.min(m, cost[(dx - 1) * O + dy + 1]!);
            cost[dx * O + dy]! += m;
          }
        let cy = 0;
        for (let dy = 1; dy < O; dy++) if (cost[(P - 1) * O + dy]! < cost[(P - 1) * O + cy]!) cy = dy;
        for (let dx = P - 1; dx >= 0; dx--) {
          for (let dy = 0; dy < cy; dy++) mask[dy * P + dx] = 0;
          if (dx > 0) {
            let ny = cy;
            for (const d of [-1, 1]) {
              const y2 = cy + d;
              if (y2 >= 0 && y2 < O && cost[(dx - 1) * O + y2]! < cost[(dx - 1) * O + ny]!) ny = y2;
            }
            cy = ny;
          }
        }
      }
      for (let dy = 0; dy < P; dy++)
        for (let dx = 0; dx < P; dx++) {
          if (!mask[dy * P + dx] && (bx > 0 || by > 0)) continue;
          const ci = (dy * P + dx) * 3;
          const ii = ((oy + dy) * W + ox + dx) * 3;
          for (let k = 0; k < 3; k++) img[ii + k] = pick[ci + k]!;
        }
    }
  }
  const out = new Uint8Array(size * heightPx * 4);
  for (let y = 0; y < heightPx; y++)
    for (let x = 0; x < size; x++) {
      const t = y * size + x;
      for (let k = 0; k < 3; k++) out[t * 4 + k] = Math.min(255, Math.round(img[(y * W + x) * 3 + k]!));
      out[t * 4 + 3] = 255;
    }
  mkdirSync(dirname(TEXTURE), { recursive: true });
  // A slight blur: tortoiseshell is smooth at this scale; it hides seams and repeated small flecks.
  await sharp(Buffer.from(out), { raw: { width: size, height: heightPx, channels: 4 } })
    .blur(1.6)
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(TEXTURE);
  return { file: TEXTURE, patches: patches.length };
}
