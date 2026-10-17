import { useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import {
  Canvas,
  ColorMatrix,
  Fill,
  Group,
  Image,
  LinearGradient,
  Paint,
  Rect,
  useImage,
  vec,
  type SkImage,
} from '@shopify/react-native-skia';
import { GLOSS_STOPS, type RenderLayer, type RenderPlan } from '@taitit/shared';

// Skia implementation of the shared recolor recipe (shared/src/render.ts). The admin preview and
// the tools/zones preview use the same steps: fill → multiply shading → screen gloss → clip to the
// layer shape → draw with the swatch opacity.

/** Forces alpha to 1 (the layer's gray shading stays): multiply then uses the shading only. */
const OPAQUE = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1];

type Size = { width: number; height: number };

function Zone({
  layer,
  image,
  texture,
  size,
}: {
  layer: RenderLayer;
  image: SkImage;
  texture: SkImage | null;
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
      {texture ? (
        <Image image={texture} x={0} y={0} width={w} height={h} fit="cover" />
      ) : (
        <Fill color={layer.hex} />
      )}
      <Image image={image} x={0} y={0} width={w} height={h} fit="fill" blendMode="multiply">
        <ColorMatrix matrix={OPAQUE} />
      </Image>
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

/** Loads one zone's images; renders nothing until they are ready (no half-recolored frame). */
function ZoneLoader({ layer, size }: { layer: RenderLayer; size: Size }) {
  const image = useImage(layer.layerUrl);
  const texture = useImage(layer.textureUrl ?? undefined);
  if (!image || (layer.textureUrl && !texture)) return null;
  return <Zone layer={layer} image={image} texture={texture} size={size} />;
}

/** The model photo recolored per the plan, scaled to `width` (height keeps the photo's proportions). */
export function RecolorView({ plan, width, style }: { plan: RenderPlan; width: number; style?: ViewStyle }) {
  const base = useImage(plan.baseUrl);
  const size = { width, height: (width * plan.height) / plan.width };
  return (
    <View style={[size, style]}>
      {base && (
        <Canvas style={size}>
          <Image image={base} x={0} y={0} width={size.width} height={size.height} fit="fill" />
          {plan.layers.map((l) => (
            <ZoneLoader key={l.zoneId} layer={l} size={size} />
          ))}
        </Canvas>
      )}
    </View>
  );
}
