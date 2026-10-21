import { Pressable, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { Icon } from './Icon';

const { colors, spacing, radius, touch } = tokens;

/** A number with − and + buttons (e.g. how many identical frames to order). */
export function QuantityStepper({
  label,
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  const set = (n: number) => {
    const next = Math.min(max, Math.max(min, n));
    if (next !== value) onChange(next);
  };
  const step = (icon: 'remove' | 'add', delta: number, name: string, off: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={name}
      accessibilityState={{ disabled: off }}
      disabled={off}
      onPress={() => set(value + delta)}
      hitSlop={4}
      style={({ pressed }) => [styles.step, off && styles.off, pressed && styles.pressed]}
    >
      <Icon name={icon} size={20} color={colors.primary} />
    </Pressable>
  );
  return (
    <View
      style={styles.row}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => set(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      <AppText variant="label" style={styles.label}>
        {label}
      </AppText>
      {step('remove', -1, `Fewer ${label.toLowerCase()}`, disabled || value <= min)}
      <AppText variant="subheading" style={styles.value}>
        {value}
      </AppText>
      {step('add', 1, `More ${label.toLowerCase()}`, disabled || value >= max)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  label: { flex: 1 },
  step: {
    width: touch.minSize,
    height: touch.minSize,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.35 },
  pressed: { opacity: 0.7 },
  value: { minWidth: 32, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
