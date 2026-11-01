import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { ACCOUNT_DELETION_URL, PRIVACY_URL, SUPPORT_EMAIL } from '@/lib/links';
// Directly, not through '@/ui': Screen (in '@/ui') shows this footer.
import { AppText } from '@/ui/AppText';
import { useDesktop } from '@/ui/layout';

const { colors, spacing } = tokens;

/**
 * The web on a computer: a website's footer at the end of the page (contact, privacy policy, account
 * deletion). Nothing on phones (the same links are in Account there).
 *
 * On a short page it sits at the bottom of the window, not right under the content: its page's
 * content container grows to the window's height (`siteFooterPage`), and in a list the footer's own
 * wrapper is pushed down (`siteFooterSpot`).
 */
export function SiteFooter() {
  const desktop = useDesktop();
  if (!desktop) return null;
  const link = (label: string, url: string) => (
    <Pressable
      accessibilityRole="link"
      onPress={() => void Linking.openURL(url)}
      style={(s) => (s as { hovered?: boolean }).hovered && styles.hovered}
    >
      <AppText variant="small" color={colors.muted} style={styles.link}>
        {label}
      </AppText>
    </Pressable>
  );
  return (
    <View style={[siteFooterSpot, styles.spot]}>
      <View style={styles.footer}>
        <AppText variant="small" color={colors.muted}>
          © {new Date().getFullYear()} TAITIT · Tailored handcrafted eyewear
        </AppText>
        <View style={styles.links}>
          {link(`Contact: ${SUPPORT_EMAIL}`, `mailto:${SUPPORT_EMAIL}`)}
          {link('Privacy policy', PRIVACY_URL)}
          {link('Account deletion', ACCOUNT_DELETION_URL)}
        </View>
      </View>
    </View>
  );
}

/** For the content container of a page that ends with this footer: at least the window's height. */
export const siteFooterPage = { flexGrow: 1 } as const;

/** Takes the room left on a short page, so what follows sits at the bottom. */
export const siteFooterSpot = { marginTop: 'auto' } as const;

const styles = StyleSheet.create({
  // The least room above it, when the page is long.
  spot: { paddingTop: spacing.xxl },
  footer: {
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  link: { textDecorationLine: 'underline' },
  hovered: { opacity: 0.7 },
});
