import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';

/**
 * TAITIT green as a gradient, lighter on the left to deep on the right, filling its parent (primary
 * buttons, the selected catalog chip). The parent rounds it (overflow hidden). Both ends keep white
 * text above 4.5:1 contrast.
 */
export const BRAND_GRADIENT = ['#3D8457', '#2F6B47', '#173D2A'] as const;

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
