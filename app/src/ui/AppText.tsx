import { StyleSheet, Text, TextProps } from 'react-native';
import { tokens } from '@taitit/shared';

import { fonts } from './fonts';

const { colors, typography, lineHeight } = tokens;

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
    fontFamily: fonts.display,
    color: colors.text,
  },
  heading: {
    fontSize: typography.heading,
    lineHeight: lineHeight.heading,
    fontFamily: fonts.heading,
    color: colors.text,
  },
  subheading: {
    fontSize: typography.subheading,
    lineHeight: lineHeight.subheading,
    fontFamily: fonts.headingMedium,
    color: colors.text,
  },
  body: {
    fontSize: typography.body,
    lineHeight: lineHeight.body,
    fontFamily: fonts.body,
    color: colors.text,
  },
  small: {
    fontSize: typography.small,
    lineHeight: lineHeight.small,
    fontFamily: fonts.body,
    color: colors.muted,
  },
  tiny: {
    fontSize: typography.tiny,
    lineHeight: lineHeight.tiny,
    fontFamily: fonts.bodyMedium,
    color: colors.muted,
  },
  label: {
    fontSize: typography.small,
    lineHeight: lineHeight.small,
    fontFamily: fonts.label,
    color: colors.text,
    letterSpacing: 0.2,
  },
});
