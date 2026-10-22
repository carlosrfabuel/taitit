import { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { tokens } from '@taitit/shared';

type Props = {
  children: ReactNode;
  /** Scrollable content (default) or a fixed layout. */
  scroll?: boolean;
  /** Pinned content at the bottom, e.g. the main action button. */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /**
   * Short forms (sign in): the content is centered in the screen's height instead of hugging the top.
   * Scrolls when the keyboard needs the room.
   */
  fill?: boolean;
};

// Standard screen body. Headers come from the navigator, so only the bottom edge needs care.
export function Screen({ children, scroll = true, footer, contentStyle, fill = false }: Props) {
  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, fill && styles.fill, contentStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fixed, contentStyle]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: tokens.spacing.xl, gap: tokens.spacing.lg },
  fixed: { flex: 1 },
  // Top block, then the rest centered in the remaining height (no big empty band between them).
  fill: { flexGrow: 1, justifyContent: 'center' },
  footer: {
    padding: tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
  },
});
