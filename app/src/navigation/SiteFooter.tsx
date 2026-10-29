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
  );
}

const styles = StyleSheet.create({
  footer: {
    marginTop: spacing.xxl,
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
