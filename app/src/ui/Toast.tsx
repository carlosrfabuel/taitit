import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { useDesktop } from './layout';

type ToastType = 'info' | 'success' | 'error';
/** A button on the toast, e.g. "View" after adding a frame to the order. */
type ToastAction = { label: string; onPress: () => void };
type ToastState = { id: number; message: string; type: ToastType; action?: ToastAction } | null;

const ToastContext = createContext<(message: string, type?: ToastType, action?: ToastAction) => void>(
  () => {},
);

export function useToast() {
  return useContext(ToastContext);
}

const ICON = { info: 'information-circle', success: 'checkmark-circle', error: 'alert-circle' } as const;
const DESKTOP_TOAST_WIDTH = 420;
/** Below the computer's top bar (72 px). */
const DESKTOP_TOAST_TOP = 84;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const window = useWindowDimensions();
  const toastWidth = Math.min(DESKTOP_TOAST_WIDTH, window.width - tokens.spacing.lg * 2);

  const show = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, type, action });
    // Longer with a button, so there is time to press it.
    timer.current = setTimeout(() => setToast(null), action ? 4000 : 2500);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInDown}
          exiting={FadeOutDown}
          accessibilityLiveRegion="polite"
          style={[
            styles.toast,
            // Computer: a compact message centered just under the top bar, where it covers no button,
            // footer or photo.
            desktop
              ? {
                  top: DESKTOP_TOAST_TOP,
                  left: (window.width - toastWidth) / 2,
                  right: undefined,
                  width: toastWidth,
                }
              : { bottom: insets.bottom + 72 },
          ]}
        >
          {/* White like the text: a green or red icon vanished on the green toast. */}
          <Icon name={ICON[toast.type]} size={20} color={tokens.colors.onPrimary} />
          <AppText variant="body" color={tokens.colors.onPrimary} style={styles.text}>
            {toast.message}
          </AppText>
          {toast.action ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={12}
              onPress={() => {
                const { onPress } = toast.action!;
                setToast(null);
                onPress();
              }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <AppText variant="label" color={tokens.colors.onPrimary} style={styles.action}>
                {toast.action.label}
              </AppText>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: tokens.spacing.lg,
    right: tokens.spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    backgroundColor: tokens.colors.primary,
    borderRadius: tokens.radius.md,
    paddingVertical: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.lg,
  },
  text: { flex: 1 },
  action: { textDecorationLine: 'underline' },
  pressed: { opacity: 0.7 },
});
