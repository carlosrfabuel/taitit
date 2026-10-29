import { ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { tokens } from '@taitit/shared';
import { readingColumn, useDesktop } from './layout';
import { SiteFooter } from '@/navigation/SiteFooter';

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
  // On a computer, the content keeps a reading width in the middle of the page, and the footer's
  // buttons follow the content (like a website's) instead of sitting at the bottom of the window.
  const desktop = useDesktop();
  const reading = desktop ? readingColumn : null;
  const inlineFooter = desktop && footer ? <View style={styles.inlineFooter}>{footer}</View> : null;
  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, fill && styles.fill, contentStyle, reading]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
          {inlineFooter}
          <SiteFooter />
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fixed, contentStyle, reading]}>
          {children}
          {inlineFooter}
        </View>
      )}
      {footer && !desktop ? <View style={styles.footer}>{footer}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: tokens.spacing.xl, gap: tokens.spacing.lg },
  fixed: { flex: 1 },
  // Top block, then the rest centered in the remaining height (no big empty band between them).
  fill: { flexGrow: 1, justifyContent: 'center' },
  inlineFooter: { marginTop: tokens.spacing.sm },
  footer: {
    padding: tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
  },
});
