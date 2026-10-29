import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { useCatalog } from '@/catalog/useCatalog';
import { ModelImage } from '@/catalog/ModelImage';
import { SearchBox } from '@/catalog/SearchBox';
import { matchesSearch, type CatalogModel } from '@/catalog/catalog';
import { useSparePartRequests } from '@/spareParts/useSpareParts';
import { SparePartsSignIn } from '@/spareParts/SparePartsSignIn';
import { SiteFooter } from '@/navigation/SiteFooter';
import { AppText, Card, EmptyState, Icon, Skeleton, readingColumn, useDesktop, useReadingWidth } from '@/ui';

const { spacing, colors, radius, touch } = tokens;
const PAGE = spacing.lg;
const GAP = spacing.md;
const TILE_PAD = spacing.md;
const CARD_PAD = spacing.sm;
const DESKTOP_COLUMNS = 3;

// Spare parts (Carlos, 2026-10-28): the optician chooses the model here, then the part and 3 photos on
// the next screen. Their sent requests are one tap away. Phone: the catalog's staggered two columns
// with the search in the right column's free top; computer: a grid of equal cards and a search box.
export default function SparePartsScreen() {
  const { session } = useAuth();
  const catalog = useCatalog();
  const requests = useSparePartRequests();
  const desktop = useDesktop();
  const width = useReadingWidth();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);

  if (!session) return <SparePartsSignIn />;

  const models = catalog.data ?? [];
  const visible = models.filter((m) => matchesSearch(m, query));
  const closeSearch = () => {
    setQuery('');
    setSearching(false);
  };

  // Phone: the same sizes as the catalog's tiles.
  const tileWidth = (width - PAGE * 2 - GAP) / 2;
  const imageWidth = tileWidth - TILE_PAD * 2;
  const tileHeight = imageWidth * 0.7 + TILE_PAD * 2;
  const staggerHeight = Math.max(touch.minSize, tileHeight * 0.45 - spacing.lg);
  // Computer: equal cards in rows.
  const cardWidth = Math.floor((width - PAGE * 2 - GAP * (DESKTOP_COLUMNS - 1)) / DESKTOP_COLUMNS);

  const noMatch = (
    <View style={styles.noMatch}>
      <AppText variant="subheading">No models found</AppText>
      <AppText variant="small">{`Nothing matches "${query.trim()}".`}</AppText>
      <Pressable accessibilityRole="button" hitSlop={10} onPress={closeSearch}>
        <AppText variant="label" color={colors.primary}>
          Show all models
        </AppText>
      </Pressable>
    </View>
  );

  let grid;
  if (catalog.isPending)
    grid = desktop ? (
      <View style={styles.cardGrid}>
        {Array.from({ length: DESKTOP_COLUMNS * 2 }, (_, i) => (
          <Skeleton key={i} width={cardWidth} height={cardWidth * 0.55} radius={radius.lg} />
        ))}
      </View>
    ) : (
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
    grid = (
      <EmptyState
        icon="cloud-offline-outline"
        title="Couldn't load the models"
        message="Check your connection and try again."
        actionLabel="Try again"
        onAction={() => void catalog.refetch()}
      />
    );
  else if (desktop)
    grid =
      visible.length === 0 ? (
        <View style={styles.noMatchDesktop}>{noMatch}</View>
      ) : (
        <View style={styles.cardGrid}>
          {visible.map((m) => (
            <ModelCard key={m.id} model={m} width={cardWidth} />
          ))}
        </View>
      );
  else
    grid = (
      <View style={styles.grid}>
        {[0, 1].map((c) => (
          // The right column starts lower, with the search in its free top (as in the catalog).
          <View key={c} style={styles.column}>
            {c === 1 && (
              <SearchBox
                height={staggerHeight}
                open={searching}
                query={query}
                onChange={setQuery}
                onOpen={() => setSearching(true)}
                onClose={closeSearch}
              />
            )}
            {c === 0 && visible.length === 0 && noMatch}
            {visible
              .filter((_, i) => i % 2 === c)
              .map((m) => (
                <ModelTile
                  key={m.id}
                  model={m}
                  tileWidth={tileWidth}
                  tileHeight={tileHeight}
                  imageWidth={imageWidth}
                />
              ))}
          </View>
        ))}
      </View>
    );

  const count = requests.data?.length ?? 0;
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, desktop && readingColumn]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      {count > 0 ? (
        <Card
          onPress={() => router.push('/spare-parts/requests')}
          accessibilityLabel={`My requests, ${count}`}
          style={styles.requests}
        >
          <Icon name="document-text-outline" size={22} color={colors.text} />
          <View style={styles.requestsText}>
            <AppText variant="subheading">My requests</AppText>
            <AppText variant="small">
              {count} {count === 1 ? 'request' : 'requests'} sent
            </AppText>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.muted} />
        </Card>
      ) : null}
      <View style={desktop ? styles.introDesktop : undefined}>
        <View style={[styles.intro, desktop && styles.introText]}>
          <AppText variant="heading">Which model?</AppText>
          <AppText variant="small" color={colors.muted}>
            Choose the frame that needs a part. Then pick the part and add 3 photos of the problem.
          </AppText>
        </View>
        {desktop ? (
          <View style={styles.searchDesktop}>
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
      {grid}
      <SiteFooter />
    </ScrollView>
  );
}

const openModel = (model: CatalogModel) =>
  router.push({ pathname: '/spare-parts/[modelId]', params: { modelId: model.id } });

/** Phone: the frame on its own soft tile, the name below (the catalog's tile, without colors). */
function ModelTile({
  model,
  tileWidth,
  tileHeight,
  imageWidth,
}: {
  model: CatalogModel;
  tileWidth: number;
  tileHeight: number;
  imageWidth: number;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Spare part for ${model.name}`}
      onPress={() => openModel(model)}
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}
    >
      <View style={[styles.tile, { width: tileWidth, height: tileHeight }]}>
        <ModelImage model={model} width={imageWidth} />
      </View>
      <AppText variant="label" align="center" numberOfLines={1}>
        {model.name}
      </AppText>
    </Pressable>
  );
}

/** Computer: the frame and its name in a card, all cards the same size. */
function ModelCard({ model, width }: { model: CatalogModel; width: number }) {
  return (
    <Card
      onPress={() => openModel(model)}
      accessibilityLabel={`Spare part for ${model.name}`}
      style={[styles.card, { width }]}
    >
      {/* A fixed picture area: frames differ in shape, the cards stay the same size. */}
      <View style={[styles.picture, { height: Math.round((width - CARD_PAD * 2) * 0.45) }]}>
        <ModelImage model={model} width={width - CARD_PAD * 2 - 2} />
      </View>
      <AppText variant="label" align="center" numberOfLines={1}>
        {model.name}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: PAGE, gap: spacing.lg },
  requests: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  requestsText: { flex: 1, gap: 2 },
  intro: { gap: spacing.xs },
  introDesktop: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.xl },
  introText: { flex: 1 },
  searchDesktop: { width: 260 },
  noMatch: { gap: spacing.sm, paddingTop: spacing.sm },
  noMatchDesktop: { paddingVertical: spacing.xl },
  pressed: { opacity: 0.8 },
  // Phone: two staggered columns.
  grid: { flexDirection: 'row', gap: GAP, alignItems: 'flex-start' },
  column: { flex: 1, gap: spacing.lg },
  item: { gap: spacing.sm, alignItems: 'center' },
  tile: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Computer: equal cards in rows.
  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: { padding: CARD_PAD, gap: spacing.sm, alignItems: 'center' },
  picture: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
