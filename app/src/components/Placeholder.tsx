import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { tokens } from '@taitit/shared';

const { colors, spacing, typography } = tokens;

// Temporary screen body used until each screen is built.
export function Placeholder({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>{title}</Text>
      {note ? <Text style={styles.note}>{note}</Text> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.xl, gap: spacing.md },
  title: { fontSize: typography.title, fontWeight: '800', color: colors.text },
  note: { fontSize: typography.body, color: colors.muted },
  body: { gap: spacing.md, marginTop: spacing.md },
});
