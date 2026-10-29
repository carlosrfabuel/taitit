import { useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { SignedOutPage } from '@/auth/SignedOutPage';
import { useOrders } from '@/orders/useOrders';
import { formatOrderDate, type Order } from '@/orders/orders';
import { AppText, Card, EmptyState, Icon, Screen, Skeleton, readingColumn, useDesktop } from '@/ui';
import { SiteFooter } from '@/navigation/SiteFooter';

const { spacing, colors, radius } = tokens;
const THUMB = { width: 96, height: 34 }; // the model photo's proportions (1600 × 556)

export default function OrdersScreen() {
  const { session } = useAuth();
  const orders = useOrders();
  const [refreshing, setRefreshing] = useState(false);
  const desktop = useDesktop();

  if (!session)
    return (
      <SignedOutPage
        icon="receipt-outline"
        title="Your orders"
        message="Sign in to place orders and see the ones you have sent."
        heading="My orders"
        intro="Sign in to place orders and follow the ones you have sent."
      />
    );

  if (orders.isPending)
    return (
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={72} radius={radius.lg} />
        ))}
      </View>
    );

  if (orders.isError && !orders.data)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your orders"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void orders.refetch()}
        />
      </Screen>
    );

  const list = orders.data ?? [];
  const refresh = async () => {
    setRefreshing(true);
    await orders.refetch();
    setRefreshing(false);
  };

  return (
    <FlatList
      style={styles.root}
      data={list}
      keyExtractor={(o) => o.id}
      contentContainerStyle={[styles.list, list.length === 0 && styles.grow, desktop && readingColumn]}
      // Computer: the page's heading (the top bar has no title row on the sections' pages).
      ListHeaderComponent={
        desktop ? (
          <AppText variant="title" accessibilityRole="header">
            My orders
          </AppText>
        ) : null
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <EmptyState
            icon="receipt-outline"
            title="No orders yet"
            message="Customize a model and tap Order to send your first one."
            actionLabel="Go to catalog"
            onAction={() => router.navigate('/')}
          />
        </View>
      }
      renderItem={({ item }) => <OrderRow order={item} />}
      ListFooterComponent={desktop ? <SiteFooter /> : null}
    />
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <Card
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      accessibilityLabel={`Order ${order.number}, ${order.modelName}`}
      style={styles.row}
    >
      {order.imageUrl ? (
        <Image
          // The link changes every time it is signed: cache by file instead.
          source={{ uri: order.imageUrl, cacheKey: order.imagePath ?? undefined }}
          style={styles.thumb}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.thumb, styles.noThumb]}>
          <Icon name="image-outline" size={18} color={colors.muted} />
        </View>
      )}
      <View style={styles.info}>
        <AppText variant="subheading">Order #{order.number}</AppText>
        <AppText variant="small" numberOfLines={1}>
          {order.modelName}
          {order.frames.length > 1
            ? ` · ${order.quantity} frames`
            : order.quantity > 1
              ? ` × ${order.quantity}`
              : ''}{' '}
          · {formatOrderDate(order.createdAt)}
          {order.shopRef ? ` · ${order.shopRef}` : ''}
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
  thumb: { ...THUMB, borderRadius: radius.sm, backgroundColor: colors.surface },
  noThumb: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceMuted },
  info: { flex: 1, gap: 2 },
});
