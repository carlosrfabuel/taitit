import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

// Carlos's logo with its tagline "Tailored handcrafted eyewear" (2026-10-20 files, black version for
// light screens; the white one is in the start screen picture and the splash).
const LOGO = require('../../assets/images/logo-full-black.png');
const ASPECT = 900 / 312;

export function BrandLogo({ width, style }: { width: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={LOGO}
      style={[{ width, height: width / ASPECT }, style]}
      contentFit="contain"
      accessibilityLabel="TAITIT, tailored handcrafted eyewear"
    />
  );
}
