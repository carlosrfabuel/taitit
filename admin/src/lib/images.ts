import { supabase } from './supabase';

const BUCKET = 'models';

/** Upload rules. Size and types match the "models" bucket limits (storage migration). */
export const IMAGE_RULES = {
  maxBytes: 10 * 1024 * 1024,
  baseTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minBaseWidth: 1000, // sharp on phone screens
  // Phones show the photo at ~1000 px and decode every layer at full size: more is only memory.
  // (tools/zones exports 1600 px.)
  maxSide: 2048,
} as const;

export type Size = { width: number; height: number };

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** Decodes the image; for PNGs also samples the alpha channel (mask present and not empty). */
async function inspect(file: File) {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  const { width, height } = bitmap;
  // Downscaled sample is enough to know whether the layer has transparent and visible parts.
  const scale = Math.min(1, 512 / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let transparent = false;
  let visible = false;
  for (let i = 3; i < data.length && !(transparent && visible); i += 4) {
    if (data[i]! < 250) transparent = true;
    if (data[i]! > 5) visible = true;
  }
  return { width, height, transparent, visible };
}

/** Checks a tortoiseshell texture (the "textures" bucket allows 5 MB). */
export async function checkTexture(file: File): Promise<{ size: Size } | { error: string }> {
  if (!(IMAGE_RULES.baseTypes as readonly string[]).includes(file.type))
    return { error: 'Invalid format: use JPG, PNG or WebP.' };
  if (file.size > 5 * 1024 * 1024)
    return { error: `The texture is ${mb(file.size)}; the maximum is 5.0 MB.` };
  const info = await inspect(file);
  if (!info) return { error: 'Could not read the image. Is it damaged?' };
  if (Math.min(info.width, info.height) < 256)
    return { error: `The texture is ${info.width} × ${info.height} px; the minimum is 256 px per side.` };
  return { size: { width: info.width, height: info.height } };
}

type Bucket = 'models' | 'textures';

export const publicUrl = (path: string, bucket: Bucket = BUCKET) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Uploads under a new name every time: public files are cached by the CDN, so reusing a name
 * could keep showing the old image. The previous file is removed after the database points to the new one.
 */
export async function uploadImage(
  folder: string,
  kind: 'base' | 'zone' | 'texture',
  file: File,
  bucket: Bucket = BUCKET,
): Promise<string> {
  const path = `${folder}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type] ?? 'png'}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/**
 * Best effort, never throws: a file left behind is only wasted space, never shown, and a cleanup
 * failure must not hide the error that matters (e.g. the database refusing a change).
 */
export async function removeImages(paths: (string | null | undefined)[], bucket: Bucket = BUCKET) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  try {
    await supabase.storage.from(bucket).remove(list);
  } catch {
    // ignored on purpose (see above)
  }
}
