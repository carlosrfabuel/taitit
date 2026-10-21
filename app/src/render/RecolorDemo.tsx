import { useEffect, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { buildRenderPlan, tokens, type RenderPick, type RenderPlan } from '@taitit/shared';
import { supabase } from '@/lib/supabase';
import { AppText, Chip, Loader } from '@/ui';
import { RecolorView } from './RecolorView';

// Development-only check of the renderer on a real model (UI kit screen), with a fixed test colorway.

const storageUrl = (bucket: string, path: string) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

/** The renderer parity colorway (same as the admin test): gold gloss metal, translucent blue, red. */
const TEST: Record<string, { ref: string; finish: 'gloss' | null }> = {
  'Front & temples': { ref: 'PH-M06', finish: 'gloss' },
  Rims: { ref: 'PH-A12', finish: null },
  'Temple tips': { ref: 'PH-A06', finish: null },
};

type Data = Awaited<ReturnType<typeof load>>;

async function load() {
  const model = await supabase
    .from('models')
    .select(
      'id, name, base_path, base_width, base_height, model_zones(id, name, layer_path, default_swatch_id, default_finish, sort_order, pattern_path, pattern_hex, pattern_own)',
    )
    .eq('published', true)
    .order('sort_order')
    .limit(1)
    .single();
  if (model.error) throw model.error;
  const swatches = await supabase
    .from('swatches')
    .select('id, ref, hex, kind, alpha, texture_path, finishes');
  if (swatches.error) throw swatches.error;
  return { model: model.data, swatches: swatches.data };
}

export function RecolorDemo() {
  const { width } = useWindowDimensions();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [colorway, setColorway] = useState<'default' | 'test'>('default');

  useEffect(() => {
    load().then(setData, (e: Error) => setError(e.message));
  }, []);

  if (error) return <AppText color={tokens.colors.danger}>Could not load a model: {error}</AppText>;
  if (!data) return <Loader message="Loading model…" />;

  const { model, swatches } = data;
  if (!model.base_path || !model.base_width || !model.base_height)
    return <AppText>Model has no base image.</AppText>;
  const byRef = new Map(swatches.map((s) => [s.ref, s.id]));
  const picks: Record<string, RenderPick> = {};
  if (colorway === 'test')
    for (const z of model.model_zones) {
      const t = TEST[z.name];
      if (t) picks[z.id] = { swatchId: byRef.get(t.ref) ?? null, finish: t.finish };
    }
  const plan: RenderPlan = buildRenderPlan({
    baseUrl: storageUrl('models', model.base_path),
    width: model.base_width,
    height: model.base_height,
    zones: model.model_zones.map((z) => ({
      id: z.id,
      layerUrl: z.layer_path ? storageUrl('models', z.layer_path) : null,
      defaultSwatchId: z.default_swatch_id,
      defaultFinish: z.default_finish,
      sortOrder: z.sort_order,
      patternUrl: z.pattern_path ? storageUrl('models', z.pattern_path) : null,
      patternOwn: z.pattern_own,
    })),
    swatches: swatches.map((s) => ({
      id: s.id,
      hex: s.hex,
      kind: s.kind,
      alpha: s.alpha,
      textureUrl: s.texture_path ? storageUrl('textures', s.texture_path) : null,
      finishes: s.finishes,
    })),
    picks,
  });

  return (
    <View style={styles.wrap}>
      <AppText variant="subheading">{model.name}</AppText>
      <RecolorView plan={plan} width={width - tokens.spacing.xl * 2} />
      <View style={styles.row}>
        <Chip
          label="Default colors"
          selected={colorway === 'default'}
          onPress={() => setColorway('default')}
        />
        <Chip label="Test colors" selected={colorway === 'test'} onPress={() => setColorway('test')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: tokens.spacing.sm },
  row: { flexDirection: 'row', gap: tokens.spacing.sm, flexWrap: 'wrap' },
});
