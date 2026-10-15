import { Href, Link } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { tokens } from '@taitit/shared';

export function NavLink({ href, label }: { href: Href; label: string }) {
  return (
    <Link href={href} style={styles.link}>
      <Text style={styles.text}>{label}</Text>
    </Link>
  );
}

const styles = StyleSheet.create({
  link: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  text: { color: tokens.colors.accent, fontWeight: '700', fontSize: tokens.typography.body },
});
