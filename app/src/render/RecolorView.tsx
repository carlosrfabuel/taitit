import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import {
  Canvas,
  ColorMatrix,
  Fill,
  Group,
  Image,
  ImageFormat,
  LinearGradient,
  Paint,
  Rect,
  Skia,
  drawAsImage,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import {
  GLOSS_STOPS,
  SHADE_GAIN,
  SHADE_TOP,
  tokens,
  type RenderLayer,
  type RenderPlan,
} from '@taitit/shared';
import { AppText } from '@/ui/AppText';
import { Icon } from '@/ui/Icon';

// Skia implementation of the shared recolor recipe (shared/src/render.ts). The admin preview and
// the tools/zones preview use the same steps: fill → multiply shading → screen highlight → screen
// gloss → clip to the layer shape → draw with the swatch opacity. A havana with a tortoiseshell pattern
// fills with the pattern through its color matrix instead of fill + shading + highlight (the pattern
// holds the photo's light).

/** The layer's gray shading × SHADE_GAIN (Skia caps at 1) with alpha forced to 1: multiply then uses
 * the shading only, and the color shows as itself at the zone's typical brightness. */
const SHADE = [SHADE_GAIN, 0, 0, 0, 0, 0, SHADE_GAIN, 0, 0, 0, 0, 0, SHADE_GAIN, 0, 0, 0, 0, 0, 0, 1];

/** The layer's highlight, highlightOf(gray) = (gray − SHADE_TOP) / (1 − SHADE_TOP) (Skia clamps to
 * 0..1), opaque: screen then takes the color that far toward white. */
const HL = 1 / (1 - SHADE_TOP);
const HL_OFFSET = -SHADE_TOP * HL;
const HIGHLIGHT = [HL, 0, 0, 0, HL_OFFSET, HL, 0, 0, 0, HL_OFFSET, HL, 0, 0, 0, HL_OFFSET, 0, 0, 0, 0, 1];

// TEMPORARY (Safari test, 2026-10-28): `?renderer=static` draws with Skia's off-screen renderer, to
// compare both on a real Mac. Remove once the web renderer is chosen.
const STATIC_RENDERER =
  Platform.OS === 'web' &&
  typeof window !== 'undefined' &&
  window.location.search.includes('renderer=static');

type Size = { width: number; height: number };
type Loaded = {
  base: SkImage;
  layers: SkImage[];
  textures: (SkImage | null)[];
  patterns: (SkImage | null)[];
};

async function loadImage(url: string): Promise<SkImage> {
  const image = Skia.Image.MakeImageFromEncoded(await Skia.Data.fromURI(url));
  if (!image) throw new Error(`Could not decode ${url}`);
  return image;
}

// Decoded images shared by every RecolorView (catalog cards, customizer): picking a color only loads
// what is new. Small and most-recently-used, because full-size images are large in memory.
const MAX_CACHED = 16;
const cache = new Map<string, Promise<SkImage>>();
function cachedImage(url: string): Promise<SkImage> {
  let p = cache.get(url);
  if (p) {
    cache.delete(url); // mark as recently used
  } else {
    p = loadImage(url);
    const mine = p;
    p.catch(() => cache.get(url) === mine && cache.delete(url)); // failed loads are retried later
  }
  cache.set(url, p);
  while (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value!);
  return p;
}

type Shown = { key: string; plan: RenderPlan; loaded: Loaded };

/**
 * Every image of the plan, loaded together: nothing new is drawn until all are ready (no
 * half-recolored frame), and meanwhile the previous complete picture stays (no flicker). A texture or
 * pattern that fails falls back to its plain color, like the admin preview; a failed base or layer image is
 * retried once, then reported (a wrong picture is worse than none).
 */
function usePlanImages(plan: RenderPlan): { shown: Shown | null; failed: boolean; retry: () => void } {
  const key = JSON.stringify([
    plan.baseUrl,
    plan.layers.map((l) => [l.layerUrl, l.textureUrl, l.patternUrl]),
  ]);
  const planJson = JSON.stringify(plan);
  const [shown, setShown] = useState<Shown | null>(null);
  const [failure, setFailure] = useState<{ key: string; attempts: number } | null>(null);
  const attempts = failure?.key === key ? failure.attempts : 0;
  useEffect(() => {
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const p = JSON.parse(planJson) as RenderPlan;
    Promise.all([
      cachedImage(p.baseUrl),
      Promise.all(p.layers.map((l) => cachedImage(l.layerUrl))),
      Promise.all(p.layers.map((l) => (l.textureUrl ? cachedImage(l.textureUrl).catch(() => null) : null))),
      Promise.all(p.layers.map((l) => (l.patternUrl ? cachedImage(l.patternUrl).catch(() => null) : null))),
    ]).then(
      // Images and the plan they were loaded for stay together (same layers, same order).
      ([base, layers, textures, patterns]) =>
        !cancelled && setShown({ key, plan: p, loaded: { base, layers, textures, patterns } }),
      () => {
        if (cancelled) return;
        if (attempts === 0)
          retry = setTimeout(() => setFailure({ key, attempts: 1 }), 3000); // one retry
        else setFailure({ key, attempts: 2 });
      },
    );
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
    // Re-runs on any plan change: color-only changes resolve at once from the image cache.
  }, [key, planJson, attempts]);
  return {
    shown,
    failed: attempts >= 2 && shown?.key !== key,
    // Manual retry (e.g. after the connection is back): starts the attempts again.
    retry: () => setFailure({ key, attempts: 0 }),
  };
}

function Zone({
  layer,
  image,
  texture,
  pattern,
  size,
}: {
  layer: RenderLayer;
  image: SkImage;
  texture: SkImage | null;
  pattern: SkImage | null;
  size: Size;
}) {
  const { width: w, height: h } = size;
  // Gloss band as a vertical gradient (gray amount → screen); outside the band it is black = no change.
  const gloss = useMemo(
    () => ({
      start: vec(0, GLOSS_STOPS[0]![0] * h),
      end: vec(0, GLOSS_STOPS[GLOSS_STOPS.length - 1]![0] * h),
      colors: GLOSS_STOPS.map(([, amount]) => {
        const v = Math.round(amount * 255);
        return `rgb(${v},${v},${v})`;
      }),
      positions: GLOSS_STOPS.map((_, i) => i / (GLOSS_STOPS.length - 1)),
    }),
    [h],
  );
  return (
    // Own layer per zone; the opacity is the layer paint's, so it applies once to the finished zone
    // (translucent acetate), not to each step inside it.
    <Group layer={<Paint opacity={layer.opacity} />}>
      {pattern && layer.patternMatrix ? (
        // The tortoiseshell pattern already holds the photo's light and shadow: no shading step.
        <Image image={pattern} x={0} y={0} width={w} height={h} fit="fill">
          <ColorMatrix matrix={layer.patternMatrix} />
        </Image>
      ) : (
        <>
          {texture ? (
            <Image image={texture} x={0} y={0} width={w} height={h} fit="cover" />
          ) : (
            <Fill color={layer.hex} />
          )}
          <Image image={image} x={0} y={0} width={w} height={h} fit="fill" blendMode="multiply">
            <ColorMatrix matrix={SHADE} />
          </Image>
          <Image image={image} x={0} y={0} width={w} height={h} fit="fill" blendMode="screen">
            <ColorMatrix matrix={HIGHLIGHT} />
          </Image>
        </>
      )}
      {layer.gloss && (
        <Rect x={0} y={0} width={w} height={h} blendMode="screen">
          <LinearGradient
            start={gloss.start}
            end={gloss.end}
            colors={gloss.colors}
            positions={gloss.positions}
          />
        </Rect>
      )}
      <Image image={image} x={0} y={0} width={w} height={h} fit="fill" blendMode="dstIn" />
    </Group>
  );
}

/** The whole picture: base photo, then each zone. Shared by the screen view and the order image. */
function Scene({ plan, loaded, size }: { plan: RenderPlan; loaded: Loaded; size: Size }) {
  return (
    <>
      <Image image={loaded.base} x={0} y={0} width={size.width} height={size.height} fit="fill" />
      {plan.layers.map((l, i) => (
        <Zone
          key={l.zoneId}
          layer={l}
          image={loaded.layers[i]!}
          texture={loaded.textures[i] ?? null}
          pattern={loaded.patterns[i] ?? null}
          size={size}
        />
      ))}
    </>
  );
}

/**
 * The design drawn off-screen at `width` px and encoded as JPEG (the order image). Stricter than the
 * screen view: every image must load, tortoiseshell textures and patterns included, because an order must show
 * exactly what was chosen. Throws otherwise.
 */
export async function renderPlanToJpeg(plan: RenderPlan, width: number, quality = 90): Promise<Uint8Array> {
  const size = { width, height: Math.round((width * plan.height) / plan.width) };
  const [base, layers, textures, patterns] = await Promise.all([
    cachedImage(plan.baseUrl),
    Promise.all(plan.layers.map((l) => cachedImage(l.layerUrl))),
    Promise.all(plan.layers.map((l) => (l.textureUrl ? cachedImage(l.textureUrl) : null))),
    Promise.all(plan.layers.map((l) => (l.patternUrl ? cachedImage(l.patternUrl) : null))),
  ]);
  const image = await drawAsImage(
    <>
      {/* JPEG has no transparency: a white page behind the photo. */}
      <Fill color="#FFFFFF" />
      <Scene plan={plan} loaded={{ base, layers, textures, patterns }} size={size} />
    </>,
    size,
  ).catch(() => null);
  if (!image) throw new Error('snapshot_failed');
  try {
    return image.encodeToBytes(ImageFormat.JPEG, quality);
  } finally {
    image.dispose(); // full-size pixels: release now, not at the next garbage collection
  }
}

/** The model photo recolored per the plan, scaled to `width` (height keeps the photo's proportions). */
export function RecolorView({ plan, width, style }: { plan: RenderPlan; width: number; style?: ViewStyle }) {
  const size = { width, height: (width * plan.height) / plan.width };
  const { shown, failed, retry } = usePlanImages(plan);
  // After a failure nothing is drawn: an older picture would show colors that are not the current ones.
  const loaded = failed ? undefined : shown?.loaded;
  // The plan the loaded images belong to; while newer images load, this previous picture stays.
  const drawn = shown?.plan ?? plan;
  return (
    <View
      style={[
        size,
        !loaded && { backgroundColor: tokens.colors.border, borderRadius: tokens.radius.md },
        style,
      ]}
      accessibilityRole={failed ? undefined : 'image'}
    >
      {failed && (
        <Pressable
          onPress={retry}
          accessibilityRole="button"
          accessibilityLabel="Image could not be loaded. Tap to retry."
          style={styles.failed}
        >
          <Icon name="refresh-outline" color={tokens.colors.muted} />
          <AppText variant="small">{"Couldn't load the image. Tap to retry."}</AppText>
        </Pressable>
      )}
      {loaded && (
        <Canvas style={size} __destroyWebGLContextAfterRender={STATIC_RENDERER}>
          <Scene plan={drawn} loaded={loaded} size={size} />
        </Canvas>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  failed: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.xs,
  },
});
