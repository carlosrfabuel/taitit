import { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { useDesktop } from './layout';

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
  // On a computer: a centered dialog instead of a sheet across the bottom of the screen.
  const desktop = useDesktop();
  const close = () => dismissable && onClose();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <KeyboardAvoidingView
        style={[styles.root, desktop && styles.rootCentered]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }, desktop && styles.dialog]}>
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
  rootCentered: { justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  dialog: { width: '100%', maxWidth: 560, borderRadius: radius.lg },
});
