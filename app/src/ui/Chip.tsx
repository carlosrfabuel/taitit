import { Pressable, StyleSheet } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { BrandGradient } from './BrandGradient';

const { colors, spacing, radius } = tokens;

/**
 * "strong": a selected chip in the TAITIT green gradient with white text (catalog filters). "fill": the chip
 * shares its row equally with the others (label centered, shrinking to fit on narrow phones).
 */
export function Chip({
  label,
  selected = false,
  onPress,
  tone = 'soft',
  fill = false,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'soft' | 'strong';
  fill?: boolean;
}) {
  const strong = selected && tone === 'strong';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.chip,
        fill && styles.fill,
        selected && (strong ? styles.strong : styles.selected),
        pressed && styles.pressed,
      ]}
    >
      {strong ? <BrandGradient /> : null}
      <AppText
        variant="label"
        color={strong ? colors.onPrimary : selected ? colors.onSelected : colors.text}
        numberOfLines={fill ? 1 : undefined}
        adjustsFontSizeToFit={fill}
        minimumFontScale={0.8}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  fill: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.sm },
  selected: { backgroundColor: colors.selected, borderColor: colors.selectedBorder },
  strong: { borderColor: 'transparent', overflow: 'hidden' },
  pressed: { opacity: 0.8 },
});
