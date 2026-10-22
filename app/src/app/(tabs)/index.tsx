import { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens, type Material } from '@taitit/shared';
import { AppText, BrandLogo, Chip, EmptyState, GradientFill, Icon, Skeleton, WARM_GLOWS } from '@/ui';
import { useAuth } from '@/auth/AuthProvider';
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
import { fonts } from '@/ui/fonts';

const { spacing, colors, radius, touch } = tokens;
const PAGE = spacing.lg;
const GAP = spacing.md;
const TILE_PAD = spacing.md;
const FRONTS: { key: Material; label: string }[] = [
  { key: 'metal', label: 'Metal front' },
  { key: 'acetate', label: 'Acetate front' },
];

export default function CatalogScreen() {
  const { width } = useWindowDimensions();
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
  // Two staggered columns; the reading order stays alphabetical, left then right, row by row.
  const tileWidth = (width - PAGE * 2 - GAP) / 2;
  const imageWidth = tileWidth - TILE_PAD * 2;
  const tileHeight = imageWidth * 0.7 + TILE_PAD * 2;
  const columns = [visible.filter((_, i) => i % 2 === 0), visible.filter((_, i) => i % 2 === 1)];

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
      <View style={styles.topRow}>
        <BrandLogo width={118} />
      </View>
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
      {/* Equal chips spanning the width (their edges line up with the grid). */}
      <View style={styles.chipRow}>
        <Chip
          fill
          tone="strong"
          label="All"
          selected={!front && !category}
          onPress={() => {
            setFront(null);
            setCategory(null);
          }}
        />
        {FRONTS.map((f) => (
          <Chip
            key={f.key}
            fill
            tone="strong"
            label={f.label}
            selected={front === f.key}
            onPress={() => setFront(front === f.key ? null : f.key)}
          />
        ))}
      </View>
      {/* More than one category (today all models are Optical): a second row of equal chips. */}
      {categories.length > 1 && (
        <View style={styles.chipRow}>
          {categories.map((c) => (
            <Chip
              key={c}
              fill
              tone="strong"
              label={c}
              selected={category === c}
              onPress={() => setCategory(category === c ? null : c)}
            />
          ))}
        </View>
      )}
    </View>
  );

  const background = (
    <View style={[styles.background, { height: insets.top + 520 }]} pointerEvents="none">
      <GradientFill until={0.95} glows={WARM_GLOWS} />
    </View>
  );

  let body;
  if (catalog.isPending)
    body = (
      <View style={styles.grid}>
        {[0, 1].map((col) => (
          <View key={col} style={[styles.column, col === 1 && { paddingTop: tileHeight * 0.45 }]}>
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
          // The right column starts lower: a staggered, magazine-like grid.
          <View key={c} style={styles.column}>
            {c === 1 && (
              <SearchBox
                height={tileHeight * 0.45 - spacing.lg}
                open={searching}
                query={query}
                onChange={setQuery}
                onOpen={() => setSearching(true)}
                onClose={closeSearch}
              />
            )}
            {c === 0 && visible.length === 0 && (
              // Nothing matches: said in the left column; the search stays open in its corner.
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
            )}
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
      >
        {top}
        {header}
        {body}
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
}: {
  height: number;
  open: boolean;
  query: string;
  onChange: (q: string) => void;
  onOpen: () => void;
  onClose: () => void;
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
        autoFocus
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.searchInput}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Close search" onPress={onClose} hitSlop={10}>
        <Icon name="close" size={18} color={colors.muted} />
      </Pressable>
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
      {/* The start of the description (all of it on the model's screen). */}
      {model.description ? (
        <AppText variant="tiny" align="center" color={colors.muted} numberOfLines={2}>
          {model.description}
        </AppText>
      ) : null}
    </Pressable>
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
  titleAccent: { color: colors.primary },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
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
