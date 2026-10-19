import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { FINISH_LABEL, MATERIAL_LABEL, buildRenderPlan, tokens } from '@taitit/shared';
import { AppText, Button, Chip, EmptyState, Loader, Screen, Swatch } from '@/ui';
import { useCatalog, useSwatches } from '@/catalog/useCatalog';
import { RecolorView } from '@/render/RecolorView';
import {
  applyFinish,
  applySwatch,
  commit,
  currentPick,
  effectivePicks,
  emptyHistory,
  isCustomized,
  paletteGroups,
  reset,
  undo,
  type History,
} from '@/customize/customizer';

const { spacing, colors } = tokens;
const PAGE = spacing.xl;

// Customizer: the model photo recolored live, one zone at a time, with finish, undo / reset and a
// before/after view of the original combination. Saving designs comes on Day 14.
export default function CustomizeScreen() {
  const { modelId } = useLocalSearchParams<{ modelId: string }>();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const swatchesQuery = useSwatches();
  const [history, setHistory] = useState<History>(emptyHistory);
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [compare, setCompare] = useState(false);
  const model = catalog.data?.find((m) => m.id === modelId);

  if (catalog.isPending) return <Loader message="Loading model…" />;
  if (catalog.isError && !catalog.data)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this model"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void catalog.refetch()}
        />
      </Screen>
    );
  if (!model)
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Model not available"
          message="It may have been removed from the collection."
          actionLabel="Back to catalog"
          onAction={() => router.back()}
        />
      </Screen>
    );

  const swatches = swatchesQuery.data ?? [];
  const zones = model.zones.filter((z) => z.layerUrl);
  // The selected zone, or the first one (also when the selected zone was removed meanwhile).
  const zone = zones.find((z) => z.id === zoneId) ?? zones[0] ?? null;
  const { picks } = history;
  const showOriginal = holding || compare;
  const plan = buildRenderPlan({
    baseUrl: model.plan.baseUrl,
    width: model.plan.width,
    height: model.plan.height,
    zones: model.zones,
    swatches,
    // The original combination = the model's default colors.
    picks: showOriginal ? {} : effectivePicks(model.zones, swatches, picks),
  });
  const current = zone ? currentPick(zone, swatches, picks) : null;
  const selected = current?.swatch ?? null;
  const groups = zone ? paletteGroups(swatches, zone.material) : [];
  const customized = isCustomized(model.zones, swatches, picks);
  // Any change shows the design again (the customer sees what they just did).
  const change = (next: (h: History) => History) => {
    setCompare(false);
    setHistory(next);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: model.name }} />
      <Pressable
        style={styles.photo}
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        accessibilityLabel="Design preview. Touch and hold to see the original colors."
      >
        <RecolorView plan={plan} width={width - PAGE * 2} />
        {showOriginal ? (
          <View style={styles.badge} pointerEvents="none">
            <AppText variant="tiny" color={colors.onPrimary}>
              Original
            </AppText>
          </View>
        ) : null}
      </Pressable>
      <View style={styles.tools}>
        <Button
          title="Undo"
          icon="arrow-undo-outline"
          variant="ghost"
          size="sm"
          disabled={history.past.length === 0}
          onPress={() => change(undo)}
        />
        <Button
          title="Reset"
          icon="refresh-outline"
          variant="ghost"
          size="sm"
          disabled={!customized}
          onPress={() => change((h) => reset(h, model.zones, swatches))}
        />
        <Button
          title={compare ? 'My design' : 'Original'}
          icon={compare ? 'eye-off-outline' : 'eye-outline'}
          variant="ghost"
          size="sm"
          disabled={!customized && !compare}
          onPress={() => setCompare((c) => !c)}
        />
      </View>
      {zones.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.zonesBar}
          contentContainerStyle={styles.zones}
        >
          {zones.map((z) => (
            <Chip
              key={z.id}
              label={`${z.name} · ${MATERIAL_LABEL[z.material]}`}
              selected={z.id === zone?.id}
              onPress={() => setZoneId(z.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      <ScrollView style={styles.palette} contentContainerStyle={styles.paletteContent}>
        {zone && swatchesQuery.isPending ? <Loader message="Loading colors…" /> : null}
        {selected ? (
          <View style={styles.selection}>
            <AppText variant="subheading">
              {selected.name} · {selected.ref}
            </AppText>
            {selected.finishes.length > 1 ? (
              <View style={styles.finishes}>
                {selected.finishes.map((f) => (
                  <Chip
                    key={f}
                    label={FINISH_LABEL[f]}
                    selected={current?.finish === f}
                    onPress={() => change((h) => commit(h, applyFinish(h.picks, zone!, swatches, f)))}
                  />
                ))}
              </View>
            ) : selected.finishes.length === 1 ? (
              <AppText variant="small">Finish: {FINISH_LABEL[selected.finishes[0]!]}</AppText>
            ) : null}
          </View>
        ) : null}
        {zone && !swatchesQuery.isPending && groups.length === 0 ? (
          <EmptyState
            icon="color-palette-outline"
            title="No colors available"
            message="This part has no colors to choose from right now."
            actionLabel="Try again"
            onAction={() => void swatchesQuery.refetch()}
          />
        ) : null}
        {zone
          ? groups.map((g) => (
              <View key={g.kind} style={styles.group}>
                <AppText variant="label" color={colors.muted}>
                  {g.label}
                </AppText>
                <View style={styles.swatches}>
                  {g.swatches.map((s) => (
                    <Swatch
                      key={s.id}
                      hex={s.hex}
                      alpha={s.kind === 'translucent' ? s.alpha : null}
                      texture={s.kind === 'havana' ? s.textureUrl : null}
                      selected={s.id === selected?.id}
                      onPress={() => change((h) => commit(h, applySwatch(h.picks, zone, swatches, s)))}
                      accessibilityLabel={`${s.name}, ${s.ref}`}
                    />
                  ))}
                </View>
              </View>
            ))
          : null}
        <AppText variant="tiny" color={colors.muted}>
          Colors may vary slightly depending on your screen.
        </AppText>
      </ScrollView>
      <View style={styles.footer}>
        <Button title="Order" fullWidth onPress={() => router.push('/order/summary')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  photo: { paddingHorizontal: PAGE, paddingTop: spacing.lg, paddingBottom: spacing.md },
  badge: {
    position: 'absolute',
    top: spacing.lg + spacing.sm,
    left: PAGE + spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: tokens.radius.sm,
    backgroundColor: colors.overlay,
  },
  tools: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  selection: { gap: spacing.sm },
  finishes: { flexDirection: 'row', gap: spacing.sm },
  zonesBar: { flexGrow: 0 },
  zones: { paddingHorizontal: PAGE, gap: spacing.sm, paddingVertical: spacing.sm },
  palette: { flex: 1 },
  paletteContent: { padding: PAGE, gap: spacing.xl },
  group: { gap: spacing.sm },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
