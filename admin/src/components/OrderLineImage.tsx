import { useQuery } from '@tanstack/react-query';
import { Spinner } from './ui';
import { isMissingFile, orderImageUrl, type OrderLineRow } from '../lib/orders';

/** A frame's private image: a temporary link (an hour), shared by every view of the same file. */
function useLineImage(line: OrderLineRow | undefined) {
  const path = line?.image_path ?? null;
  const image = useQuery({
    queryKey: ['orders', 'image', path],
    queryFn: () => orderImageUrl(path!),
    enabled: !!path,
    staleTime: 30 * 60_000, // the link lasts an hour
    retry: (count, error) => !isMissingFile(error) && count < 2,
  });
  // The file no longer exists (not a connection problem): said calmly, and nothing to download.
  return { ...image, gone: image.isError && isMissingFile(image.error) };
}

/** The design of one frame of an order, or why it can't be shown. */
export function OrderLineImage({ line, alt }: { line: OrderLineRow; alt: string }) {
  const image = useLineImage(line);
  if (image.data) return <img src={image.data} alt={alt} className="h-auto w-full rounded-lg" />;
  if (image.gone)
    return <p className="text-sm text-muted">The image for this frame is no longer available.</p>;
  if (image.isError)
    return (
      <p className="text-sm text-danger">
        Couldn&apos;t load the image.{' '}
        <button
          type="button"
          className="font-semibold underline print:hidden"
          onClick={() => void image.refetch()}
        >
          Try again
        </button>
      </p>
    );
  if (line.image_path) return <Spinner label="Loading image…" />;
  return <p className="text-sm text-muted">This frame has no image.</p>;
}
