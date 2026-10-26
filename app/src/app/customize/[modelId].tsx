import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FINISH_LABEL, MATERIAL_LABEL, buildRenderPlan, tokens } from '@taitit/shared';
import {
  AppText,
  Button,
  Chip,
  EmptyState,
  Icon,
  Loader,
  PhotoStage,
  PHOTO_STAGE_INSET,
  Screen,
  Swatch,
  useToast,
} from '@/ui';
import { useAuth, useRequireAuth } from '@/auth/AuthProvider';
import { CART_MAX, useCart, type CartLine } from '@/orders/cart';
import { CartButton } from '@/orders/CartButton';
import { QUANTITY_MAX } from '@/orders/orders';
import { useCatalog, useSwatches } from '@/catalog/useCatalog';
import type { CatalogModel, CatalogSwatch } from '@/catalog/catalog';
import { restorePicks, selectionKey, storedFor, toSelection, type Design } from '@/designs/designs';
import { useDesignMutations, useDesigns } from '@/designs/useDesigns';
import { NameSheet } from '@/designs/NameSheet';
import { RecolorView } from '@/render/RecolorView';
import {
  chooseFinish,
  chooseSwatch,
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
const SWATCH_GAP = spacing.sm;
// The photo stage (PhotoStage), almost edge to edge.
const STAGE_MARGIN = spacing.sm;
// Fade over the right end of the zone chips while more are hidden there (opacity per 8 px strip).
const FADE = [0.2, 0.45, 0.7, 0.9, 1];
const FADE_STRIP = 8;
const FADE_WIDTH = FADE.length * FADE_STRIP;

const saveError = (e: unknown) => {
  const message = (e as { message?: string } | null)?.message ?? '';
  if (message === 'design_missing') return 'This design no longer exists. Save it as a new design.';
  if (message.includes('design_model_unavailable'))
    return 'This model is no longer available, so the design cannot be saved.';
  return "Couldn't save. Check your connection and try again.";
};

// Customizer: the model photo recolored live, one zone at a time, with finish, undo / reset, a
// before/after view of the original combination, and saving as a design.
// Opened from the catalog (/customize/<model>), from My designs (/customize/<model>?designId=<id>) or
// from the order screen to change a frame's colors (/customize/<model>?lineId=<frame id>).
export default function CustomizeScreen() {
  const { modelId, designId, lineId } = useLocalSearchParams<{
    modelId: string;
    designId?: string;
    lineId?: string;
  }>();
  const { session } = useAuth();
  const cart = useCart();
  // The frame being changed (gone, e.g. the order was sent meanwhile: a plain "Add to cart"). Held once
  // open, like a design: joining it into another frame on "Update frame" must not reset the screen as it closes.
  const foundLine = lineId ? cart.lines.find((l) => l.id === lineId && l.modelId === modelId) : undefined;
  const [openedLine, setOpenedLine] = useState<CartLine | undefined>(undefined);
  if (foundLine && openedLine?.id !== foundLine.id) setOpenedLine(foundLine);
  const line = openedLine?.id === lineId ? openedLine : foundLine;
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
      key={line?.id ?? design?.id ?? model.id}
      model={model}
      swatches={swatchesQuery.data ?? []}
      design={design}
      line={line}
    />
  );
}

