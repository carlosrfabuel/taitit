import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { tokens } from '@taitit/shared';
import { useWelcome } from '@/lib/welcome';

// The start screen is the user's design itself (mvp/hero/d4.png, 2026-10-22; the "32 colors" line
// removed): logo, headline, frames, button and link are all part of the picture. The button and the
// link are made to work by touch areas laid exactly over where the picture draws them.
const IMAGE = require('../../assets/images/welcome.jpg');
const IMG_W = 941;
const IMG_H = 1672;
// Where the picture draws them, in its own pixels (x1, y1, x2, y2), measured from the image.
const EXPLORE = [88, 1382, 851, 1492] as const;
const SIGN_IN = [411, 1543, 532, 1590] as const;

const MIN_TOUCH = tokens.touch.minSize;
// Picture pixels that may be cropped off the top and the bottom: the logo starts ~60 px from the top
// and the link ends ~80 px from the bottom.
const SAFE_CROP_Y = 50;

// First screen for visitors who aren't signed in (first launch and after signing out).
export default function WelcomeScreen() {
  // The screen's own area (not the window: it may start below the status bar), measured on layout so
  // the picture and the touch areas share exactly the same box.
  const [{ width, height }, setSize] = useState({ width: 0, height: 0 });
  const welcome = useWelcome();

  // The picture covers the screen, centered. Covering crops the sides on tall phones, or the top and
  // bottom on wider screens: a little is fine (the logo and the link keep a margin), but where more
  // would be cut (tablets, foldables) the picture fits the height instead, whole, with the background
  // on its sides, so the button and the link are always on screen. Touch areas follow the same box.
  const cover = Math.max(width / IMG_W, height / IMG_H);
  const cropY = height > 0 ? (IMG_H * cover - height) / 2 / cover : 0;
  const scale = cropY <= SAFE_CROP_Y ? cover : height / IMG_H;
  const offsetX = (width - IMG_W * scale) / 2;
  const offsetY = (height - IMG_H * scale) / 2;
  const area = ([x1, y1, x2, y2]: readonly [number, number, number, number]) => {
    const w = (x2 - x1) * scale;
    const h = (y2 - y1) * scale;
    // At least the minimum touch size, grown around the drawn element's center.
    const tw = Math.max(w, MIN_TOUCH);
    const th = Math.max(h, MIN_TOUCH);
    return {
      left: offsetX + x1 * scale - (tw - w) / 2,
      top: offsetY + y1 * scale - (th - h) / 2,
      width: tw,
      height: th,
    };
  };

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

  const button = area(EXPLORE);
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
        accessibilityLabel="TAITIT. Your frames. Your colors. Three TAITIT frames on velvet podiums"
      />
      {width > 0 && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore the catalog"
            onPress={explore}
            style={({ pressed }) => [
              styles.area,
              button,
              { borderRadius: button.height / 2 },
              pressed && styles.pressedButton,
            ]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Sign in"
            onPress={signIn}
            style={({ pressed }) => [styles.area, area(SIGN_IN), styles.link, pressed && styles.pressed]}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B2017' },
  area: { position: 'absolute' },
  link: { borderRadius: 8 },
  // Touch feedback while pressed: a dark veil on the cream button, a light one on the link.
  pressedButton: { backgroundColor: 'rgba(20,48,31,0.16)' },
  pressed: { backgroundColor: 'rgba(255,255,255,0.18)' },
});
