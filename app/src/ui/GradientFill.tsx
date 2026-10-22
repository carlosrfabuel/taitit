import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { tokens } from '@taitit/shared';

const { colors } = tokens;

/** A soft round glow of color: center and radius as fractions of the width (y of the height). */
export type Glow = { x: number; y: number; radius: number; color: string };

/**
 * Warm, layered background (benchmark: a fashion shop's colorful header): the palette's yellow and
 * greens as soft glows over the green-to-cream fade (catalog and welcome screen).
 */
export const WARM_GLOWS: Glow[] = [
  { x: 0.95, y: 0.02, radius: 0.85, color: '#FBE7A1E6' },
  { x: 0.05, y: 0.18, radius: 0.75, color: '#B9DDB2D9' },
  { x: 0.6, y: 0.3, radius: 0.55, color: '#F6D98A66' },
];

/**
 * A vertical gradient filling its parent (behind the content): light green at the top fading into the
 * app background, for the welcome screen and the catalog. `until` ends the fade early (the rest is the
 * bottom color); `glows` add soft color spots on top (the catalog's warmer, richer background). Drawn
 * with Skia (already used for the recolor), so no extra native module.
 */
export function GradientFill({
  top = colors.selected,
  bottom = colors.background,
  until = 1,
  glows = [],
}: {
  top?: string;
  bottom?: string;
  until?: number;
  glows?: Glow[];
}) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const { width, height } = size;
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {width > 0 && height > 0 && (
        <Canvas style={size}>
          <Rect x={0} y={0} width={width} height={height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(0, height)}
              colors={[top, bottom, bottom]}
              positions={[0, until, 1]}
            />
          </Rect>
          {glows.map((g, i) => {
            const c = vec(g.x * width, g.y * height);
            const r = g.radius * width;
            return (
              <Circle key={i} c={c} r={r}>
                {/* The color fading to the same color fully transparent: a soft spot, no hard edge. */}
                <RadialGradient c={c} r={r} colors={[g.color, `${g.color.slice(0, 7)}00`]} />
              </Circle>
            );
          })}
        </Canvas>
      )}
    </View>
  );
}
