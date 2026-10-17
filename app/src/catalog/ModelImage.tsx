import { Image } from 'expo-image';
import { RecolorView } from '@/render/RecolorView';
import type { CatalogModel } from './catalog';

/**
 * The model in its default colors: the admin's thumbnail when it is current (small JPEG, cached on
 * disk), otherwise a live render with the same recipe.
 */
export function ModelImage({
  model,
  width,
}: {
  model: Pick<CatalogModel, 'name' | 'plan' | 'thumbUrl'>;
  width: number;
}) {
  const height = (width * model.plan.height) / model.plan.width;
  if (model.thumbUrl)
    return (
      <Image
        source={{ uri: model.thumbUrl }}
        style={{ width, height }}
        contentFit="contain"
        cachePolicy="memory-disk"
        transition={150}
        accessibilityLabel={model.name}
      />
    );
  return <RecolorView plan={model.plan} width={width} />;
}
