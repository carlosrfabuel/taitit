import { THUMB_WIDTH } from '@taitit/shared';
import { supabase } from './supabase';
import { removeImages } from './images';

/**
 * Saves the catalog thumbnail from a full-size render of the model's default colors (see the
 * thumbnails migration): new JPEG first, then the row (path + key), then the old file is removed.
 */
export async function saveThumbnail(
  model: { id: string },
  render: HTMLCanvasElement,
  key: string,
): Promise<void> {
  const w = Math.min(THUMB_WIDTH, render.width);
  const h = Math.round((render.height * w) / render.width);
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // JPEG has no transparency
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(render, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    small.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85),
  );

  const current = await supabase.from('models').select('thumb_path').eq('id', model.id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw { code: 'not_found', message: 'Model not found' };

  const path = `${model.id}/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await supabase.storage
    .from('models')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const { data, error } = await supabase
    .from('models')
    .update({ thumb_path: path, thumb_key: key })
    .eq('id', model.id)
    .select('id');
  if (error || !data.length) {
    await removeImages([path]);
    throw error ?? { code: 'not_found', message: 'Model not found' };
  }
  if (current.data.thumb_path && current.data.thumb_path !== path)
    await removeImages([current.data.thumb_path]);
}
