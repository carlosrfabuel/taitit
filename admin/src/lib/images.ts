import { supabase } from './supabase';

const BUCKET = 'models';

/** Upload rules. Size and types match the "models" bucket limits (storage migration). */
export const IMAGE_RULES = {
  maxBytes: 10 * 1024 * 1024,
  baseTypes: ['image/jpeg', 'image/png', 'image/webp'],
  minBaseWidth: 1000, // sharp on phone screens
  maxSide: 4096, // keeps the recolor fast on phones
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

/** Checks a base image; returns its size or a Spanish error. */
export async function checkBaseImage(file: File): Promise<{ size: Size } | { error: string }> {
  if (!(IMAGE_RULES.baseTypes as readonly string[]).includes(file.type))
    return { error: 'Formato no válido: usa JPG, PNG o WebP.' };
  if (file.size > IMAGE_RULES.maxBytes)
    return { error: `La imagen pesa ${mb(file.size)}; el máximo es ${mb(IMAGE_RULES.maxBytes)}.` };
  const info = await inspect(file);
  if (!info) return { error: 'No se pudo leer la imagen. ¿Está dañada?' };
  if (info.width < IMAGE_RULES.minBaseWidth)
    return {
      error: `La imagen mide ${info.width} px de ancho; el mínimo es ${IMAGE_RULES.minBaseWidth} px.`,
    };
  if (Math.max(info.width, info.height) > IMAGE_RULES.maxSide)
    return {
      error: `La imagen mide ${info.width} × ${info.height} px; el máximo es ${IMAGE_RULES.maxSide} px por lado.`,
    };
  return { size: { width: info.width, height: info.height } };
}

/** Checks a zone layer against the base image; returns its size or a Spanish error. */
export async function checkLayer(file: File, base: Size | null): Promise<{ size: Size } | { error: string }> {
  if (!base) return { error: 'Sube primero la imagen base del modelo.' };
  if (file.type !== 'image/png') return { error: 'La capa debe ser PNG (con transparencia).' };
  if (file.size > IMAGE_RULES.maxBytes)
    return { error: `La capa pesa ${mb(file.size)}; el máximo es ${mb(IMAGE_RULES.maxBytes)}.` };
  const info = await inspect(file);
  if (!info) return { error: 'No se pudo leer la capa. ¿Está dañada?' };
  if (info.width !== base.width || info.height !== base.height)
    return {
      error: `La capa mide ${info.width} × ${info.height} px; debe medir lo mismo que la imagen base (${base.width} × ${base.height} px).`,
    };
  if (!info.transparent) return { error: 'La capa no tiene transparencia: solo la zona debe ser visible.' };
  if (!info.visible) return { error: 'La capa está vacía (totalmente transparente).' };
  return { size: { width: info.width, height: info.height } };
}

export const publicUrl = (path: string) => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

/**
 * Uploads under a new name every time: public files are cached by the CDN, so reusing a name
 * could keep showing the old image. The previous file is removed after the database points to the new one.
 */
export async function uploadImage(modelId: string, kind: 'base' | 'zone', file: File): Promise<string> {
  const path = `${modelId}/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${EXT[file.type] ?? 'png'}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

/**
 * Best effort, never throws: a file left behind is only wasted space, never shown, and a cleanup
 * failure must not hide the error that matters (e.g. the database refusing a change).
 */
export async function removeImages(paths: (string | null | undefined)[]) {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return;
  try {
    await supabase.storage.from(BUCKET).remove(list);
  } catch {
    // ignored on purpose (see above)
  }
}
