import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_800ExtraBold_Italic,
} from '@expo-google-fonts/playfair-display';
import { Urbanist_500Medium, Urbanist_600SemiBold, Urbanist_700Bold } from '@expo-google-fonts/urbanist';

// The app's typefaces (2026-10-22, "modern and fashion"; Syne's short, wide letters were not liked):
// Playfair Display, tall and high-contrast like a fashion magazine, for headlines and screen titles;
// Urbanist, clean and geometric, for everything else (buttons, labels, chips, text, fields).
// One family name per weight: with a custom font Android ignores fontWeight, so styles name the file.
export const FONT_FILES = {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_800ExtraBold,
  PlayfairDisplay_800ExtraBold_Italic,
  Urbanist_500Medium,
  Urbanist_600SemiBold,
  Urbanist_700Bold,
};

export const fonts = {
  /** Big headlines (welcome, catalog) and AppText "title". */
  display: 'PlayfairDisplay_800ExtraBold',
  /** The headline's accent words (catalog "next frame"). */
  displayItalic: 'PlayfairDisplay_800ExtraBold_Italic',
  /** AppText "heading" and the screen titles in the top bar. */
  heading: 'PlayfairDisplay_700Bold',
  /** AppText "subheading": medium buttons, prominent values, tab labels. */
  headingMedium: 'Urbanist_600SemiBold',
  /** AppText "label": small buttons, chips, field labels, badges. */
  label: 'Urbanist_700Bold',
  // Medium, not Regular: Urbanist Regular's thin strokes read poorly at small sizes on real screens.
  body: 'Urbanist_500Medium',
  bodyMedium: 'Urbanist_500Medium',
  bodyBold: 'Urbanist_700Bold',
} as const;
