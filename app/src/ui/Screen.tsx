import { createContext, ReactNode, useContext } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { readingColumn, useDesktop } from './layout';
import { SiteFooter, siteFooterPage } from '@/navigation/SiteFooter';

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

/**
 * Set by the tab layout: its floating bar already sits above the phone's navigation buttons, so
 * screens in a tab need no room of their own for them.
 */
export const InTabsContext = createContext(false);

// Standard screen body. Headers come from the navigator, so only the bottom edge needs care.
export function Screen({ children, scroll = true, footer, contentStyle, fill = false }: Props) {
  // On a computer, the content keeps a reading width in the middle of the page, and the footer's
  // buttons follow the content (like a website's) instead of sitting at the bottom of the window.
  const desktop = useDesktop();
  const insets = useSafeAreaInsets();
  const inTabs = useContext(InTabsContext);
  // Without a pinned footer the content's end clears the phone's navigation buttons or gesture bar
  // (the app draws behind them), unless the tab bar already does.
  const end = !footer && !inTabs ? { paddingBottom: tokens.spacing.xl + insets.bottom } : null;
  const reading = desktop ? readingColumn : null;
  // A computer: the page reaches the window's bottom (its footer there), and a short form is centered
  // in the room above the footer.
  const page = desktop ? siteFooterPage : null;
  const body = fill && desktop ? <View style={styles.fillBody}>{children}</View> : children;
  const inlineFooter = desktop && footer ? <View style={styles.inlineFooter}>{footer}</View> : null;
  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, end, fill && styles.fill, page, contentStyle, reading]}
          keyboardShouldPersistTaps="handled"
        >
          {body}
          {inlineFooter}
          <SiteFooter />
        </ScrollView>
      ) : (
        <View style={[styles.content, end, styles.fixed, contentStyle, reading]}>
          {children}
          {inlineFooter}
        </View>
      )}
      {/* Above the phone's own navigation buttons or gesture bar (the app draws behind them). */}
      {footer && !desktop ? (
        <View style={[styles.footer, { paddingBottom: tokens.spacing.lg + insets.bottom }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: tokens.spacing.xl, gap: tokens.spacing.lg },
  fixed: { flex: 1 },
  // Top block, then the rest centered in the remaining height (no big empty band between them).
  fill: { flexGrow: 1, justifyContent: 'center' },
  fillBody: { flexGrow: 1, justifyContent: 'center', gap: tokens.spacing.lg },
  inlineFooter: { marginTop: tokens.spacing.sm },
  footer: {
    padding: tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border,
    backgroundColor: tokens.colors.background,
  },
});
