import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

const { colors, spacing, radius } = tokens;

// Light green = done/approved, warm yellow = waiting or worth reading, danger = refused.
const TONES = {
  selected: { bg: colors.selected, fg: colors.onSelected },
  highlight: { bg: colors.highlight, fg: colors.onHighlight },
  neutral: { bg: colors.surfaceMuted, fg: colors.muted },
  danger: { bg: colors.surfaceMuted, fg: colors.danger },
} as const;

export type BadgeTone = keyof typeof TONES;

/** A status label: short ones read as a pill, longer ones wrap as a small note. */
export function Badge({
  label,
  tone = 'neutral',
  icon,
  style,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }, style]}>
      {icon ? <Icon name={icon} size={16} color={t.fg} /> : null}
      <AppText variant="label" color={t.fg} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
  },
  text: { flexShrink: 1 },
});
