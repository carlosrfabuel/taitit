import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUp } from 'lucide-react';
import { Button, Card } from '../ui';
import { IMAGE_RULES, checkBaseImage, publicUrl } from '../../lib/images';
import { modelKeys, setBaseImage, type ModelRow } from '../../lib/models';
import { dbMessage } from '../../lib/errors';

type InvalidFile = { code: 'invalid_file'; message: string };
const isInvalidFile = (e: unknown): e is InvalidFile => (e as InvalidFile)?.code === 'invalid_file';

export function BaseImageCard({ model }: { model: ModelRow }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const checked = await checkBaseImage(file);
      if ('error' in checked) throw { code: 'invalid_file', message: checked.error } satisfies InvalidFile;
      await setBaseImage(model, file, checked.size);
    },
    onMutate: () => setError(null),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: modelKeys.all }),
    onError: (e) => setError(isInvalidFile(e) ? e.message : dbMessage(e)),
  });

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">Base image</h2>
        <Button
          variant="secondary"
          size="sm"
          icon={<ImageUp className="size-4" aria-hidden />}
          loading={upload.isPending}
          onClick={() => input.current?.click()}
        >
          {model.base_path ? 'Replace image' : 'Upload image'}
        </Button>
      </div>
      <p className="text-sm text-muted">
        3/4 photo with the zones erased (made by the zone tool). JPG, PNG or WebP, up to{' '}
        {IMAGE_RULES.maxBytes / 1024 / 1024} MB, at least {IMAGE_RULES.minBaseWidth} px wide. The zone layers
        must have exactly the same size.
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
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept={IMAGE_RULES.baseTypes.join(',')}
        className="hidden"
        aria-label="Base image file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ''; // the same file can be picked again after an error
          if (file && !upload.isPending) upload.mutate(file);
        }}
      />
    </Card>
  );
}
