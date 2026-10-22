import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, TextInputProps, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { fonts } from './fonts';

const { colors, spacing, radius, typography } = tokens;

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  helper?: string;
  /** Shows an eye button to reveal the value (passwords). */
  revealable?: boolean;
};

export function TextField({ label, error, helper, revealable, secureTextEntry, style, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);
  const secure = revealable ? hidden : secureTextEntry;
  const borderColor = error ? colors.danger : focused ? colors.focus : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? <AppText variant="label">{label}</AppText> : null}
      <View style={[styles.field, { borderColor }]}>
        <TextInput
          // Screen readers announce the field by its visible label (unless a caller gives its own).
          accessibilityLabel={label}
          {...rest}
          secureTextEntry={secure}
          placeholderTextColor={colors.muted}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
        {revealable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
          >
            <Icon name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : helper ? (
        <AppText variant="small">{helper}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs + 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderWidth: 1.5,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.body,
    fontFamily: fonts.body,
    color: colors.text,
    paddingVertical: spacing.md,
  },
});
