import { StyleSheet, View } from 'react-native';
import { ORDER_STATUS_LABEL, OrderStatus, tokens } from '@taitit/shared';
import { AppText } from './AppText';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <View style={[styles.badge, { backgroundColor: tokens.statusColors[status] }]}>
      <AppText variant="tiny" color={tokens.colors.onPrimary}>
        {ORDER_STATUS_LABEL[status]}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
  },
});
