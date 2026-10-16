// Zones tool: product photo -> base image + one shading layer per zone (max 4), and upload.
//
//   npm run zones -- analyze <photo>          dominant colors + crop, to help write a model config
//   npm run zones -- build <models/x.json>    base.jpg, <zone>.png, debug.png, preview.jpg, manifest.json
//   npm run zones -- upload <out/x>           Storage + models/model_zones rows (admin account)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { loadConfig, MAX_ZONES, slug } from './config.ts';
import { autoCrop, isBackground, loadCropped, writeJpeg, writePng, type Raster } from './image.ts';
import { buildLayers, composite } from './layers.ts';
import { segment } from './segment.ts';

const OUT_ROOT = resolve(import.meta.dirname, '..', 'out');

export type Manifest = {
  model: string;
  slug: string;
  width: number;
  height: number;
  base: string;
  category: string;
  sizeRef: string | null;
  description: string | null;
  published: boolean;
  zones: {
    id: string;
    label: string;
    material: 'metal' | 'acetate';
    file: string;
    pixels: number;
    defaultRef: string | null;
    defaultFinish: 'gloss' | 'matte' | null;
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

  const seg = segment(raster, config.zones, config.groups, config.fixes ?? [], threshold);
  const layers = await buildLayers(raster, seg, config.zones);

  const modelSlug = slug(config.name);
  const dir = join(OUT_ROOT, modelSlug);
  mkdirSync(dir, { recursive: true });
  await writeJpeg(layers.base, join(dir, 'base.jpg'));
  for (let k = 0; k < config.zones.length; k++)
    await writePng(layers.zones[k]!, join(dir, `${config.zones[k]!.id}.png`));
  await writePng(layers.debug, join(dir, 'debug.png'));

  // Visual QA: the same zones in four test colorways (dark, light, translucent, gloss).
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
    base: 'base.jpg',
    category: config.category ?? '',
    sizeRef: config.sizeRef ?? null,
    description: config.description ?? null,
    published: config.published ?? false,
    zones: config.zones.map((z, k) => ({
      id: z.id,
      label: z.label,
      material: z.material,
      file: `${z.id}.png`,
      pixels: seg.stats[k]!.pixels,
      defaultRef: z.defaultRef ?? null,
      defaultFinish: z.defaultFinish ?? null,
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
  else {
    console.log('usage: npm run zones -- analyze <photo> | build <models/x.json> | upload <out/x>');
    process.exitCode = 2;
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
}
