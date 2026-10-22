import { publicUrl } from '../lib/images';
import type { ModelRow } from '../lib/models';

/** A model's catalog thumbnail (its base image if it has none yet), on a soft tile. */
export function ModelThumb({
  model,
  className = 'h-12 w-20',
}: {
  model: Pick<ModelRow, 'name' | 'thumb_path' | 'base_path'> | undefined;
  className?: string;
}) {
  const path = model?.thumb_path ?? model?.base_path;
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-lg bg-white ${className}`}>
      {path ? <img src={publicUrl(path)} alt="" loading="lazy" className="size-full object-contain" /> : null}
    </span>
  );
}
