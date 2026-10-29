import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { tokens } from '@taitit/shared';
import { AppText, Icon, PAGE_MAX_WIDTH, READING_WIDTH } from '@/ui';
import { fonts } from '@/ui/fonts';
import { ACCOUNT_HREF, SECTIONS, TopBar, setPageTitle, type Section } from './TopBar';

const { colors, spacing } = tokens;

/** What a stack screen's header gets (the parts this header uses). */
type Props = {
  back?: { title: string | undefined };
  route: { name: string };
  options: { title?: string; headerBackVisible?: boolean };
  navigation: {
    goBack: () => void;
    isFocused: () => boolean;
    addListener: (event: 'focus', callback: () => void) => () => void;
  };
};

/** The section an inner page belongs to (underlined in the top bar). */
function sectionOf(route: string): Section | null {
  if (route.startsWith('customize')) return 'catalog';
  if (route === 'order/[id]' || route === 'order/done') return 'orders';
  if (route.startsWith('spare-parts')) return 'spare-parts';
  if (route === 'business' || route === 'delete-account') return 'account';
  return null;
}

/** Pages laid out on the whole page width (the rest use the reading width). */
const WIDE = new Set(['customize/[modelId]']);

/**
 * The inner pages (customizer, cart, an order…) on a computer: the website's top bar, then a row with
 * the back arrow and the page's title, lined up with the page's content column. Opened from a link
 * (nothing to go back to), the arrow leads to the catalog. The browser tab shows the title.
 */
export function DesktopStackHeader({ back, route, options, navigation }: Props) {
  // Also when this page is shown again (back from a page above it, which had its own title).
  useEffect(() => {
    if (navigation.isFocused()) setPageTitle(options.title);
    return navigation.addListener('focus', () => setPageTitle(options.title));
  }, [navigation, options.title]);
  const showBack = options.headerBackVisible !== false;
  const open = (key: Section) =>
    router.navigate(key === 'account' ? ACCOUNT_HREF : SECTIONS.find((s) => s.key === key)!.href);
  return (
    <View>
      <TopBar active={sectionOf(route.name)} onSection={open} />
      <View style={styles.row}>
        <View style={[styles.inner, { maxWidth: WIDE.has(route.name) ? PAGE_MAX_WIDTH : READING_WIDTH }]}>
          {showBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={back ? 'Back' : 'Catalog'}
              onPress={() => (back ? navigation.goBack() : router.replace('/'))}
              hitSlop={8}
              style={(s) => [styles.back, (s as { hovered?: boolean }).hovered && styles.hovered]}
            >
              <Icon name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          ) : null}
          <AppText style={styles.title} numberOfLines={1} accessibilityRole="header">
            {options.title ?? ''}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.background, alignItems: 'center' },
  inner: {
    width: '100%',
    height: 64,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
  },
  hovered: { backgroundColor: colors.border },
  title: { flex: 1, fontFamily: fonts.heading, fontSize: tokens.typography.heading, color: colors.text },
});
