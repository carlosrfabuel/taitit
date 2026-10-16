import sharp from 'sharp';

/** RGBA pixels, row-major. */
export type Raster = { width: number; height: number; data: Uint8Array };
export type Crop = { left: number; top: number; width: number; height: number };

export const luminance = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Studio photos are shot on white: near-white, low-saturation pixels are background. */
export function isBackground(data: Uint8Array, i: number, threshold: number): boolean {
  const r = data[i * 4]!;
  const g = data[i * 4 + 1]!;
  const b = data[i * 4 + 2]!;
  return Math.min(r, g, b) >= threshold && Math.max(r, g, b) - Math.min(r, g, b) < 25;
}

/** Bounding box of the product (non-background pixels) plus a margin, in original pixels. */
export async function autoCrop(input: string, threshold: number, marginRatio = 0.03): Promise<Crop> {
  const probeWidth = 800;
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: probeWidth })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const px = new Uint8Array(data.buffer, data.byteOffset, data.length);
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (!isBackground(px, y * info.width + x, threshold)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error('No product found: the whole photo looks like background.');

  const meta = await sharp(input).rotate().metadata();
  const fullW = meta.autoOrient?.width ?? meta.width!;
  const fullH = meta.autoOrient?.height ?? meta.height!;
  const scale = fullW / info.width;
  const mx = (maxX - minX) * marginRatio;
  const my = (maxY - minY) * marginRatio;
  const left = Math.max(0, Math.floor((minX - mx) * scale));
  const top = Math.max(0, Math.floor((minY - my) * scale));
  const right = Math.min(fullW, Math.ceil((maxX + 1 + mx) * scale));
  const bottom = Math.min(fullH, Math.ceil((maxY + 1 + my) * scale));
  return { left, top, width: right - left, height: bottom - top };
}

export async function loadCropped(input: string, crop: Crop, outWidth: number): Promise<Raster> {
  const { data, info } = await sharp(input)
    .rotate()
    .extract(crop)
    .resize({ width: outWidth })
    .flatten({ background: '#ffffff' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    width: info.width,
    height: info.height,
    data: new Uint8Array(data.buffer, data.byteOffset, data.length),
  };
}

export function writePng(raster: Raster, file: string) {
  return sharp(Buffer.from(raster.data), { raw: { width: raster.width, height: raster.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(file);
}

export function writeJpeg(raster: Raster, file: string, quality = 90) {
  return sharp(Buffer.from(raster.data), { raw: { width: raster.width, height: raster.height, channels: 4 } })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality, mozjpeg: true })
    .toFile(file);
}

/** Gaussian-blurred copy of a single-channel image (used to smooth patterned originals). */
export async function blurChannel(values: Float32Array, width: number, height: number, sigma: number) {
  const bytes = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) bytes[i] = Math.max(0, Math.min(255, Math.round(values[i]!)));
  const out = await sharp(Buffer.from(bytes), { raw: { width, height, channels: 1 } })
    .blur(sigma)
    .raw()
    .toBuffer();
  return Float32Array.from(out);
}
