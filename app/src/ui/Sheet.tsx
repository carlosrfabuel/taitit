import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';

const { colors, spacing, radius } = tokens;

// Bottom sheet over a dimmed screen: dialogs (name a design) and option menus. Tapping outside or
// the system back button closes it, unless `dismissable` is false (e.g. while saving).
export function Sheet({
  visible,
  title,
  onClose,
  dismissable = true,
  children,
}: {
  visible: boolean;
  title?: string;
  onClose: () => void;
  dismissable?: boolean;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const close = () => dismissable && onClose();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
          {title ? <AppText variant="heading">{title}</AppText> : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.xl,
    gap: spacing.lg,
  },
});
