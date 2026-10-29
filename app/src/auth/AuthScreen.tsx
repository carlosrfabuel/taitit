import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { usePathname } from 'expo-router';
import { setPageTitle } from '@/navigation/TopBar';
import { tokens } from '@taitit/shared';
import { AppText, BrandLogo, Icon, Screen, useDesktop } from '@/ui';
import { useCloseAuth } from './navigation';

const { colors, spacing, radius } = tokens;

const PAGE_TITLE: Record<string, string> = {
  'sign-in': 'Sign in',
  'sign-up': 'Create account',
  'forgot-password': 'Reset password',
  'reset-password': 'New password',
};

/** Card widths on a computer: short forms (sign in, passwords) and the long sign-up form. */
const CARD_WIDTH = { narrow: 420, wide: 560 } as const;

/**
 * The account screens' page. Phones: the standard screen (logo in the header bar above). Computer: a
 * compact card in the middle of the window with the logo on top and "Back" above it, like a website's
 * sign-in page (the header bar is hidden there: see (auth)/_layout).
 */
export function AuthScreen({
  children,
  fill = false,
  width = 'narrow',
}: {
  children: ReactNode;
  /** Phones: short forms centered in the screen's height (Screen's `fill`). */
  fill?: boolean;
  width?: keyof typeof CARD_WIDTH;
}) {
  const desktop = useDesktop();
  const closeAuth = useCloseAuth();
  // The browser tab names the page (web).
  const page = PAGE_TITLE[usePathname().replace(/^\//, '')];
  useEffect(() => setPageTitle(page), [page]);
  if (!desktop) return <Screen fill={fill}>{children}</Screen>;
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      <View style={[styles.column, { maxWidth: CARD_WIDTH[width] }]}>
        <Pressable
          accessibilityRole="link"
          onPress={closeAuth}
          hitSlop={8}
          style={(s) => [styles.back, (s as { hovered?: boolean }).hovered && styles.backHovered]}
        >
          <Icon name="arrow-back" size={16} color={colors.muted} />
          <AppText variant="small" color={colors.muted}>
            Back
          </AppText>
        </Pressable>
        <View style={styles.card}>
          <View style={styles.logo}>
            <BrandLogo width={110} />
          </View>
          {children}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  // Centered in the window's height when it fits; scrolls (window scrollbar) when it doesn't.
  page: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  column: { width: '100%', gap: spacing.md },
  back: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, alignSelf: 'flex-start' },
  backHovered: { opacity: 0.7 },
  card: {
    gap: spacing.md,
    padding: spacing.xxl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  logo: { alignItems: 'center', marginBottom: spacing.sm },
});
