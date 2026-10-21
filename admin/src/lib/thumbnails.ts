import { THUMB_WIDTH, buildRenderPlan, renderKey, type RenderPlan } from '@taitit/shared';
import { supabase } from './supabase';
import { publicUrl, removeImages } from './images';
import { drawPlan } from './render';
import type { ModelRow } from './models';
import type { ZoneRow } from './zones';
import { toRenderSwatch, type SwatchRow } from './swatches';

/** The model in its default colors: what the catalog thumbnail shows (null without a base image). */
export function defaultPlan(model: ModelRow, zones: ZoneRow[], swatches: SwatchRow[]): RenderPlan | null {
  if (!model.base_path || !model.base_width || !model.base_height) return null;
  return buildRenderPlan({
    baseUrl: publicUrl(model.base_path),
    width: model.base_width,
    height: model.base_height,
    zones: zones
      .filter((z) => z.model_id === model.id)
      .map((z) => ({
        id: z.id,
        layerUrl: z.layer_path ? publicUrl(z.layer_path) : null,
        defaultSwatchId: z.default_swatch_id,
        defaultFinish: z.default_finish,
        sortOrder: z.sort_order,
        patternUrl: z.pattern_path ? publicUrl(z.pattern_path) : null,
        patternOwn: z.pattern_own,
        patternHex: z.pattern_hex,
      })),
    swatches: swatches.map(toRenderSwatch),
  });
}

/**
 * Renders the plan and saves it as the catalog thumbnail (see the thumbnails migration): new JPEG
 * first, then the row (path + key), then the old file is removed. The row is only updated if it
 * still points to the thumbnail read at the start, so two saves at once can't orphan a file.
 * Returns "degraded" (nothing saved) when a texture failed to load: that render isn't what the key
 * says; "skipped" when another save won or the model is gone; throws on network/storage errors.
 */
export async function saveThumbnail(
  modelId: string,
  plan: RenderPlan,
): Promise<'saved' | 'degraded' | 'skipped'> {
  const full = document.createElement('canvas');
  const { degraded } = await drawPlan(full, plan);
  if (degraded) return 'degraded';
  const w = Math.min(THUMB_WIDTH, full.width);
  const h = Math.round((full.height * w) / full.width);
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const ctx = small.getContext('2d')!;
  ctx.fillStyle = '#ffffff'; // JPEG has no transparency
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(full, 0, 0, w, h);
  const blob = await new Promise<Blob>((resolve, reject) =>
    small.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85),
  );

  const current = await supabase.from('models').select('thumb_path').eq('id', modelId).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) return 'skipped'; // deleted meanwhile
  const previous = current.data.thumb_path;

  const path = `${modelId}/thumb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await supabase.storage
    .from('models')
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw up.error;
  const update = supabase
    .from('models')
    .update({ thumb_path: path, thumb_key: renderKey(plan) })
    .eq('id', modelId);
  const { data, error } = await (
    previous ? update.eq('thumb_path', previous) : update.is('thumb_path', null)
  ).select('id');
  if (error || !data.length) {
    await removeImages([path]); // someone else saved a thumbnail first (or the model is gone)
    if (error) throw error;
    return 'skipped';
  }
  if (previous) await removeImages([previous]);
  return 'saved';
}
