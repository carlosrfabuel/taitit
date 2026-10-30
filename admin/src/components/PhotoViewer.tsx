import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, X } from 'lucide-react';

type Props = {
  /** The photos in order: their links and alt texts. */
  photos: { url: string; alt: string }[];
  /** The photo shown, or null when closed. */
  index: number | null;
  onChange: (index: number) => void;
  onClose: () => void;
};

/**
 * A request's photos one at a time over the page, whole (not cropped) and as large as the window allows:
 * arrows or the keyboard's ← → go through them, Esc or a click beside the photo closes it.
 */
export function PhotoViewer({ photos, index, onChange, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const open = index !== null && !!photos[index];

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const photo = open ? photos[index] : null;
  const many = photos.length > 1;
  const go = (step: number) => {
    if (index !== null) onChange((index + step + photos.length) % photos.length);
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft') go(-1);
        if (e.key === 'ArrowRight') go(1);
      }}
      aria-label={photo?.alt ?? 'Photo'}
      className="m-0 h-dvh max-h-none w-dvw max-w-none bg-black/90 p-0 text-white backdrop:bg-black/60"
    >
      {photo && (
        // A click on the dark area (not the photo or the buttons) closes it.
        <div className="flex h-full flex-col" onClick={(e) => e.target === e.currentTarget && onClose()}>
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <span className="text-sm font-semibold">
              Photo {index! + 1} of {photos.length}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={photo.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm hover:bg-white/10"
              >
                <ExternalLink className="size-4" aria-hidden />
                Open original
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="rounded-lg p-1.5 hover:bg-white/10"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
          </div>
          <div
            className="flex min-h-0 flex-1 items-center justify-center gap-3 px-3 pb-6"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            {many && (
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous photo"
                className="shrink-0 rounded-full bg-white/10 p-2 hover:bg-white/20"
              >
                <ChevronLeft className="size-6" aria-hidden />
              </button>
            )}
            <img
              src={photo.url}
              alt={photo.alt}
              className="max-h-full min-w-0 max-w-full rounded-lg object-contain"
            />
            {many && (
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next photo"
                className="shrink-0 rounded-full bg-white/10 p-2 hover:bg-white/20"
              >
                <ChevronRight className="size-6" aria-hidden />
              </button>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
