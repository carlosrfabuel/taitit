import { GLOSS_STOPS, SHADE_GAIN, highlightOf, type RenderPlan } from '@taitit/shared';

// Canvas 2D implementation of the shared recolor recipe (shared/src/render.ts). Same math as the
// app's Skia renderer and the tools/zones preview: fill → multiply shading → screen highlight → screen
// gloss → clip to the layer shape → draw with the swatch opacity. A havana with a tortoiseshell pattern
// fills with the pattern through its color matrix instead of fill + shading + highlight (the pattern
// holds the photo's light).

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

// The layer's shading × SHADE_GAIN (capped at 255) and its highlight, each with alpha forced opaque:
// canvas "multiply" and "screen" blend partially transparent pixels with the fill, so the shape (alpha)
// is applied separately, exactly like the recipe.
const shades = new Map<string, Promise<{ shade: HTMLCanvasElement; highlight: HTMLCanvasElement }>>();
function opaqueShade(url: string, w: number, h: number) {
  const key = `${url}@${w}x${h}`;
  let p = recall(shades, key);
  if (!p) {
    p = loadImage(url).then((img) => {
      const shade = canvas(w, h);
      const ctx = shade.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const light = new ImageData(w, h);
      for (let i = 0; i < data.data.length; i += 4) {
        const v = 255 * highlightOf(data.data[i]! / 255);
        light.data[i] = v; // Uint8ClampedArray: rounds
        light.data[i + 1] = v;
        light.data[i + 2] = v;
        light.data[i + 3] = 255;
        data.data[i] = data.data[i]! * SHADE_GAIN; // rounds and caps at 255
        data.data[i + 1] = data.data[i + 1]! * SHADE_GAIN;
        data.data[i + 2] = data.data[i + 2]! * SHADE_GAIN;
        data.data[i + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
      const highlight = canvas(w, h);
      highlight.getContext('2d')!.putImageData(light, 0, 0);
      return { shade, highlight };
    });
    const mine = p;
    p.catch(() => shades.get(key) === mine && shades.delete(key));
    remember(shades, key, p);
  }
  return p;
}

/**
 * Draws the plan into `target` at the plan's full resolution (scale it with CSS). `isCurrent` is
 * checked before the canvas is touched: a render that finishes after a newer one started (e.g. a slow
 * texture) must not overwrite it. `degraded` is true when a texture could not be loaded and its
 * plain color was used instead (or a pattern could not, and color + shading was used): fine for a
 * preview, but such a render must not be saved as the catalog thumbnail.
 */
export async function drawPlan(
  target: HTMLCanvasElement,
  plan: RenderPlan,
  isCurrent: () => boolean = () => true,
): Promise<{ degraded: boolean }> {
  const { width: w, height: h } = plan;
  // Load everything first so a slow image never leaves a half-drawn preview.
  const base = await loadImage(plan.baseUrl);
  const layers = await Promise.all(
    plan.layers.map(async (l) => ({
      ...l,
      shape: await loadImage(l.layerUrl),
      shading: await opaqueShade(l.layerUrl, w, h),
      texture: l.textureUrl ? await loadImage(l.textureUrl).catch(() => null) : null,
      pattern: l.patternUrl ? await loadImage(l.patternUrl).catch(() => null) : null,
    })),
  );

  const out = canvas(w, h);
  const ctx = out.getContext('2d')!;
  ctx.drawImage(base, 0, 0, w, h);
  const zone = canvas(w, h);
  const z = zone.getContext('2d', { willReadFrequently: true })!;
  for (const l of layers) {
    z.globalCompositeOperation = 'source-over';
    z.clearRect(0, 0, w, h);
    if (l.pattern && l.patternMatrix) {
      // Tortoiseshell pattern through the havana color's matrix (no shading step), like Skia's ColorMatrix.
      z.drawImage(l.pattern, 0, 0, w, h);
      const px = z.getImageData(0, 0, w, h);
      const m = l.patternMatrix;
      for (let i = 0; i < px.data.length; i += 4) {
        const r = px.data[i]! / 255;
        const g = px.data[i + 1]! / 255;
        const b = px.data[i + 2]! / 255;
        for (let c = 0; c < 3; c++)
          px.data[i + c] = 255 * (m[c * 5]! * r + m[c * 5 + 1]! * g + m[c * 5 + 2]! * b + m[c * 5 + 4]!);
      }
      z.putImageData(px, 0, 0);
    } else {
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
      z.drawImage(l.shading.shade, 0, 0);
      z.globalCompositeOperation = 'screen';
      z.drawImage(l.shading.highlight, 0, 0);
    }
    if (l.gloss) {
      // screen with gray g: x + (1 − x)·g, the recipe's gloss.
      const grad = z.createLinearGradient(
        0,
        GLOSS_STOPS[0]![0] * h,
        0,
        GLOSS_STOPS[GLOSS_STOPS.length - 1]![0] * h,
      );
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

  const degraded = layers.some((l) => (l.textureUrl && !l.texture) || (l.patternUrl && !l.pattern));
  if (!isCurrent()) return { degraded };
  // Swap in one step: the visible canvas never shows a partial render.
  target.width = w;
  target.height = h;
  target.getContext('2d')!.drawImage(out, 0, 0);
  return { degraded };
}
