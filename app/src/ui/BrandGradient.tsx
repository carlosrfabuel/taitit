import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';

/**
 * TAITIT black as a soft gradient, graphite on the left to pure black on the right, filling its
 * parent (primary buttons, the selected catalog chip). The parent rounds it (overflow hidden). White
 * text stays far above 4.5:1 contrast on both ends.
 */
export const BRAND_GRADIENT = ['#3A3A3A', '#1A1A1A', '#000000'] as const;

export function BrandGradient() {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size.width > 0 && size.height > 0 && (
        <Canvas style={size}>
          <Rect x={0} y={0} width={size.width} height={size.height}>
            <LinearGradient
              start={vec(0, 0)}
              end={vec(size.width, size.height)}
              colors={[...BRAND_GRADIENT]}
            />
          </Rect>
        </Canvas>
      )}
    </View>
  );
}
