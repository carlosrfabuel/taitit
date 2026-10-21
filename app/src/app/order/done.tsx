import { Linking, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { tokens } from '@taitit/shared';
import { orderText, whatsappUrl } from '@/orders/orders';
import { useOrder } from '@/orders/useOrders';
import { AppText, Button, Icon, Screen, useToast } from '@/ui';

const { spacing, colors } = tokens;

// Shown once the order is saved. Opened with replace() from the summary, so "back" can't resend it.
export default function OrderDoneScreen() {
  const { id, number } = useLocalSearchParams<{ id?: string; number?: string }>();
  const order = useOrder(id);
  const toast = useToast();

  const share = async () => {
    if (!order.data) return;
    try {
      await Linking.openURL(whatsappUrl(orderText(order.data)));
    } catch {
      toast("Couldn't open WhatsApp.", 'error');
    }
  };

  return (
    <Screen
      footer={
        <View style={styles.actions}>
          <Button
            title="Send via WhatsApp"
            icon="logo-whatsapp"
            fullWidth
            onPress={share}
            loading={order.isPending}
            disabled={!order.data}
          />
          <Button
            title="View my orders"
            variant="secondary"
            fullWidth
            // Clears customize / summary / done from history, then opens the orders tab.
            onPress={() => {
              router.dismissTo('/');
              router.navigate('/orders');
            }}
          />
          <Button title="Back to catalog" variant="ghost" fullWidth onPress={() => router.dismissTo('/')} />
        </View>
      }
    >
      {order.isError && !order.data ? (
        <View style={styles.retry}>
          <AppText variant="small" align="center">
            {"Your order was received, but its details couldn't be loaded here."}
          </AppText>
          <Button title="Try again" variant="ghost" size="sm" onPress={() => void order.refetch()} />
        </View>
      ) : null}
      <View style={styles.center}>
        <View style={styles.icon}>
          <Icon name="checkmark-circle" size={64} color={colors.success} />
        </View>
        <AppText variant="title" align="center">
          Order received!
        </AppText>
        <AppText variant="heading" align="center">
          Order #{number ?? order.data?.number ?? '—'}
        </AppText>
        <AppText align="center" color={colors.muted}>
          {order.data
            ? `${order.data.modelName} · ${order.data.quantity} ${order.data.quantity === 1 ? 'frame' : 'frames'}`
            : ' '}
        </AppText>
        <AppText variant="small" align="center">
          TAITIT has received your order. You can find it any time in My orders.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  icon: { marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
  retry: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
});
