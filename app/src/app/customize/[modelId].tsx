import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FINISH_LABEL, MATERIAL_LABEL, buildRenderPlan, tokens } from '@taitit/shared';
import { AppText, Button, Chip, EmptyState, Loader, Screen, Swatch, useToast } from '@/ui';
import { useAuth, useRequireAuth } from '@/auth/AuthProvider';
import { useCatalog, useSwatches } from '@/catalog/useCatalog';
import type { CatalogModel, CatalogSwatch } from '@/catalog/catalog';
import { restorePicks, selectionKey, storedFor, toSelection, type Design } from '@/designs/designs';
import { useDesignMutations, useDesigns } from '@/designs/useDesigns';
import { NameSheet } from '@/designs/NameSheet';
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

const saveError = (e: unknown) =>
  e instanceof Error && e.message === 'design_missing'
    ? 'This design no longer exists. Save it as a new design.'
    : "Couldn't save. Check your connection and try again.";

// Customizer: the model photo recolored live, one zone at a time, with finish, undo / reset, a
// before/after view of the original combination, and saving as a design.
// Opened from the catalog (/customize/<model>) or from My designs (/customize/<model>?designId=<id>).
export default function CustomizeScreen() {
  const { modelId, designId } = useLocalSearchParams<{ modelId: string; designId?: string }>();
  const { session } = useAuth();
  const catalog = useCatalog();
  const swatchesQuery = useSwatches();
  const designs = useDesigns();
  const model = catalog.data?.find((m) => m.id === modelId);
  const found = designId ? designs.data?.find((d) => d.id === designId) : undefined;
  // Once a design is open it stays open: a refresh of the list (it was deleted on another device,
  // or the session ended) must not throw away the customer's unsaved changes.
  const [opened, setOpened] = useState<Design | undefined>(undefined);
  if (found && opened?.id !== found.id) setOpened(found);
  const design = opened?.id === designId ? opened : found;

  const waitingForDesign = !!designId && !!session && designs.isPending && !design;
  if (catalog.isPending || swatchesQuery.isPending || waitingForDesign)
    return <Loader message="Loading model…" />;
  if ((catalog.isError && !catalog.data) || (swatchesQuery.isError && !swatchesQuery.data))
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this model"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => {
            void catalog.refetch();
            void swatchesQuery.refetch();
          }}
        />
      </Screen>
    );
  if (designId && !design && designs.isError)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this design"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void designs.refetch()}
        />
      </Screen>
    );
  if (designId && !design)
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Design not found"
          message={session ? 'It may have been deleted.' : 'Sign in to open your designs.'}
          actionLabel={session ? 'Back' : 'Sign in'}
          onAction={() => (session ? router.back() : router.push('/sign-in'))}
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

  // Keyed: opening another design (or the plain model) starts from its own state.
  return (
    <Customizer
      key={design?.id ?? model.id}
      model={model}
      swatches={swatchesQuery.data ?? []}
      design={design}
    />
  );
}

function Customizer({
  model,
  swatches,
  design,
}: {
  model: CatalogModel;
  swatches: CatalogSwatch[];
  design: Design | undefined;
}) {
  const { width } = useWindowDimensions();
  const { session } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  // Ordering needs an account (guests are sent to sign in, then come back here).
  const requireAuth = useRequireAuth();
  const { create, update } = useDesignMutations();
  // A saved design opens as saved; colors or finishes no longer offered are replaced (listed in the notice).
  const [restored] = useState(() =>
    design ? restorePicks(model.zones, swatches, design.selection) : { picks: {}, replaced: [] as string[] },
  );
  const [history, setHistory] = useState<History>({ ...emptyHistory, picks: restored.picks });
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [compare, setCompare] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(restored.replaced.length > 0);
  // The design being edited (set after the first save) and what it was last saved as.
  const [saved, setSaved] = useState<{ id: string; name: string; key: string } | null>(() =>
    design
      ? {
          id: design.id,
          name: design.name,
          // Compared with what is stored (for the model's current zones): anything shown differently
          // (a replaced color or finish, a zone added since) offers "Save changes".
          key: selectionKey(storedFor(model.zones, design.selection)),
        }
      : null,
  );
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);
  // A guest pressed "Save design" and was sent to sign in. A ref, not state: setting it must not
  // re-run the focus effect below while this screen is still focused.
  const saveAfterSignIn = useRef(false);

  // Back from the sign-in screen, signed in: continue the save the guest started. Runs on focus and
  // again when the session arrives, whichever comes last.
  useFocusEffect(
    useCallback(() => {
      if (!saveAfterSignIn.current || !session) return;
      saveAfterSignIn.current = false;
      setNaming(true);
    }, [session]),
  );

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
  const selection = toSelection(model.zones, swatches, picks);
  const unsaved = !saved || selectionKey(selection) !== saved.key;

  const createNamed = async (name: string) => {
    try {
      const d = await create.mutateAsync({ modelId: model.id, name, selection });
      setSaved({ id: d.id, name: d.name, key: selectionKey(d.selection) });
      toast('Design saved', 'success');
    } catch (e) {
      return saveError(e);
    }
  };
  const onSave = async () => {
    if (!session) {
      saveAfterSignIn.current = true;
      router.push('/sign-in');
      return;
    }
    if (!saved) return setNaming(true);
    setBusy(true);
    try {
      const d = await update.mutateAsync({ id: saved.id, selection });
      setSaved({ id: d.id, name: d.name, key: selectionKey(d.selection) });
      setNoticeOpen(false);
      toast('Changes saved', 'success');
    } catch (e) {
      toast(saveError(e), 'error');
      // Deleted elsewhere: the next save creates a new design.
      if (e instanceof Error && e.message === 'design_missing') setSaved(null);
    } finally {
      setBusy(false);
    }
  };
  // Any change shows the design again (the customer sees what they just did).
  const change = (next: (h: History) => History) => {
    setCompare(false);
    setHistory(next);
  };

  return (
    <View style={styles.root}>
      <Stack.Screen options={{ title: saved?.name ?? model.name }} />
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
        {noticeOpen ? (
          <View style={styles.notice}>
            <AppText variant="small" style={styles.noticeText}>
              Some colors or finishes of this design are no longer available and were replaced:{' '}
              {restored.replaced.join(', ')}.
            </AppText>
            <Button title="OK" variant="ghost" size="sm" onPress={() => setNoticeOpen(false)} />
          </View>
        ) : null}
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
        {zone && groups.length === 0 ? (
          <EmptyState
            icon="color-palette-outline"
            title="No colors available"
            message="This part has no colors to choose from right now."
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
      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Button
          title={!saved ? 'Save design' : unsaved ? 'Save changes' : 'Saved'}
          icon={saved && !unsaved ? 'checkmark' : 'heart-outline'}
          variant="secondary"
          disabled={!unsaved || zones.length === 0}
          loading={busy}
          onPress={onSave}
          style={styles.footerButton}
        />
        <Button
          title="Order"
          onPress={() =>
            requireAuth(() =>
              router.push({
                pathname: '/order/summary',
                params: { modelId: model.id, sel: JSON.stringify(selection) },
              }),
            )
          }
          style={styles.footerButton}
        />
      </View>
      <NameSheet
        visible={naming}
        title="Save design"
        initialName={`${model.name} design`}
        submitLabel="Save"
        onSubmit={createNamed}
        onClose={() => setNaming(false)}
      />
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
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  noticeText: { flex: 1 },
  footerButton: { flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
