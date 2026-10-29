import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, type Href } from 'expo-router';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { CartButton } from '@/orders/CartButton';
import { AppText, BrandLogo, Icon, PAGE_MAX_WIDTH } from '@/ui';

const { colors, spacing } = tokens;

export type Section = 'catalog' | 'designs' | 'orders' | 'spare-parts' | 'account';

/** The sections of the bar, in order, with their addresses (account: on the right). */
export const SECTIONS: { key: Exclude<Section, 'account'>; title: string; href: Href }[] = [
  { key: 'catalog', title: 'Catalog', href: '/' },
  { key: 'designs', title: 'My designs', href: '/designs' },
  { key: 'orders', title: 'My orders', href: '/orders' },
  { key: 'spare-parts', title: 'Spare parts', href: '/spare-parts' },
];
export const ACCOUNT_HREF: Href = '/account';

/** The browser tab's title: "My orders · TAITIT" (web only). */
export function setPageTitle(title: string | undefined) {
  if (Platform.OS === 'web' && typeof document !== 'undefined')
    document.title = title ? `${title} · TAITIT` : 'TAITIT';
}

/**
 * The web on a computer: a website's top bar (logo, the sections, then the cart and the account), on
 * every page. `active` underlines the section the page belongs to; `onSection` opens one.
 */
export function TopBar({ active, onSection }: { active: Section | null; onSection: (key: Section) => void }) {
  const { session } = useAuth();

  const item = (key: Section, title: string) => {
    const focused = active === key;
    return (
      <Pressable
        key={key}
        accessibilityRole="link"
        accessibilityState={{ selected: focused }}
        onPress={() => onSection(key)}
        style={(s) => [styles.item, (s as { hovered?: boolean }).hovered && !focused && styles.itemHovered]}
      >
        <AppText variant="label" color={focused ? colors.text : colors.muted}>
          {title}
        </AppText>
        <View style={[styles.underline, focused && styles.underlineOn]} />
      </Pressable>
    );
  };

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="TAITIT, catalog"
          onPress={() => onSection('catalog')}
        >
          <BrandLogo width={104} />
        </Pressable>
        <View style={styles.sections} accessibilityRole="menubar">
          {SECTIONS.map((s) => item(s.key, s.title))}
        </View>
        <View style={styles.right}>
          <CartButton />
          {session ? (
            item('account', 'Account')
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/sign-in')}
              style={(s) => [styles.signIn, (s as { hovered?: boolean }).hovered && styles.signInHovered]}
            >
              <Icon name="person-outline" size={18} color={colors.onPrimary} />
              <AppText variant="label" color={colors.onPrimary}>
                Sign in
              </AppText>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    maxWidth: PAGE_MAX_WIDTH,
    height: 72,
    paddingHorizontal: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  sections: { flex: 1, flexDirection: 'row', alignItems: 'stretch', height: '100%', gap: spacing.xs },
  right: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, height: '100%' },
  item: { paddingHorizontal: spacing.md, justifyContent: 'center', height: '100%' },
  itemHovered: { opacity: 0.7 },
  underline: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: 0,
    height: 2,
    backgroundColor: 'transparent',
  },
  underlineOn: { backgroundColor: colors.primary },
  signIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  signInHovered: { opacity: 0.85 },
});
