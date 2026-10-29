import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MATERIAL_LABEL, tokens, type Material } from '@taitit/shared';
import {
  AppText,
  BrandLogo,
  EmptyState,
  GradientFill,
  Icon,
  Skeleton,
  WARM_GLOWS,
  PAGE_MAX_WIDTH,
  useDesktop,
  usePageWidth,
  webNoOutline,
} from '@/ui';
import { useAuth } from '@/auth/AuthProvider';
import { CartButton } from '@/orders/CartButton';
import { useCatalog, useSwatches } from '@/catalog/useCatalog';
import {
  categoriesOf,
  defaultColors,
  frontMaterial,
  matchesSearch,
  type CatalogModel,
  type CatalogSwatch,
} from '@/catalog/catalog';
import { ModelImage } from '@/catalog/ModelImage';
import { SiteFooter } from '@/navigation/SiteFooter';
import { fonts } from '@/ui/fonts';

const { spacing, colors, radius, touch } = tokens;
const PAGE = spacing.lg;
const GAP = spacing.md;
const TILE_PAD = spacing.md;
const CARD_PAD = spacing.md;
const FRONTS: { key: Material; label: string }[] = [
  { key: 'metal', label: 'Metal front' },
  { key: 'acetate', label: 'Acetate front' },
];

export default function CatalogScreen() {
  const width = usePageWidth();
  const desktop = useDesktop();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuth();
  const catalog = useCatalog();
  const swatches = useSwatches();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [front, setFront] = useState<Material | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const models = useMemo(() => catalog.data ?? [], [catalog.data]);
  const categories = useMemo(() => categoriesOf(models), [models]);
  const visible = models.filter(
    (m) =>
      (!front || frontMaterial(m) === front) &&
      (!category || m.category.trim() === category) &&
      matchesSearch(m, query),
  );
  // Phone: two staggered columns; the reading order stays alphabetical, left then right, row by row.
  // Computer: a grid of equal cards (four per row, three on narrower windows).
  // Computer: the grid's own measured width (a browser's scrollbar takes part of the window), whole
  // pixels, so the cards always fit their row.
  const [gridWidth, setGridWidth] = useState(0);
  const deskWidth = gridWidth || width - PAGE * 2;
  const cols = desktop ? (deskWidth >= 1100 ? 4 : 3) : 2;
  const tileWidth = desktop
    ? Math.floor((deskWidth - GAP * (cols - 1)) / cols)
    : (width - PAGE * 2 - GAP * (cols - 1)) / cols;
  const measureGrid = (e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width);
  const imageWidth = tileWidth - TILE_PAD * 2;
  const tileHeight = imageWidth * 0.7 + TILE_PAD * 2;
  const columns = Array.from({ length: cols }, (_, c) => visible.filter((_, i) => i % cols === c));
  // Every other column starts lower; the last one holds the search in that free top.
  const staggerHeight = Math.max(touch.minSize, tileHeight * 0.45 - spacing.lg);

  const refresh = async () => {
    setRefreshing(true);
    await catalog.refetch();
    setRefreshing(false);
  };

  const closeSearch = () => {
    setQuery('');
    setSearching(false);
  };

  // The logo and the account button, then the greeting (small). Search sits in the grid's free corner.
  const name = profile?.business_name?.trim() || profile?.full_name?.trim();
  const top = (
    <View style={styles.topBlock}>
      {/* On a computer the logo and the cart are in the top bar. */}
      {desktop ? null : (
        <View style={styles.topRow}>
          <BrandLogo width={118} />
          <CartButton />
        </View>
      )}
      <View style={styles.greetingText}>
        {session ? (
          <AppText variant="small" numberOfLines={1}>
            Welcome back,{' '}
            <AppText variant="small" style={styles.name}>
              {name || 'TAITIT'}
            </AppText>
          </AppText>
        ) : (
          <Pressable accessibilityRole="link" onPress={() => router.push('/sign-in')} hitSlop={8}>
            <AppText variant="small" numberOfLines={1}>
              Welcome to TAITIT ·{' '}
              <AppText variant="small" color={colors.primary} style={styles.name}>
                Sign in to order
              </AppText>
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.headline} accessibilityRole="header">
        {/* One line, two colors; it shrinks to fit narrow phones. */}
        <AppText style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          Find your <AppText style={[styles.title, styles.titleAccent]}>next frame</AppText>
        </AppText>
      </View>
      {/* Computer: the filters and an always-open search share one toolbar row. */}
      <View style={desktop ? styles.toolbar : undefined}>
        <View style={desktop ? styles.toolbarTabs : undefined}>
          {/* Text tabs with a black underline on the selected one (benchmarks 2026-10-23). */}
          <FilterTabs
            label="Front material"
            tabs={[
              {
                key: 'all',
                label: 'All',
                selected: !front && !category,
                onPress: () => {
                  setFront(null);
                  setCategory(null);
                },
              },
              ...FRONTS.map((f) => ({
                key: f.key,
                label: f.label,
                selected: front === f.key,
                onPress: () => setFront(front === f.key ? null : f.key),
              })),
            ]}
          />
        </View>
        {desktop ? (
          <View style={styles.toolbarSearch}>
            <SearchBox
              height={touch.minSize}
              open
              persistent
              query={query}
              onChange={setQuery}
              onOpen={() => {}}
              onClose={() => setQuery('')}
            />
          </View>
        ) : null}
      </View>
      {/* More than one category (today all models are Optical): a second row of tabs. */}
      {categories.length > 1 && (
        <FilterTabs
          label="Category"
          tabs={categories.map((c) => ({
            key: c,
            label: c,
            selected: category === c,
            onPress: () => setCategory(category === c ? null : c),
          }))}
        />
      )}
    </View>
  );

  const background = (
    <View style={[styles.background, { height: insets.top + 520 }]} pointerEvents="none">
      <GradientFill until={0.95} glows={WARM_GLOWS} />
    </View>
  );

  // Nothing matches the search or filter.
  const noMatch = (
    <View style={styles.noMatch}>
      <AppText variant="subheading">No models found</AppText>
      <AppText variant="small">
        {query.trim() ? `Nothing matches "${query.trim()}".` : 'No models with this filter.'}
      </AppText>
      <Pressable
        accessibilityRole="button"
        hitSlop={10}
        onPress={() => {
          closeSearch();
          setFront(null);
          setCategory(null);
        }}
      >
        <AppText variant="label" color={colors.primary}>
          Show all models
        </AppText>
      </Pressable>
    </View>
  );

  let body;
  if (desktop && catalog.isPending)
    body = (
      <View style={styles.cardGrid} onLayout={measureGrid}>
        {Array.from({ length: cols * 2 }, (_, i) => (
          <Skeleton key={i} width={tileWidth} height={tileWidth * 0.8} radius={radius.lg} />
        ))}
      </View>
    );
  else if (desktop && !(catalog.isError && !catalog.data) && models.length > 0)
    body =
      visible.length === 0 ? (
        // Computer: a centered message (the phone says it in the grid's free column).
        <View style={styles.noMatchDesktop}>
          <EmptyState
            icon="search-outline"
            title="No models found"
            message={query.trim() ? `Nothing matches "${query.trim()}".` : 'No models with this filter.'}
            actionLabel="Show all models"
            onAction={() => {
              closeSearch();
              setFront(null);
              setCategory(null);
            }}
          />
        </View>
      ) : (
        <View style={styles.cardGrid} onLayout={measureGrid}>
          {visible.map((m) => (
            <ModelCard key={m.id} model={m} width={tileWidth} swatches={swatches.data ?? []} />
          ))}
        </View>
      );
  else if (catalog.isPending)
    body = (
      <View style={styles.grid}>
        {columns.map((_, col) => (
          <View key={col} style={[styles.column, col % 2 === 1 && { paddingTop: tileHeight * 0.45 }]}>
            {[0, 1].map((i) => (
              <View key={i} style={styles.item}>
                <Skeleton width={tileWidth} height={tileHeight} radius={radius.lg} />
                <Skeleton width="55%" height={14} />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  else if (catalog.isError && !catalog.data)
    body = (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load the catalog"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void catalog.refetch()}
      />
    );
  else if (models.length === 0)
    body = (
      <EmptyState
        icon="glasses-outline"
        title="No models yet"
        message="The collection will appear here soon."
      />
    );
  else
    body = (
      <View style={styles.grid}>
        {columns.map((col, c) => (
          // Every other column starts lower: a staggered, magazine-like grid.
          <View key={c} style={styles.column}>
            {c % 2 === 1 && c !== cols - 1 && <View style={{ height: staggerHeight }} />}
            {c === cols - 1 && (
              <SearchBox
                height={staggerHeight}
                open={searching}
                query={query}
                onChange={setQuery}
                onOpen={() => setSearching(true)}
                onClose={closeSearch}
              />
            )}
            {/* Nothing matches: said in the left column; the search stays open in its corner. */}
            {c === 0 && visible.length === 0 && noMatch}
            {col.map((m) => (
              <ModelTile
                key={m.id}
                model={m}
                tileWidth={tileWidth}
                tileHeight={tileHeight}
                imageWidth={imageWidth}
                swatches={swatches.data ?? []}
              />
            ))}
          </View>
        ))}
      </View>
    );

  return (
    <View style={styles.root}>
      {background}
      <ScrollView
        // Computer: the page scrolls at full width (scrollbar at the window's edge); the content is
        // centered in it.
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.sm },
          desktop && styles.pageColumn,
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {top}
        {header}
        {body}
        <SiteFooter />
      </ScrollView>
    </View>
  );
}

/**
 * Search, in the free top of the right column (the staggered grid leaves it open). Tapped, the same pill
 * becomes the search field (focus and keyboard); its × clears and closes it.
 */
function SearchBox({
  height,
  open,
  query,
  onChange,
  onOpen,
  onClose,
  persistent = false,
}: {
  height: number;
  open: boolean;
  query: string;
  onChange: (q: string) => void;
  onOpen: () => void;
  onClose: () => void;
  /** Always open (computer's toolbar): no focus on load, the × only clears what was typed. */
  persistent?: boolean;
}) {
  const size = { height: Math.max(touch.minSize, height) };
  const icon = (
    <View style={styles.searchIcon}>
      <Icon name="search" size={18} color={colors.text} />
    </View>
  );
  if (!open)
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Search models"
        onPress={onOpen}
        style={({ pressed }) => [styles.searchPill, size, pressed && styles.pressed]}
      >
        {icon}
        <AppText variant="subheading">Search</AppText>
      </Pressable>
    );
  return (
    <View style={[styles.searchPill, styles.searchOpen, size]}>
      {icon}
      <TextInput
        value={query}
        onChangeText={onChange}
        placeholder="Search"
        placeholderTextColor={colors.muted}
        accessibilityLabel="Search models"
        autoFocus={!persistent}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
      />
      {!persistent || query ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={persistent ? 'Clear search' : 'Close search'}
          onPress={onClose}
          hitSlop={10}
        >
          <Icon name="close" size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function ModelTile({
  model,
  tileWidth,
  tileHeight,
  imageWidth,
  swatches,
}: {
  model: CatalogModel;
  tileWidth: number;
  tileHeight: number;
  imageWidth: number;
  swatches: CatalogSwatch[];
}) {
  const dots = defaultColors(model, swatches);
  // The model at a glance, e.g. "Optical · Acetate front".
  const material = frontMaterial(model);
  const meta = [model.category, material ? `${MATERIAL_LABEL[material]} front` : null]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${model.name}.${model.description ? ` ${model.description}.` : ''} Customize`}
      onPress={() => router.push({ pathname: '/customize/[modelId]', params: { modelId: model.id } })}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      {/* The frame on its own soft tile; dots and name below, on the background (no card border). */}
      <View style={[styles.tile, { width: tileWidth, height: tileHeight }]}>
        <ModelImage model={model} width={imageWidth} />
      </View>
      {dots.length > 0 && (
        <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {dots.map((s, i) => (
            <ColorDot key={`${s.id}-${i}`} swatch={s} />
          ))}
        </View>
      )}
      <AppText variant="label" align="center" numberOfLines={1}>
        {model.name}
      </AppText>
      {meta ? (
        <AppText variant="tiny" align="center" color={colors.muted} numberOfLines={1} style={styles.meta}>
          {meta}
        </AppText>
      ) : null}
      {/* The start of the description (all of it on the model's screen). */}
      {model.description ? (
        <AppText variant="tiny" align="center" color={colors.muted} numberOfLines={2}>
          {model.description}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/**
 * A model as a card in the web's grid (computer): image, colors, name and type in one white card, all
 * cards the same size in rows; highlighted under the mouse. The description stays on the model's screen.
 */
function ModelCard({
  model,
  width,
  swatches,
}: {
  model: CatalogModel;
  width: number;
  swatches: CatalogSwatch[];
}) {
  const dots = defaultColors(model, swatches);
  const material = frontMaterial(model);
  const meta = [model.category, material ? `${MATERIAL_LABEL[material]} front` : null]
    .filter(Boolean)
    .join(' · ');
  const imageWidth = width - CARD_PAD * 2 - 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${model.name}.${model.description ? ` ${model.description}.` : ''} Customize`}
      onPress={() => router.push({ pathname: '/customize/[modelId]', params: { modelId: model.id } })}
      style={(state) => [
        styles.card,
        { width },
        (state as { hovered?: boolean }).hovered && styles.cardHovered,
        state.pressed && styles.pressed,
      ]}
    >
      <View style={[styles.cardImage, { height: imageWidth * 0.62 }]}>
        <ModelImage model={model} width={imageWidth} />
      </View>
      <View style={styles.cardInfo}>
        <AppText variant="label" numberOfLines={1}>
          {model.name}
        </AppText>
        {dots.length > 0 && (
          <View
            style={styles.dots}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {dots.map((s, i) => (
              <ColorDot key={`${s.id}-${i}`} swatch={s} />
            ))}
          </View>
        )}
      </View>
      {meta ? (
        <AppText variant="tiny" color={colors.muted} numberOfLines={1}>
          {meta}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** A row of text tabs; the selected one is bold with a black underline. */
function FilterTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { key: string; label: string; selected: boolean; onPress: () => void }[];
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist" accessibilityLabel={label}>
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: t.selected }}
          onPress={t.onPress}
          style={({ pressed }) => [styles.tab, t.selected && styles.tabSelected, pressed && styles.pressed]}
        >
          <AppText
            variant={t.selected ? 'label' : 'small'}
            color={t.selected ? colors.text : colors.muted}
            numberOfLines={1}
          >
            {t.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

/** A default color as a small dot: tortoiseshell texture, translucent colors at their opacity. */
function ColorDot({ swatch }: { swatch: CatalogSwatch }) {
  return (
    <View style={styles.dot}>
      {swatch.textureUrl ? (
        <Image source={{ uri: swatch.textureUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: swatch.hex,
              opacity: swatch.kind === 'translucent' ? (swatch.alpha ?? 1) : 1,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  background: { position: 'absolute', left: 0, right: 0, top: 0 },
  content: { paddingHorizontal: PAGE, paddingBottom: spacing.xl },
  topBlock: { gap: spacing.md },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  searchPill: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  searchOpen: { gap: spacing.sm, paddingRight: spacing.md, borderWidth: 1.5, borderColor: colors.focus },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontFamily: fonts.headingMedium,
    fontSize: 17,
    color: colors.text,
    ...webNoOutline,
  },
  noMatch: { gap: spacing.sm, paddingTop: spacing.sm },
  searchIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.selected,
  },
  greetingText: { minHeight: 20 },
  name: { fontFamily: fonts.bodyBold, color: colors.text },
  pressed: { opacity: 0.8 },
  header: { gap: spacing.md, marginTop: spacing.lg, marginBottom: spacing.lg },
  headline: { gap: 0 },
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 42, color: colors.text },
  titleAccent: { fontFamily: fonts.displayItalic },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: touch.minSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tabSelected: { borderBottomColor: colors.primary },
  meta: { marginTop: -spacing.xs },
  grid: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.lg },
  item: { gap: spacing.sm, alignItems: 'center' },
  tile: {
    borderRadius: radius.lg,
    // Solid white like the thumbnails' own background (a see-through tile showed their edges).
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  // Computer: toolbar (filters + search) and a grid of equal cards.
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  toolbarTabs: { flex: 1 },
  toolbarSearch: { width: 300 },
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  pageColumn: { width: '100%', maxWidth: PAGE_MAX_WIDTH, alignSelf: 'center' },
  noMatchDesktop: { paddingVertical: spacing.xxl * 2 },
  card: {
    padding: CARD_PAD,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardHovered: {
    borderColor: colors.text,
    shadowColor: colors.text,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  cardImage: { alignItems: 'center', justifyContent: 'center' },
  cardInfo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.25)',
    backgroundColor: colors.surface,
  },
});
