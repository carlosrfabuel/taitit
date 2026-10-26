import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { FINISH_LABEL, MATERIAL_LABEL, tokens } from '@taitit/shared';
import { formatOrderDate, orderText, type OrderFrameView } from '@/orders/orders';
import { openWhatsapp, useOrder } from '@/orders/useOrders';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Loader,
  PhotoStage,
  PHOTO_STAGE_INSET,
  Screen,
  Swatch,
  useToast,
} from '@/ui';

const { spacing, colors } = tokens;

// A sent order, exactly as it was ordered (copied at the time: later catalog changes don't alter it).
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const toast = useToast();

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

  const several = o.frames.length > 1;
  return (
    <Screen
      footer={
        <Button
          title="Send via WhatsApp"
          icon="logo-whatsapp"
          variant="secondary"
          fullWidth
          onPress={() => openWhatsapp(orderText(o)).catch(() => toast("Couldn't open WhatsApp.", 'error'))}
        />
      }
    >
      <Stack.Screen options={{ title: `Order #${o.number}` }} />
      <View>
        <AppText variant="title">{several ? `${o.frames.length} different frames` : o.modelName}</AppText>
        <AppText variant="small">
          Sent {formatOrderDate(o.createdAt)} · {o.quantity} {o.quantity === 1 ? 'frame' : 'frames'}
        </AppText>
      </View>
      {o.frames.map((f) => (
        <Frame key={f.lineNo} frame={f} orderNumber={o.number} several={several} />
      ))}
      {o.business.name ? (
        <View style={styles.field}>
          <AppText variant="tiny">SENT BY</AppText>
          <AppText>{o.business.name}</AppText>
          <AppText variant="small">
            {[o.business.taxId, o.business.address, o.business.phone].filter(Boolean).join(' · ')}
          </AppText>
          {o.business.labeling ? (
            <AppText variant="small">Name on the glasses: {o.business.labeling}</AppText>
          ) : null}
          {o.business.delivery ? <AppText variant="small">Delivery: {o.business.delivery}</AppText> : null}
        </View>
      ) : null}
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

/** One frame of the order: its design, model, quantity and colors per part. */
function Frame({
  frame: f,
  orderNumber,
  several,
}: {
  frame: OrderFrameView;
  orderNumber: number;
  several: boolean;
}) {
  const { width } = useWindowDimensions();
  // Width / height of the image, read from the file once loaded (models differ in shape).
  const [aspect, setAspect] = useState(1600 / 556);
  const imageWidth = width - (spacing.xl + PHOTO_STAGE_INSET) * 2;
  return (
    <View style={styles.frame}>
      {f.imageUrl ? (
        <PhotoStage>
          <Image
            source={{ uri: f.imageUrl, cacheKey: f.imagePath ?? undefined }}
            style={{ width: imageWidth, height: imageWidth / aspect }}
            onLoad={(e) => e.source.width && e.source.height && setAspect(e.source.width / e.source.height)}
            contentFit="contain"
            cachePolicy="memory-disk"
            accessibilityLabel={
              several ? `Design of order ${orderNumber}, frame ${f.lineNo}` : `Design of order ${orderNumber}`
            }
          />
        </PhotoStage>
      ) : null}
      {several ? (
        <AppText variant="subheading">
          {f.lineNo}. {f.modelName} · {f.quantity} {f.quantity === 1 ? 'frame' : 'frames'}
        </AppText>
      ) : null}
      <Card style={styles.lines}>
        {f.items.map((i, n) => (
          <View key={`${i.zoneName}-${n}`} style={[styles.line, n > 0 && styles.lineBorder]}>
            <Swatch
              hex={i.hex}
              alpha={i.alpha}
              texture={i.textureUrl}
              size={tokens.swatch.md}
              accessibilityLabel={`Color ${i.ref}`}
            />
            <View style={styles.lineText}>
              <AppText variant="label">
                {i.zoneName} · {MATERIAL_LABEL[i.material]}
              </AppText>
              <AppText>
                Color {i.ref}
                {i.finish ? ` · ${FINISH_LABEL[i.finish]}` : ''}
              </AppText>
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { gap: spacing.md },
  lines: { paddingVertical: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  lineBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  lineText: { flex: 1, gap: 2 },
  field: { gap: spacing.xs },
});
