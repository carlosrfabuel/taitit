import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText, Screen } from '@/ui';

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
    <Screen>
      <AppText variant="title">{title}</AppText>
      {note ? <AppText variant="small">{note}</AppText> : null}
      {children ? <View style={styles.body}>{children}</View> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { gap: tokens.spacing.md, marginTop: tokens.spacing.sm },
});
