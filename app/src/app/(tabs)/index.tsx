import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { tokens } from '@taitit/shared';
import { AppText, Card, Chip, EmptyState, Skeleton, TextField } from '@/ui';
import { useCatalog } from '@/catalog/useCatalog';
import { categoriesOf, matchesSearch, type CatalogModel } from '@/catalog/catalog';
import { ModelImage } from '@/catalog/ModelImage';

const { spacing, colors, radius } = tokens;
const PAGE = spacing.xl;
const CARD_PAD = spacing.lg;

export default function CatalogScreen() {
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const models = useMemo(() => catalog.data ?? [], [catalog.data]);
  const categories = useMemo(() => categoriesOf(models), [models]);
  const visible = models.filter(
    (m) => (!category || m.category.trim() === category) && matchesSearch(m, query),
  );
  const imageWidth = width - PAGE * 2 - CARD_PAD * 2;

  const refresh = async () => {
    setRefreshing(true);
    await catalog.refetch();
    setRefreshing(false);
  };

  const header = (
    <View style={styles.header}>
      <TextField
        value={query}
        onChangeText={setQuery}
        placeholder="Search models"
        accessibilityLabel="Search models"
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
      />
      {categories.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
          {categories.map((c) => (
            <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
          ))}
        </ScrollView>
      )}
    </View>
  );

  if (catalog.isPending)
    return (
      <View style={styles.root}>
        <View style={styles.list}>
          {header}
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <Skeleton height={(imageWidth * 556) / 1600} radius={radius.md} />
              <Skeleton width="40%" height={18} />
              <Skeleton width="25%" height={12} />
            </View>
          ))}
        </View>
      </View>
    );

  if (catalog.isError && !catalog.data)
    return (
      <View style={[styles.root, styles.center]}>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load the catalog"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void catalog.refetch()}
        />
      </View>
    );

  return (
    <View style={styles.root}>
      <FlatList
        data={visible}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />
        }
        // Few cards in memory at once: each holds an image (low-end phones).
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item }) => <ModelCard model={item} imageWidth={imageWidth} />}
        ListEmptyComponent={
          models.length === 0 ? (
            <EmptyState
              icon="glasses-outline"
              title="No models yet"
              message="The collection will appear here soon."
            />
          ) : (
            <EmptyState
              icon="search-outline"
              title="No models found"
              message={query ? `Nothing matches "${query.trim()}".` : 'No models in this category.'}
              actionLabel="Show all models"
              onAction={() => {
                setQuery('');
                setCategory(null);
              }}
            />
          )
        }
      />
    </View>
  );
}

function ModelCard({ model, imageWidth }: { model: CatalogModel; imageWidth: number }) {
  return (
    <Card
      onPress={() => router.push({ pathname: '/customize/[modelId]', params: { modelId: model.id } })}
      accessibilityLabel={`${model.name}${model.sizeRef ? `, size ${model.sizeRef}` : ''}. Customize`}
      style={styles.card}
    >
      <ModelImage model={model} width={imageWidth} />
      <View>
        <AppText variant="subheading">{model.name}</AppText>
        {model.sizeRef ? <AppText variant="small">{model.sizeRef}</AppText> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center' },
  list: { padding: PAGE, gap: spacing.lg },
  header: { gap: spacing.md, marginBottom: spacing.xs },
  chips: { gap: spacing.sm, paddingVertical: spacing.xs },
  card: { gap: spacing.md },
  skeletonCard: {
    gap: spacing.sm,
    padding: CARD_PAD,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
});
