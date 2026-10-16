import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { tokens } from '@taitit/shared';
import { Placeholder } from '@/components/Placeholder';

export default function OrderDoneScreen() {
  return (
    <Placeholder title="Order received!" note="Order number and WhatsApp sharing (Day 17).">
      {/* Clear customize/summary/done from history so "back" can't reopen a sent order. */}
      <Pressable style={styles.button} onPress={() => router.dismissTo('/')}>
        <Text style={styles.text}>Back to catalog</Text>
      </Pressable>
    </Placeholder>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.border,
  },
  text: { color: tokens.colors.accent, fontWeight: '700', fontSize: tokens.typography.body },
});
