import { StyleSheet, Text, TextProps } from 'react-native';
import { tokens } from '@taitit/shared';

const { colors, typography, lineHeight, weight } = tokens;

export type TextVariant = 'title' | 'heading' | 'subheading' | 'body' | 'small' | 'tiny' | 'label';

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
  align?: 'left' | 'center' | 'right';
};

export function AppText({ variant = 'body', color, align, style, ...rest }: Props) {
  return (
    <Text
      {...rest}
      style={[styles[variant], color ? { color } : null, align ? { textAlign: align } : null, style]}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.title,
    lineHeight: lineHeight.title,
    fontWeight: weight.heavy,
    color: colors.text,
  },
  heading: {
    fontSize: typography.heading,
    lineHeight: lineHeight.heading,
    fontWeight: weight.bold,
    color: colors.text,
  },
  subheading: {
    fontSize: typography.subheading,
    lineHeight: lineHeight.subheading,
    fontWeight: weight.medium,
    color: colors.text,
  },
  body: {
    fontSize: typography.body,
    lineHeight: lineHeight.body,
    fontWeight: weight.regular,
    color: colors.text,
  },
  small: {
    fontSize: typography.small,
    lineHeight: lineHeight.small,
    fontWeight: weight.regular,
    color: colors.muted,
  },
  tiny: {
    fontSize: typography.tiny,
    lineHeight: lineHeight.tiny,
    fontWeight: weight.medium,
    color: colors.muted,
  },
  label: {
    fontSize: typography.small,
    lineHeight: lineHeight.small,
    fontWeight: weight.bold,
    color: colors.text,
    letterSpacing: 0.3,
  },
});
