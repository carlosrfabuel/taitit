import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { tokens } from '@taitit/shared';
import { AppText, BrandLogo, Icon } from '@/ui';
import { fonts } from '@/ui/fonts';
import { useWelcome } from '@/lib/welcome';

// The start screen (2026-10-23, the user's design mvp/hero/e.png): a black studio photo of three
// frames (mvp/hero/e1.png, the same picture without its text) with Carlos's real logo, the headline,
// the button and the link drawn on top as real elements. Their heights follow the picture (where
// e.png drew them), horizontally they are centred on the screen, so a narrow phone that crops the
// picture's sides never cuts them.
const IMAGE = require('../../assets/images/welcome.jpg');
const IMG_W = 941;
const IMG_H = 1672;
// Where e.png drew them, in the picture's own pixels.
const LOGO = { top: 64, width: 400 };
const HEADLINE = { top: 266, size: 98, line: 108, width: 760 };
const BUTTON = { top: 1362, height: 108, width: 816 };
const SIGN_IN = { center: 1528, size: 36 };
// Picture pixels that may be cropped off the top and the bottom (the logo starts 64 px down, the
// link ends ~125 px above the bottom).
const SAFE_CROP_Y = 50;
const SIDE = 20;

const { colors, touch, radius } = tokens;
const CREAM = '#FBF6EC';
const WARM_WHITE = '#F7F1E6';

// First screen for visitors who aren't signed in (first launch and after signing out).
export default function WelcomeScreen() {
  // The screen's own area (not the window: it may start below the status bar), measured on layout.
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const welcome = useWelcome();

  // The picture covers the screen, centred. Covering crops the sides on tall phones, or the top and
  // bottom on wider screens: a little is fine, but where more would be cut (tablets, foldables) the
  // picture fits the height instead, whole, with black on its sides.
  const cover = Math.max(width / IMG_W, height / IMG_H);
  const cropY = height > 0 ? (IMG_H * cover - height) / 2 / cover : 0;
  const scale = cropY <= SAFE_CROP_Y ? cover : height / IMG_H;
  const offsetX = (width - IMG_W * scale) / 2;
  const offsetY = (height - IMG_H * scale) / 2;
  const y = (v: number) => offsetY + v * scale;
  const fit = (v: number) => Math.min(v * scale, width - SIDE * 2);

  const explore = () => {
    welcome.dismiss();
    router.replace('/');
  };
  const signIn = () => {
    welcome.dismiss();
    // The catalog stays behind the sign-in form: closing it lands there.
    router.replace('/');
    router.push('/sign-in');
  };

  const buttonHeight = Math.max(BUTTON.height * scale, touch.minSize);
  const headline = {
    fontSize: HEADLINE.size * scale,
    lineHeight: HEADLINE.line * scale,
  };
  return (
    <View
      style={styles.root}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      <StatusBar style="light" />
      <Image
        source={IMAGE}
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: IMG_W * scale,
          height: IMG_H * scale,
        }}
        contentFit="fill"
        accessibilityLabel="Three TAITIT frames on black podiums"
      />
      {width > 0 && (
        <>
          <View style={[styles.centered, { top: y(LOGO.top) }]}>
            <BrandLogo tone="white" width={fit(LOGO.width)} />
          </View>
          <View
            style={[
              styles.centered,
              { top: y(HEADLINE.top), width: fit(HEADLINE.width), left: (width - fit(HEADLINE.width)) / 2 },
            ]}
            accessibilityRole="header"
          >
            {['Your frames.', 'Your colors.'].map((line) => (
              <AppText
                key={line}
                style={[styles.headline, headline]}
                align="center"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.6}
              >
                {line}
              </AppText>
            ))}
          </View>
          <View style={[styles.centered, { top: y(BUTTON.top) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Explore the catalog"
              onPress={explore}
              style={({ pressed }) => [
                styles.button,
                { width: fit(BUTTON.width), height: buttonHeight },
                pressed && styles.buttonPressed,
              ]}
            >
              <AppText style={[styles.buttonText, { fontSize: Math.max(17, 40 * scale) }]}>
                Explore the catalog
              </AppText>
              <Icon name="arrow-forward" size={Math.max(20, 44 * scale)} color={colors.text} />
            </Pressable>
          </View>
          <View style={[styles.centered, { top: y(SIGN_IN.center) - touch.minSize / 2 }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in"
              onPress={signIn}
              hitSlop={8}
              style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
            >
              <AppText style={[styles.linkText, { fontSize: Math.max(16, SIGN_IN.size * scale) }]}>
                Sign in
              </AppText>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  centered: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  headline: { fontFamily: fonts.heading, color: WARM_WHITE },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: radius.pill,
    backgroundColor: CREAM,
    // The warm glow around the button in the design.
    borderWidth: 1.5,
    borderColor: 'rgba(255,196,140,0.75)',
    shadowColor: '#FFB26B',
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { fontFamily: fonts.headingMedium, color: colors.text },
  link: {
    minHeight: touch.minSize,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  linkPressed: { backgroundColor: 'rgba(255,255,255,0.16)' },
  linkText: { fontFamily: fonts.headingMedium, color: WARM_WHITE },
});
