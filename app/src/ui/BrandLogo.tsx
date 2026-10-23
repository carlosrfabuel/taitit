import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

// Carlos's logo with its tagline "Tailored handcrafted eyewear" (2026-10-20 files): black for light
// screens, white (the same file with the black turned white) for the dark start screen.
const LOGOS = {
  black: require('../../assets/images/logo-full-black.png'),
  white: require('../../assets/images/logo-full-white.png'),
};
const ASPECT = 900 / 312;

export function BrandLogo({
  width,
  tone = 'black',
  style,
}: {
  width: number;
  tone?: 'black' | 'white';
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={LOGOS[tone]}
      style={[{ width, height: width / ASPECT }, style]}
      contentFit="contain"
      accessibilityLabel="TAITIT, tailored handcrafted eyewear"
    />
  );
}
