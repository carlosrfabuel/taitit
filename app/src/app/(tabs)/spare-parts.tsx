import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { useCatalog } from '@/catalog/useCatalog';
import { ModelImage } from '@/catalog/ModelImage';
import type { CatalogModel } from '@/catalog/catalog';
import { useSparePartRequests } from '@/spareParts/useSpareParts';
import { SiteFooter } from '@/navigation/SiteFooter';
import {
  AppText,
  Card,
  EmptyState,
  Icon,
  Screen,
  Skeleton,
  readingColumn,
  useDesktop,
  useReadingWidth,
} from '@/ui';

const { spacing, colors, radius } = tokens;
const PAGE = spacing.xl;
const GAP = spacing.md;
const TILE_PAD = spacing.sm;

// Spare parts (Carlos, 2026-10-28): the optician chooses the model here, then the part and 3 photos on
// the next screen. Their sent requests are one tap away.
export default function SparePartsScreen() {
  const { session } = useAuth();
  const catalog = useCatalog();
  const requests = useSparePartRequests();
  const desktop = useDesktop();
  const width = useReadingWidth();
  const cols = desktop ? 3 : 2;
  const tileWidth = Math.floor((width - PAGE * 2 - GAP * (cols - 1)) / cols);

  if (!session)
    return (
      <Screen>
        <Card>
          <EmptyState
            icon="construct-outline"
            title="Spare parts"
            message="Sign in to request spare parts for your frames."
            actionLabel="Sign in"
            onAction={() => router.push('/sign-in')}
          />
        </Card>
      </Screen>
    );

  let grid;
  if (catalog.isPending)
    grid = (
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={tileWidth} height={tileWidth * 0.55} radius={radius.lg} />
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
  else
    grid = (
      <View style={styles.grid}>
        {(catalog.data ?? []).map((m) => (
          <ModelTile key={m.id} model={m} width={tileWidth} />
        ))}
      </View>
    );

  const count = requests.data?.length ?? 0;
  return (
    <ScrollView style={styles.root} contentContainerStyle={[styles.content, desktop && readingColumn]}>
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
      <View style={styles.intro}>
        <AppText variant="heading">Which model?</AppText>
        <AppText variant="small" color={colors.muted}>
          Choose the frame that needs a part. Then pick the part and add 3 photos of the problem.
        </AppText>
      </View>
      {grid}
      <SiteFooter />
    </ScrollView>
  );
}

function ModelTile({ model, width }: { model: CatalogModel; width: number }) {
  return (
    <Card
      onPress={() => router.push({ pathname: '/spare-parts/[modelId]', params: { modelId: model.id } })}
      accessibilityLabel={`Spare part for ${model.name}`}
      style={[styles.tile, { width }]}
    >
      {/* A fixed picture area: frames differ in shape, the tiles stay the same size. */}
      <View style={[styles.picture, { height: Math.round((width - TILE_PAD * 2) * 0.45) }]}>
        <ModelImage model={model} width={width - TILE_PAD * 2 - 2} />
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: { padding: TILE_PAD, gap: spacing.sm, alignItems: 'center' },
  picture: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
