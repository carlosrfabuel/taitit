import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';

const PAD = tokens.spacing.xs;
const BORDER = 1;

/** Space the stage takes on each side: a photo inside is (stage width - 2 * PHOTO_STAGE_INSET) wide. */
export const PHOTO_STAGE_INSET = PAD + BORDER;

/**
 * White backdrop for a product photo. The photos have white backgrounds; on the warm page colour
 * they would show as a bare white box.
 */
export function PhotoStage({ children }: { children: ReactNode }) {
  return <View style={styles.stage}>{children}</View>;
}

const styles = StyleSheet.create({
  stage: {
    padding: PAD,
    borderWidth: BORDER,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    backgroundColor: tokens.colors.surface,
    overflow: 'hidden',
  },
});
