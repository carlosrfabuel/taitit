import { GLOSS_STOPS, type RenderPlan } from '@taitit/shared';

// Canvas 2D implementation of the shared recolor recipe (shared/src/render.ts). Same math as the
// app's Skia renderer and the tools/zones preview: fill → multiply shading → screen gloss → clip to
// the layer shape → draw with the swatch opacity.

// Small caches (most recently used kept): full-size images and canvases are large, and browsing many
// models must not keep all of them in memory.
const MAX_CACHED = 16;
function remember<T>(cache: Map<string, T>, key: string, value: T) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
}
function recall<T>(cache: Map<string, T>, key: string) {
  const v = cache.get(key);
  if (v !== undefined) remember(cache, key, v); // mark as recently used
  return v;
}

const images = new Map<string, Promise<HTMLImageElement>>();

export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = recall(images, url);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous'; // pixels are read back (Storage serves CORS headers)
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Could not load ${url}`));
      img.src = url;
    });
    // A failed load can be retried later (only this entry: a newer one may have replaced it).
    const mine = p;
    p.catch(() => images.get(url) === mine && images.delete(url));
    remember(images, url, p);
  }
  return p;
}

const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

// The layer's shading with alpha forced opaque: canvas "multiply" blends partially transparent
// pixels with the fill, so the shape (alpha) is applied separately, exactly like the recipe.
const shades = new Map<string, Promise<HTMLCanvasElement>>();
function opaqueShade(url: string, w: number, h: number) {
  const key = `${url}@${w}x${h}`;
  let p = recall(shades, key);
  if (!p) {
    p = loadImage(url).then((img) => {
      const c = canvas(w, h);
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      for (let i = 3; i < data.data.length; i += 4) data.data[i] = 255;
      ctx.putImageData(data, 0, 0);
      return c;
    });
    const mine = p;
    p.catch(() => shades.get(key) === mine && shades.delete(key));
    remember(shades, key, p);
  }
  return p;
}

/**
 * Draws the plan into `target` at the plan's full resolution (scale it with CSS). `degraded` is true
 * when a texture could not be loaded and its plain color was used instead: fine for a preview, but
 * such a render must not be saved as the catalog thumbnail.
 */
export async function drawPlan(target: HTMLCanvasElement, plan: RenderPlan): Promise<{ degraded: boolean }> {
  const { width: w, height: h } = plan;
  // Load everything first so a slow image never leaves a half-drawn preview.
  const base = await loadImage(plan.baseUrl);
  const layers = await Promise.all(
    plan.layers.map(async (l) => ({
      ...l,
      shape: await loadImage(l.layerUrl),
      shade: await opaqueShade(l.layerUrl, w, h),
      texture: l.textureUrl ? await loadImage(l.textureUrl).catch(() => null) : null,
    })),
  );

  const out = canvas(w, h);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(base, 0, 0, w, h);
  const zone = canvas(w, h);
  const z = zone.getContext('2d')!;
  for (const l of layers) {
    z.globalCompositeOperation = 'source-over';
    z.clearRect(0, 0, w, h);
    if (l.texture) {
      // Tortoiseshell: the texture covers the whole image (scaled to fill, centered).
      const s = Math.max(w / l.texture.width, h / l.texture.height);
      const tw = l.texture.width * s;
      const th = l.texture.height * s;
      z.drawImage(l.texture, (w - tw) / 2, (h - th) / 2, tw, th);
    } else {
      z.fillStyle = l.hex;
      z.fillRect(0, 0, w, h);
    }
    z.globalCompositeOperation = 'multiply';
    z.drawImage(l.shade, 0, 0);
    if (l.gloss) {
      // screen with gray g: x + (1 − x)·g, the recipe's gloss.
      const grad = z.createLinearGradient(0, GLOSS_STOPS[0]![0] * h, 0, GLOSS_STOPS[2]![0] * h);
      GLOSS_STOPS.forEach(([, amount], i) => {
        const v = Math.round(amount * 255);
        grad.addColorStop(i / (GLOSS_STOPS.length - 1), `rgb(${v},${v},${v})`);
      });
      z.globalCompositeOperation = 'screen';
      z.fillStyle = grad;
      z.fillRect(0, 0, w, h);
    }
    z.globalCompositeOperation = 'destination-in';
    z.drawImage(l.shape, 0, 0, w, h);
    ctx.globalAlpha = l.opacity;
    ctx.drawImage(zone, 0, 0);
    ctx.globalAlpha = 1;
  }

  // Swap in one step: the visible canvas never shows a partial render.
  target.width = w;
  target.height = h;
  target.getContext('2d')!.drawImage(out, 0, 0);
  return { degraded: layers.some((l) => l.textureUrl && !l.texture) };
}
