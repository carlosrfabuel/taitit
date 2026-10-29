import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle, LinearGradient, RadialGradient, Rect, vec } from '@shopify/react-native-skia';
import { tokens } from '@taitit/shared';

const { colors } = tokens;

/** A soft round glow of color: center and radius as fractions of the width (y of the height). */
export type Glow = { x: number; y: number; radius: number; color: string };

/**
 * Calm, layered background (benchmarks 2026-10-23: monochrome shops where the frames bring the only
 * colour): soft warm-grey and white glows over the grey-to-off-white fade (catalog).
 */
export const WARM_GLOWS: Glow[] = [
  { x: 0.95, y: 0.02, radius: 0.85, color: '#E6E0D4CC' },
  { x: 0.05, y: 0.2, radius: 0.75, color: '#FFFFFFCC' },
];

/**
 * A vertical gradient filling its parent (behind the content): light warm grey at the top fading into
 * the app background, for the catalog. `until` ends the fade early (the rest is the
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
            // At most the area's height: on a wide page a glow sized by the width would be cut off at
            // the bottom (a hard edge). Phones are narrower than that, so nothing changes there.
            const r = Math.min(g.radius * width, height);
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
