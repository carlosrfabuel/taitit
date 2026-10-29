import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { tokens } from '@taitit/shared';
import { formatOrderDate } from '@/orders/orders';
import { partSummary, type SparePartRequest } from '@/spareParts/spareParts';
import { useSparePartRequests } from '@/spareParts/useSpareParts';
import { SparePartsSignIn } from '@/spareParts/SparePartsSignIn';
import { useAuth } from '@/auth/AuthProvider';
import { AppText, Card, EmptyState, Icon, Screen, Skeleton, readingColumn, useDesktop } from '@/ui';
import { SiteFooter } from '@/navigation/SiteFooter';

const { spacing, colors, radius } = tokens;
const THUMB = 56;

/** The spare part requests the optician has sent, newest first. */
export default function SparePartRequestsScreen() {
  const { session } = useAuth();
  const requests = useSparePartRequests();
  const desktop = useDesktop();
  const [refreshing, setRefreshing] = useState(false);

  // Opened by its address while signed out (the list is never loaded for guests).
  if (!session) return <SparePartsSignIn />;
  if (requests.isPending)
    return (
      <View style={[styles.list, desktop && readingColumn]}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={80} radius={radius.lg} />
        ))}
      </View>
    );
  if (requests.isError && !requests.data)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your requests"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void requests.refetch()}
        />
      </Screen>
    );

  const list = requests.data ?? [];
  const refresh = async () => {
    setRefreshing(true);
    await requests.refetch();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.root}
      data={list}
      keyExtractor={(r) => r.id}
      contentContainerStyle={[styles.list, list.length === 0 && styles.grow, desktop && readingColumn]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <EmptyState
            icon="construct-outline"
            title="No requests yet"
            message="Choose a model in Spare parts to send your first request."
            actionLabel="Spare parts"
            onAction={() => router.navigate('/spare-parts')}
          />
        </View>
      }
      renderItem={({ item }) => <RequestRow request={item} />}
      ListFooterComponent={desktop ? <SiteFooter /> : null}
    />
  );
}

function RequestRow({ request }: { request: SparePartRequest }) {
  const url = request.photoUrls[0];
  return (
    <Card
      onPress={() => router.push({ pathname: '/spare-parts/request/[id]', params: { id: request.id } })}
      accessibilityLabel={`Request ${request.number}, ${request.modelName}`}
      style={styles.row}
    >
      {url ? (
        <Image
          // The link changes every time it is signed: cache by file instead.
          source={{ uri: url, cacheKey: request.photoPaths[0] }}
          style={styles.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : (
        <View style={[styles.thumb, styles.noThumb]}>
          <Icon name="image-outline" size={18} color={colors.muted} />
        </View>
      )}
      <View style={styles.info}>
        <AppText variant="subheading">Request #{request.number}</AppText>
        <AppText variant="small" numberOfLines={1}>
          {request.modelName} · {partSummary(request.part, request.side)} ·{' '}
          {formatOrderDate(request.createdAt)}
        </AppText>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.xl, gap: spacing.md },
  grow: { flexGrow: 1 },
  center: { flex: 1, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  thumb: { width: THUMB, height: THUMB, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  noThumb: { alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
});
