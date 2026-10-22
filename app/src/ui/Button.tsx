import { ActivityIndicator, Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { BrandGradient } from './BrandGradient';
import { Icon, IconName } from './Icon';

const { colors, spacing, radius, touch } = tokens;

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dangerGhost';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  /** A trailing arrow (→). Default: on full-width primary buttons without their own icon (forward actions). */
  arrow?: boolean;
  style?: StyleProp<ViewStyle>;
};

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  // Primary: the TAITIT green gradient (BrandGradient) under the label.
  primary: { bg: colors.primary, fg: colors.onPrimary, border: 'transparent' },
  secondary: { bg: colors.surface, fg: colors.primary, border: colors.primary },
  ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  // Destructive but quiet (Delete account): red text and icon, no outline.
  dangerGhost: { bg: 'transparent', fg: colors.danger, border: 'transparent' },
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
  arrow,
  style,
}: Props) {
  const p = PALETTE[variant];
  const inactive = disabled || loading;
  const showArrow = (arrow ?? (variant === 'primary' && fullWidth && !icon)) && !inactive;
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
        variant === 'primary' && styles.gradient,
        fullWidth && styles.full,
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {variant === 'primary' ? <BrandGradient /> : null}
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={p.fg} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
            <AppText variant={size === 'sm' ? 'label' : 'subheading'} color={p.fg}>
              {title}
            </AppText>
            {showArrow ? <Icon name="arrow-forward" size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Every button is a pill (2026-10-22, after the sign-in references).
  base: { borderWidth: 1.5, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  md: { minHeight: 52, paddingHorizontal: spacing.xl },
  sm: { minHeight: touch.minSize - 8, paddingHorizontal: spacing.lg },
  full: { alignSelf: 'stretch' },
  gradient: { overflow: 'hidden' },
  content: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
