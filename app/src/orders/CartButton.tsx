import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { tokens } from '@taitit/shared';
import { AppText, Icon } from '@/ui';
import { useAuth } from '@/auth/AuthProvider';
import { useCart } from './cart';

const { colors, touch } = tokens;
const BADGE_ROOM = 8;

/**
 * The order being put together, always one tap away (catalog and customizer): a bag with the number
 * of frames in it. Empty, it opens "Your cart is empty". Hidden for guests (orders need an account).
 */
export function CartButton() {
  const { session } = useAuth();
  const cart = useCart();
  if (!session) return null;
  const n = cart.frames;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={n === 0 ? 'Your cart, empty' : `Your cart, ${n} ${n === 1 ? 'frame' : 'frames'}`}
      hitSlop={6}
      onPress={() => router.push('/order/summary')}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon name="cart-outline" size={24} color={colors.text} />
      {n > 0 ? (
        <View style={styles.badge}>
          <AppText variant="tiny" color={colors.onPrimary} style={styles.count}>
            {n > 99 ? '99+' : String(n)}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Wider than the icon on the right: the count sits there beside the cart, inside the button (a
  // navigation header clips anything drawn outside it).
  button: {
    width: touch.minSize + BADGE_ROOM,
    height: touch.minSize,
    paddingRight: BADGE_ROOM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontWeight: '700', lineHeight: 14 },
});
