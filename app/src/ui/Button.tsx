import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { Icon, IconName } from './Icon';

const { colors, spacing, radius, touch } = tokens;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
};

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
}: Props) {
  const p = PALETTE[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: p.bg, borderColor: p.border },
        fullWidth && styles.full,
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
            <AppText variant={size === 'sm' ? 'label' : 'subheading'} color={p.fg}>
              {title}
            </AppText>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: 1.5, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 52, paddingHorizontal: spacing.xl },
  sm: { minHeight: touch.minSize - 8, paddingHorizontal: spacing.lg },
  full: { alignSelf: 'stretch' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
