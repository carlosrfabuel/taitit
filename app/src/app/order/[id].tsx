import { useState } from 'react';
import { Linking, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { FINISH_LABEL, MATERIAL_LABEL, tokens } from '@taitit/shared';
import { formatOrderDate, orderText, whatsappUrl } from '@/orders/orders';
import { useOrder } from '@/orders/useOrders';
import { AppText, Button, Card, EmptyState, Loader, Screen, Swatch, useToast } from '@/ui';

const { spacing, colors } = tokens;

// A sent order, exactly as it was ordered (copied at the time: later catalog changes don't alter it).
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const { width } = useWindowDimensions();
  const toast = useToast();
  // Width / height of the order image, read from the file once loaded (models differ in shape).
  const [aspect, setAspect] = useState(1600 / 556);

  if (order.isPending) return <Loader message="Loading order…" />;
  if (order.isError && !order.data)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this order"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void order.refetch()}
        />
      </Screen>
    );
  const o = order.data;
  if (!o)
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Order not found"
          message="It may belong to another account."
          actionLabel="Back"
          onAction={() => router.back()}
        />
      </Screen>
    );

  const imageWidth = width - spacing.xl * 2;
  return (
    <Screen
      footer={
        <Button
          title="Send via WhatsApp"
          icon="logo-whatsapp"
          variant="secondary"
          fullWidth
          onPress={() =>
            Linking.openURL(whatsappUrl(orderText(o))).catch(() => toast("Couldn't open WhatsApp.", 'error'))
          }
        />
      }
    >
      <Stack.Screen options={{ title: `Order #${o.number}` }} />
      {o.imageUrl ? (
        <Image
          source={{ uri: o.imageUrl, cacheKey: o.imagePath ?? undefined }}
          style={{ width: imageWidth, height: imageWidth / aspect }}
          onLoad={(e) => e.source.width && e.source.height && setAspect(e.source.width / e.source.height)}
          contentFit="contain"
          cachePolicy="memory-disk"
          accessibilityLabel={`Design of order ${o.number}`}
        />
      ) : null}
      <View>
        <AppText variant="title">{o.modelName}</AppText>
        <AppText variant="small">Sent {formatOrderDate(o.createdAt)}</AppText>
      </View>
      <Card style={styles.lines}>
        {o.items.map((i, n) => (
          <View key={`${i.zoneName}-${n}`} style={[styles.line, n > 0 && styles.lineBorder]}>
            <Swatch
              hex={i.hex}
              alpha={i.alpha}
              texture={i.textureUrl}
              size={tokens.swatch.md}
              accessibilityLabel={i.swatchName}
            />
            <View style={styles.lineText}>
              <AppText variant="label">
                {i.zoneName} · {MATERIAL_LABEL[i.material]}
              </AppText>
              <AppText>
                {i.swatchName}
                {i.finish ? ` · ${FINISH_LABEL[i.finish]}` : ''}
              </AppText>
              <AppText variant="small">Ref. {i.ref}</AppText>
            </View>
          </View>
        ))}
      </Card>
      {o.shopRef ? (
        <View style={styles.field}>
          <AppText variant="tiny">SHOP / CUSTOMER REFERENCE</AppText>
          <AppText>{o.shopRef}</AppText>
        </View>
      ) : null}
      {o.notes ? (
        <View style={styles.field}>
          <AppText variant="tiny">NOTES</AppText>
          <AppText>{o.notes}</AppText>
        </View>
      ) : null}
      <AppText variant="tiny" color={colors.muted}>
        Colors may vary slightly depending on your screen.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lines: { paddingVertical: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  lineText: { flex: 1, gap: 2 },
  field: { gap: spacing.xs },
});