function Customizer({
  model,
  swatches,
  design,
  line,
}: {
  model: CatalogModel;
  swatches: CatalogSwatch[];
  design: Design | undefined;
  line?: CartLine;
}) {
  const { width } = useWindowDimensions();
  // Swatch rows fill the width: as many as fit at the minimum size, then grown to share it equally.
  const paletteWidth = width - PAGE * 2;
  const swatchColumns = Math.max(
    1,
    Math.floor((paletteWidth + SWATCH_GAP) / (tokens.swatch.lg + SWATCH_GAP)),
  );
  const swatchSize = Math.floor((paletteWidth - SWATCH_GAP * (swatchColumns - 1)) / swatchColumns);
  const { session } = useAuth();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  // Ordering needs an account (guests are sent to sign in, then come back here).
  const requireAuth = useRequireAuth();
  const cart = useCart();
  const { create, update } = useDesignMutations();
  // A saved design (or a frame of the order) opens as it was; colors or finishes no longer offered are
  // replaced (listed in the notice).
  const [restored] = useState(() => {
    const from = design?.selection ?? line?.selection;
    return from ? restorePicks(model.zones, swatches, from) : { picks: {}, replaced: [] as string[] };
  });
  const [history, setHistory] = useState<History>({ ...emptyHistory, picks: restored.picks });
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [holding, setHolding] = useState(false);
  const [compare, setCompare] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(restored.replaced.length > 0);
  // More zone chips hidden to the right of the row (shows the fade).
  const [zonesMore, setZonesMore] = useState(false);
  const zonesBox = useRef({ width: 0, content: 0, x: 0 });
  const updateZonesMore = useCallback((next: Partial<{ width: number; content: number; x: number }>) => {
    const box = Object.assign(zonesBox.current, next);
    setZonesMore(box.content - box.width - box.x > 4);
  }, []);
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

  // A chip chosen while partly hidden (under the fade or off screen) scrolls fully into view.
  const zonesRow = useRef<ScrollView>(null);
  const chipBoxes = useRef<Record<string, { x: number; width: number }>>({});
  const rememberChip = (id: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    chipBoxes.current[id] = { x, width };
  };
  const chooseZone = (id: string) => {
    setZoneId(id);
    const chip = chipBoxes.current[id];
    const box = zonesBox.current;
    if (!chip || !box.width) return;
    if (chip.x + chip.width + FADE_WIDTH > box.x + box.width)
      zonesRow.current?.scrollTo({ x: chip.x + chip.width + FADE_WIDTH - box.width, animated: true });
    else if (chip.x - PAGE < box.x)
      zonesRow.current?.scrollTo({ x: Math.max(0, chip.x - PAGE), animated: true });
  };

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

  const saveLabel = !saved ? 'Save design' : unsaved ? 'Save changes' : 'Saved';
  const saveDisabled = !unsaved || zones.length === 0;

  return (
    <View style={styles.root}>
      {/* The bag leads to the order; not while changing one of its frames (the order is right behind). */}
      <Stack.Screen
        options={{ title: saved?.name ?? model.name, headerRight: line ? undefined : () => <CartButton /> }}
      />
      <Pressable
        style={styles.photo}
        onPressIn={() => setHolding(true)}
        onPressOut={() => setHolding(false)}
        accessibilityLabel="Design preview. Touch and hold to see the original colors."
      >
        <PhotoStage>
          <RecolorView plan={plan} width={width - (STAGE_MARGIN + PHOTO_STAGE_INSET) * 2} />
        </PhotoStage>
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
        <View>
          <ScrollView
            ref={zonesRow}
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.zonesBar}
            contentContainerStyle={styles.zones}
            onLayout={(e) => updateZonesMore({ width: e.nativeEvent.layout.width })}
            onContentSizeChange={(w) => updateZonesMore({ content: w })}
            onScroll={(e) => updateZonesMore({ x: e.nativeEvent.contentOffset.x })}
            scrollEventThrottle={48}
          >
            {zones.map((z) => (
              <View key={z.id} onLayout={(e) => rememberChip(z.id, e)}>
                <Chip
                  label={`${z.name} · ${MATERIAL_LABEL[z.material]}`}
                  selected={z.id === zone?.id}
                  onPress={() => chooseZone(z.id)}
                />
              </View>
            ))}
          </ScrollView>
          {zonesMore ? (
            <View pointerEvents="none" style={styles.fade}>
              {FADE.map((o) => (
                <View key={o} style={[styles.fadeStrip, { opacity: o }]} />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <ScrollView style={styles.palette} contentContainerStyle={styles.paletteContent}>
        {/* The model's description from the admin panel (proposal: image, name and description). */}
        {model.description ? (
          <AppText variant="small" color={colors.muted}>
            {model.description}
          </AppText>
        ) : null}
        {noticeOpen ? (
          <View style={styles.notice}>
            <AppText variant="small" style={styles.noticeText}>
              Some colors or finishes of this {line && !design ? 'frame' : 'design'} are no longer available
              and were replaced: {restored.replaced.join(', ')}.
            </AppText>
            <Button title="OK" variant="ghost" size="sm" onPress={() => setNoticeOpen(false)} />
          </View>
        ) : null}
        {selected ? (
          <View style={styles.selection}>
            {/* Only the number (Carlos, 2026-10-21): every client and sales rep has a sample set numbered the same. */}
            <AppText variant="subheading">Color {selected.ref}</AppText>
            {selected.finishes.length > 1 ? (
              <View style={styles.finishes}>
                {selected.finishes.map((f) => (
                  <Chip
                    key={f}
                    label={FINISH_LABEL[f]}
                    selected={current?.finish === f}
                    onPress={() =>
                      change((h) => commit(h, chooseFinish(h.picks, model.zones, zone!, swatches, f)))
                    }
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
                      size={swatchSize}
                      selected={s.id === selected?.id}
                      onPress={() =>
                        change((h) => commit(h, chooseSwatch(h.picks, model.zones, zone, swatches, s)))
                      }
                      accessibilityLabel={`Color ${s.ref}`}
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
        {/* Save as a round heart beside the order button (benchmarks 2026-10-23): outlined while
            there is something to save, filled once the design is saved as it is. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={saveLabel}
          accessibilityState={{ disabled: saveDisabled, busy }}
          disabled={saveDisabled || busy}
          onPress={onSave}
          style={({ pressed }) => [styles.saveButton, pressed && styles.savePressed]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Icon
              name={saved && !unsaved ? 'heart' : 'heart-outline'}
              size={24}
              color={saveDisabled && !(saved && !unsaved) ? colors.muted : colors.primary}
            />
          )}
        </Pressable>
        <Button
          title={line ? 'Update frame' : 'Add to cart'}
          onPress={() => {
            if (line) {
              // Back to the order with the new colors (the same as another frame: they become one).
              const result = cart.update(line.id, selection);
              toast(
                result === 'merged' ? 'Same as another frame: joined into one' : 'Frame updated',
                'success',
              );
              router.back();
              return;
            }
            requireAuth(() => {
              // The frame joins the order being put together (several frames per order). The optician
              // stays here to add more; the bag above, or "View", opens the order.
              const result = cart.add(model.id, selection);
              if (result === 'too_many_frames') {
                toast(`Your cart can hold up to ${CART_MAX} different frames.`, 'error');
                return;
              }
              if (result === 'too_many_of_one') {
                toast(`Up to ${QUANTITY_MAX} of the same frame per order.`, 'error');
                return;
              }
              toast(
                result === 'more'
                  ? `One more ${model.name} in your cart`
                  : `${model.name} added to your cart`,
                'success',
                { label: 'View', onPress: () => router.push('/order/summary') },
              );
            });
          }}
          arrow={!line}
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
  photo: { paddingHorizontal: STAGE_MARGIN, paddingTop: spacing.md, paddingBottom: spacing.sm },
  fade: { position: 'absolute', top: 0, right: 0, bottom: 0, flexDirection: 'row' },
  fadeStrip: { width: FADE_STRIP, backgroundColor: colors.background },
  badge: {
    position: 'absolute',
    top: spacing.lg + spacing.sm,
    left: STAGE_MARGIN + PHOTO_STAGE_INSET + spacing.sm,
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
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: SWATCH_GAP },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: tokens.radius.md,
    backgroundColor: colors.highlight,
  },
  noticeText: { flex: 1, color: colors.onHighlight },
  footerButton: { flex: 1 },
  saveButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savePressed: { opacity: 0.7 },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
});
