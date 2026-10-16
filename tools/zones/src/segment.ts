import { hexToRgb, type FixConfig, type GroupConfig, type ZoneConfig } from './config.ts';
import { isBackground, luminance, type Raster } from './image.ts';

export const NONE = 0; // not part of any zone (background, lenses, nose pads, screws…)

export type Segmentation = {
  /** Per pixel: 0 = none, n = zones[n - 1]. */
  zone: Uint8Array;
  /** Pixels added by edge growing (anti-aliased borders), get partial alpha. */
  edge: Uint8Array;
  background: Uint8Array;
  stats: { zone: string; pixels: number; regions: number }[];
  unassignedProduct: number;
};

const NEIGHBORS8 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [-1, -1],
  [1, -1],
  [-1, 1],
] as const;

/** Connected regions (8-neighborhood) of pixels where mask[i] === 1. Returns labels and region sizes. */
export function connectedRegions(mask: Uint8Array, width: number, height: number) {
  const labels = new Int32Array(mask.length).fill(-1);
  const sizes: number[] = [];
  const stack = new Int32Array(mask.length);
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1 || labels[start] !== -1) continue;
    const id = sizes.length;
    let size = 0;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = id;
    while (sp) {
      const p = stack[--sp]!;
      size++;
      const x = p % width;
      const y = (p / width) | 0;
      for (const [dx, dy] of NEIGHBORS8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const q = ny * width + nx;
        if (mask[q] === 1 && labels[q] === -1) {
          labels[q] = id;
          stack[sp++] = q;
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

export function segment(
  raster: Raster,
  zones: ZoneConfig[],
  groups: GroupConfig[],
  fixes: FixConfig[],
  backgroundThreshold: number,
): Segmentation {
  const { width, height, data } = raster;
  const n = width * height;
  const zoneIndex = (id: string) => zones.findIndex((z) => z.id === id) + 1;

  const background = new Uint8Array(n);
  for (let i = 0; i < n; i++) background[i] = isBackground(data, i, backgroundThreshold) ? 1 : 0;

  // 1. Each non-background pixel joins the closest group color within tolerance.
  const group = new Int16Array(n).fill(-1);
  const groupColors = groups.map((g) => ({
    rgb: g.colors.map(hexToRgb),
    tol2: (g.tolerance ?? 60) ** 2,
    minSat: g.minSaturation ?? 0,
  }));
  for (let i = 0; i < n; i++) {
    if (background[i]) continue;
    const r = data[i * 4]!;
    const g = data[i * 4 + 1]!;
    const b = data[i * 4 + 2]!;
    const saturation = Math.max(r, g, b) - Math.min(r, g, b);
    let best = -1;
    let bestD = Infinity;
    groupColors.forEach((gc, gi) => {
      if (saturation < gc.minSat) return;
      for (const [cr, cg, cb] of gc.rgb) {
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2;
        if (d <= gc.tol2 && d < bestD) {
          bestD = d;
          best = gi;
        }
      }
    });
    group[i] = best;
  }

  // 2. Groups become zones, optionally split by connected regions (e.g. two rims vs. temple tips).
  const zone = new Uint8Array(n);
  const regionsPerZone = new Map<number, number>();
  groups.forEach((g, gi) => {
    if (g.attach) return; // handled after the main zones exist (step 2b)
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (group[i] === gi) mask[i] = 1;
    const { labels, sizes } = connectedRegions(mask, width, height);
    const minRegion = g.minRegion ?? 40;
    const order = sizes
      .map((size, id) => ({ size, id }))
      .filter((r) => r.size >= minRegion)
      .sort((a, b) => b.size - a.size);
    const target = new Map<number, number>();
    order.forEach((r, rank) => {
      const z = g.split
        ? rank < g.split.largest
          ? zoneIndex(g.split.zone)
          : zoneIndex(g.split.rest)
        : zoneIndex(g.zone!);
      target.set(r.id, z);
      regionsPerZone.set(z, (regionsPerZone.get(z) ?? 0) + 1);
    });
    for (let i = 0; i < n; i++) {
      const l = labels[i]!;
      if (l >= 0 && target.has(l)) zone[i] = target.get(l)!;
    }
  });

  // 2b. "Attach" groups (e.g. light highlights): a region joins the zone it touches most;
  //     regions touching no zone (shadows, reflections, nose pads) are ignored.
  groups.forEach((g, gi) => {
    if (!g.attach) return;
    const mask = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (group[i] === gi && zone[i] === NONE) mask[i] = 1;
    const { labels, sizes } = connectedRegions(mask, width, height);
    const touches = sizes.map(() => new Map<number, number>());
    for (let i = 0; i < n; i++) {
      const l = labels[i]!;
      if (l < 0) continue;
      const x = i % width;
      const y = (i / width) | 0;
      for (const [dx, dy] of NEIGHBORS8) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const z = zone[ny * width + nx]!;
        if (z !== NONE) touches[l]!.set(z, (touches[l]!.get(z) ?? 0) + 1);
      }
    }
    const target = touches.map((t) => [...t.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? NONE);
    for (let i = 0; i < n; i++) {
      const l = labels[i]!;
      if (l >= 0 && target[l] !== NONE) zone[i] = target[l]!;
    }
  });

  // 3. Manual corrections for cases color + regions can't resolve.
  for (const f of fixes) {
    const from = zoneIndex(f.from);
    const to = zoneIndex(f.to);
    const [x1, y1, x2, y2] = f.rect;
    for (let y = Math.max(0, y1); y <= Math.min(height - 1, y2); y++) {
      for (let x = Math.max(0, x1); x <= Math.min(width - 1, x2); x++) {
        const i = y * width + x;
        if (zone[i] === from) zone[i] = to;
      }
    }
  }

  // 3b. Fill small holes (glare specks) completely enclosed by a single zone. Large unassigned
  //     areas (lenses, nose pads) are never touched because of the size limit.
  {
    const holeMask = new Uint8Array(n);
    for (let i = 0; i < n; i++) if (zone[i] === NONE) holeMask[i] = 1;
    const { labels, sizes } = connectedRegions(holeMask, width, height);
    const maxHole = 60;
    const neighborZone = new Int16Array(sizes.length).fill(-1); // -1 unknown, 0 mixed/border, z = single zone
    for (let i = 0; i < n; i++) {
      const l = labels[i]!;
      if (l < 0 || sizes[l]! > maxHole || neighborZone[l] === 0) continue;
      const x = i % width;
      const y = (i / width) | 0;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) {
        neighborZone[l] = 0;
        continue;
      }
      for (const [dx, dy] of NEIGHBORS8) {
        const z = zone[(y + dy) * width + (x + dx)]!;
        if (z === NONE) continue;
        if (neighborZone[l] === -1) neighborZone[l] = z;
        else if (neighborZone[l] !== z) neighborZone[l] = 0;
      }
    }
    for (let i = 0; i < n; i++) {
      const l = labels[i]!;
      if (l >= 0 && sizes[l]! <= maxHole && neighborZone[l]! > 0) zone[i] = neighborZone[l]!;
    }
  }

  // 4. Grow each zone 1px into anti-aliased edge pixels that are neither background nor another zone.
  const edge = new Uint8Array(n);
  const grown = zone.slice();
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      if (zone[i] !== NONE || luminance(data[i * 4]!, data[i * 4 + 1]!, data[i * 4 + 2]!) > 240) continue;
      for (const q of [i - 1, i + 1, i - width, i + width]) {
        if (zone[q] !== NONE) {
          grown[i] = zone[q]!;
          edge[i] = 1;
          break;
        }
      }
    }
  }

  const counts = new Array<number>(zones.length + 1).fill(0);
  let unassignedProduct = 0;
  for (let i = 0; i < n; i++) {
    counts[grown[i]!]!++;
    if (grown[i] === NONE && !background[i]) unassignedProduct++;
  }

  return {
    zone: grown,
    edge,
    background,
    stats: zones.map((z, k) => ({
      zone: z.id,
      pixels: counts[k + 1]!,
      regions: regionsPerZone.get(k + 1) ?? 0,
    })),
    unassignedProduct,
  };
}
