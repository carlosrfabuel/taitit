// Zones tool: product photo -> base image + one shading layer per zone (max 4), and upload.
//
//   npm run zones -- analyze <photo>          dominant colors + crop, to help write a model config
//   npm run zones -- build <models/x.json>    base.jpg, <zone>.png, debug.png, preview.jpg, manifest.json
//   npm run zones -- upload <out/x>           Storage + models/model_zones rows (admin account)
//   npm run zones -- texture <models/x.json> <zone> [--patch 24]   textures/tortoise.jpg from a tortoiseshell zone
//   npm run zones -- texture-image <photo> <x1,y1,x2,y2> [--scale s] [--patch 24]   same, from a photo rectangle (e.g. a sample chip)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { loadConfig, MAX_ZONES, slug } from './config.ts';
import { autoCrop, isBackground, loadCropped, writeJpeg, writePng, type Crop, type Raster } from './image.ts';
import { buildLayers, composite } from './layers.ts';
import sharp from 'sharp';
import { segment } from './segment.ts';
import { buildTexture, loadTexture, writePattern } from './patterns.ts';

const OUT_ROOT = resolve(import.meta.dirname, '..', 'out');

export type Manifest = {
  model: string;
  slug: string;
  width: number;
  height: number;
  /** Part of the original photo the images were cut from (original pixels; for the zone sheets). */
  crop?: Crop;
  base: string;
  category: string;
  sizeRef: string | null;
  description: string | null;
  published: boolean;
  zones: {
    id: string;
    label: string;
    material: 'metal' | 'acetate';
    role: 'main' | 'secondary' | 'tips' | null;
    file: string;
    pixels: number;
    defaultRef: string | null;
    defaultFinish: 'gloss' | 'matte' | null;
    /** Tortoiseshell pattern for havana colors (acetate zones): file, average color, own or borrowed. */
    pattern: { file: string; hex: string; own: boolean } | null;
  }[];
};

