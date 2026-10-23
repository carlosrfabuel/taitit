import { publicUrl } from '../../lib/images';
import type { ModelRow } from '../../lib/models';
import { Card } from '../ui';

// The base image is made and uploaded with the zone tool (tools/zones), not here (2026-10-23): it shows
// what the model uses.
export function BaseImageCard({ model }: { model: ModelRow }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Base image</h2>
      </div>
      <p className="text-sm text-muted">
        3/4 photo with the zones erased, made from the product photo and uploaded with the zone tool.
      </p>
      {model.base_path ? (
        // A small thumbnail: with the zones erased it is mostly blank (the preview above shows the model).
        <figure className="flex items-center gap-4">
          {/* White frame on white: the light greys are darkened (shown only; the file is unchanged)
              so the outline can be recognised. Pure white stays white. */}
          <svg aria-hidden className="absolute size-0">
            <filter id="base-outline" colorInterpolationFilters="sRGB">
              <feComponentTransfer>
                <feFuncR type="gamma" exponent={10} />
                <feFuncG type="gamma" exponent={10} />
                <feFuncB type="gamma" exponent={10} />
              </feComponentTransfer>
            </filter>
          </svg>
          <span className="shrink-0 rounded-lg border border-line bg-surface p-1">
            <img
              src={publicUrl(model.base_path)}
              alt={`Base image of ${model.name}`}
              className="h-16 w-44 object-contain [filter:url(#base-outline)]"
            />
          </span>
          <figcaption className="text-xs text-muted">
            {model.base_width && model.base_height
              ? `${model.base_width} × ${model.base_height} px`
              : 'Unknown size: upload it again.'}
          </figcaption>
        </figure>
      ) : (
        <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-line text-sm text-muted">
          No base image
        </div>
      )}
    </Card>
  );
}
