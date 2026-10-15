import { useEffect } from 'react';
import { ActivityIndicator, DimensionValue, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';

export function Loader({ message }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={tokens.colors.primary} />
      {message ? <AppText variant="small">{message}</AppText> : null}
    </View>
  );
}

// Pulsing placeholder block shown while content loads.
export function Skeleton({
  width = '100%',
  height = 16,
  radius = tokens.radius.sm,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}) {
  const opacity = useSharedValue(0.5);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.skeleton, { width, height, borderRadius: radius }, animated]} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.md,
    padding: tokens.spacing.xl,
  },
  skeleton: { backgroundColor: tokens.colors.surfaceMuted },
});