const hex = (r: number, g: number, b: number) =>
  '#' +
  [r, g, b]
    .map((v) => Math.round(v).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();

/** k-means on product pixels: the photo's main colors, to fill `groups[].colors` in a config. */
function dominantColors(raster: Raster, threshold: number, k = 6) {
  const pts: [number, number, number][] = [];
  const n = raster.width * raster.height;
  for (let i = 0; i < n; i += 3) {
    if (isBackground(raster.data, i, threshold)) continue;
    pts.push([raster.data[i * 4]!, raster.data[i * 4 + 1]!, raster.data[i * 4 + 2]!]);
  }
  if (!pts.length) return [];
  let centers = Array.from(
    { length: k },
    (_, j) => pts[Math.floor(((j + 0.5) / k) * pts.length)]!.slice() as [number, number, number],
  );
  for (let iter = 0; iter < 20; iter++) {
    const sums = centers.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      let best = 0;
      let bestD = Infinity;
      centers.forEach((c, j) => {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      const s = sums[best]!;
      s[0]! += p[0];
      s[1]! += p[1];
      s[2]! += p[2];
      s[3]! += 1;
    }
    centers = sums.map(
      (s, j) =>
        (s[3] ? [s[0]! / s[3]!, s[1]! / s[3]!, s[2]! / s[3]!] : centers[j]!) as [number, number, number],
    );
    const counts = sums.map((s) => s[3]!);
    if (iter === 19) {
      return centers
        .map((c, j) => ({ hex: hex(...c), share: counts[j]! / pts.length }))
        .filter((c) => c.share > 0.005)
        .sort((a, b) => b.share - a.share);
    }
  }
  return [];
}

async function analyze(photo: string, threshold: number) {
  const input = resolve(photo);
  const crop = await autoCrop(input, threshold);
  const raster = await loadCropped(input, crop, 1600);
  const colors = dominantColors(raster, threshold);
  const dir = join(OUT_ROOT, '_analyze');
  mkdirSync(dir, { recursive: true });
  const preview = join(dir, `${slug(basename(photo).replace(/\.[^.]+$/, ''))}.jpg`);
  await writeJpeg(raster, preview);
  console.log(`crop (original px): ${JSON.stringify(crop)}`);
  console.log(`output: ${raster.width}x${raster.height}  ->  ${preview}`);
  console.log('dominant product colors (use in "groups[].colors"):');
  for (const c of colors) console.log(`  ${c.hex}  ${(c.share * 100).toFixed(1)}%`);
}

async function build(configFile: string) {
  const { config, inputPath } = loadConfig(resolve(configFile));
  if (!existsSync(inputPath)) throw new Error(`Photo not found: ${inputPath}`);
  const threshold = config.backgroundThreshold ?? 235;
  const crop = !config.crop || config.crop === 'auto' ? await autoCrop(inputPath, threshold) : config.crop;
  const raster = await loadCropped(inputPath, crop, config.outputWidth ?? 1600);

  const seg = segment(
    raster,
    config.zones,
    config.groups,
    config.fixes ?? [],
    threshold,
    config.edgeGrow,
    config.crossings ?? [],
  );
  const layers = await buildLayers(raster, seg, config.zones, config.groups, await loadTexture());

  const modelSlug = slug(config.name);
  const dir = join(OUT_ROOT, modelSlug);
  mkdirSync(dir, { recursive: true });
  await writeJpeg(layers.base, join(dir, 'base.jpg'));
  for (let k = 0; k < config.zones.length; k++)
    await writePng(layers.zones[k]!, join(dir, `${config.zones[k]!.id}.png`));
  await writePng(layers.debug, join(dir, 'debug.png'));
  for (let k = 0; k < config.zones.length; k++) {
    const p = layers.patterns[k];
    if (p) await writePattern(p.raster, join(dir, `${config.zones[k]!.id}-pattern.jpg`));
  }

  // Visual QA: the same zones in four test colorways (dark, light, translucent, gloss), then a fifth
  // with the acetate zones in a havana color drawn with their tortoiseshell pattern.
  const sets = [
    ['#1E1E22', '#4CFF5A', '#C2263A', '#2350C8'],
    ['#E9E6DF', '#7A4A1E', '#C9A45C', '#4A7FD0'],
    ['#2F4FB8', '#F2C14E', '#E8434F', '#1E5A3C'],
    ['#C9A45C', '#F4F1EA', '#1E1E22', '#D4A08A'],
  ];
  const tiles = sets.map((set, s) =>
    composite(
      layers,
      config.zones.map((z, k) => ({
        hex: set[k % set.length]!,
        alpha: s === 3 && z.material === 'acetate' ? 0.5 : 1,
        gloss: s === 2 && z.material === 'metal',
      })),
    ),
  );
  tiles.push(
    composite(
      layers,
      config.zones.map((z) => ({
        hex: z.material === 'acetate' ? '#C08A3E' : '#C9A45C',
        pattern: z.material === 'acetate',
      })),
    ),
  );
  const sheet = new Uint8Array(raster.width * raster.height * 4 * tiles.length);
  tiles.forEach((t, j) => sheet.set(t.data, j * t.data.length));
  await writeJpeg(
    { width: raster.width, height: raster.height * tiles.length, data: sheet },
    join(dir, 'preview.jpg'),
    85,
  );

  const manifest: Manifest = {
    model: config.name,
    slug: modelSlug,
    width: raster.width,
    height: raster.height,
    crop,
    base: 'base.jpg',
    category: config.category ?? '',
    sizeRef: config.sizeRef ?? null,
    description: config.description ?? null,
    published: config.published ?? false,
    zones: config.zones.map((z, k) => ({
      id: z.id,
      label: z.label,
      material: z.material,
      role: z.role ?? null,
      file: `${z.id}.png`,
      pixels: seg.stats[k]!.pixels,
      defaultRef: z.defaultRef ?? null,
      defaultFinish: z.defaultFinish ?? null,
      pattern: layers.patterns[k]
        ? { file: `${z.id}-pattern.jpg`, hex: layers.patterns[k]!.hex, own: layers.patterns[k]!.own }
        : null,
    })),
  };
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

  const product = raster.width * raster.height - seg.background.reduce((a, b) => a + b, 0);
  console.log(`${config.name}: ${raster.width}x${raster.height}, crop ${JSON.stringify(crop)}`);
  for (const s of seg.stats) {
    const flag = s.pixels === 0 ? '  <-- EMPTY: check groups/colors' : '';
    console.log(
      `  zone ${s.zone.padEnd(12)} ${String(s.pixels).padStart(7)} px  ${s.regions} region(s)${flag}`,
    );
  }
  console.log(
    `  not in any zone: ${((seg.unassignedProduct / Math.max(1, product)) * 100).toFixed(1)}% of product pixels (lenses, nose pads, screws are expected here)`,
  );
  console.log(`  output: ${dir}  (check debug.png and preview.jpg)`);
  if (seg.stats.some((s) => s.pixels === 0)) process.exitCode = 1;
}

/** textures/tortoise.jpg from a zone that is tortoiseshell in its photo (same crop and zones as build). */
async function texture(configFile: string, zoneId: string, patch: number) {
  const { config, inputPath } = loadConfig(resolve(configFile));
  const threshold = config.backgroundThreshold ?? 235;
  const crop = !config.crop || config.crop === 'auto' ? await autoCrop(inputPath, threshold) : config.crop;
  const raster = await loadCropped(inputPath, crop, config.outputWidth ?? 1600);
  const seg = segment(
    raster,
    config.zones,
    config.groups,
    config.fixes ?? [],
    threshold,
    config.edgeGrow,
    config.crossings ?? [],
  );
  const index = config.zones.findIndex((z) => z.id === zoneId) + 1;
  if (!index) throw new Error(`No zone "${zoneId}" in ${configFile}.`);
  const t = await buildTexture(raster, (i) => seg.zone[i] === index && !seg.edge[i], 1600, 720, patch);
  console.log(`texture from ${t.patches} patches of ${patch} px -> ${t.file}`);
}

/** textures/tortoise.jpg from a rectangle of any photo (e.g. a sample chip), scaled to the frames' size. */
async function textureFromImage(image: string, rect: string, scale: number, patch: number) {
  const [x1, y1, x2, y2] = rect.split(',').map(Number) as [number, number, number, number];
  const { data, info } = await sharp(resolve(image))
    .rotate()
    .extract({ left: x1, top: y1, width: x2 - x1, height: y2 - y1 })
    .resize({ width: Math.round((x2 - x1) * scale) })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const raster = {
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
  };
  const t = await buildTexture(raster, () => true, 1600, 720, patch);
  console.log(
    `texture from ${t.patches} patches of ${patch} px (source ${raster.width}x${raster.height}) -> ${t.file}`,
  );
}

async function upload(outDir: string) {
  const dir = resolve(outDir);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Manifest;
  if (manifest.zones.length > MAX_ZONES) throw new Error(`max ${MAX_ZONES} zones`);
  const { upload: run } = await import('./upload.ts');
  await run(dir, manifest);
}

const [command, arg, ...rest] = process.argv.slice(2);
const flag = (name: string, fallback: number) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? Number(rest[i + 1]) : fallback;
};

try {
  if (command === 'analyze' && arg) await analyze(arg, flag('threshold', 235));
  else if (command === 'build' && arg) await build(arg);
  else if (command === 'upload' && arg) await upload(arg);
  else if (command === 'texture' && arg && rest[0]) await texture(arg, rest[0], flag('patch', 24));
  else if (command === 'texture-image' && arg && rest[0])
    await textureFromImage(arg, rest[0], flag('scale', 1), flag('patch', 24));
  else {
    console.log(
      'usage: npm run zones -- analyze <photo> | build <models/x.json> | upload <out/x> | texture <models/x.json> <zone>',
    );
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
