import { Image, ImageSource } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';

const { colors } = tokens;

type Props = {
  hex: string;
  /** Opacity for translucent acetates (0..1); shown over a checkerboard. */
  alpha?: number | null;
  /** Tortoiseshell texture; drawn instead of the flat color. */
  texture?: ImageSource | string | null;
  size?: number;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel: string;
};

// Color sample used in the customizer palette and in summaries.
export function Swatch({
  hex,
  alpha,
  texture,
  size = tokens.swatch.lg,
  selected = false,
  onPress,
  accessibilityLabel,
}: Props) {
  const inner = size - 8;
  const half = inner / 2;
  const fill = (
    <View style={[styles.fill, { width: inner, height: inner, borderRadius: inner / 2 }]}>
      {texture ? (
        <Image source={texture} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <>
          {alpha != null ? (
            // Checkerboard so transparency is visible.
            <View style={StyleSheet.absoluteFill}>
              <View style={[styles.check, { width: half, height: half, left: 0, top: 0 }]} />
              <View style={[styles.check, { width: half, height: half, left: half, top: half }]} />
            </View>
          ) : null}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: hex, opacity: alpha ?? 1 }]} />
        </>
      )}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      disabled={!onPress}
      onPress={onPress}
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2 },
        selected && { borderColor: colors.focus },
      ]}
    >
      {fill}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  fill: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  check: { position: 'absolute', backgroundColor: '#D5D5D0' },
});
