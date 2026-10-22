import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, ImageDown, X } from 'lucide-react';
import { Button, Spinner, Swatch } from './ui';
import {
  downloadOrderImage,
  downloadOrderSheet,
  formatOrderDate,
  isMissingFile,
  orderImageUrl,
  type OrderRow,
} from '../lib/orders';
import { addressLine } from '../lib/customers';
import { textureUrl } from '../lib/swatches';
import { readMessage } from '../lib/errors';
import { FINISH_LABEL, swatchLabel } from '../lib/labels';

/**
 * One order beside the order list (the list stays in view): image, colors per part, optician, notes
 * and the downloads. "Open order sheet" goes to the full page (printing, all the optician's details).
 */
export function OrderPanel({ order: o, onClose }: { order: OrderRow; onClose: () => void }) {
  const navigate = useNavigate();
  const image = useQuery({
    // Same key as the order page: the signed link is shared.
    queryKey: ['orders', o.id, 'image', o.image_path],
    queryFn: () => orderImageUrl(o.image_path!),
    enabled: !!o.image_path,
    staleTime: 30 * 60_000, // the link lasts an hour
    retry: (count, error) => !isMissingFile(error) && count < 2,
  });
  const imageGone = image.isError && isMissingFile(image.error);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const download = async (what: 'image' | 'sheet') => {
    setDownloadError(null);
    try {
      if (what === 'image') await downloadOrderImage(o);
      else downloadOrderSheet(o);
    } catch (e) {
      setDownloadError(`Couldn't download. ${readMessage(e as { message?: string })}`);
    }
  };

  const address = addressLine(o.address, o.postal_code, o.city, o.province);

  return (
    <aside
      aria-label={`Order #${o.number}`}
      className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col gap-5 overflow-y-auto rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink">Order #{o.number}</h2>
          <p className="text-sm text-muted">{formatOrderDate(o.created_at)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-ink"
          aria-label="Close"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>

      <div className="flex min-h-32 items-center justify-center rounded-xl bg-bg p-2">
        {image.data ? (
          <img src={image.data} alt={`Design of order ${o.number}`} className="h-auto w-full rounded-lg" />
        ) : imageGone ? (
          <p className="text-sm text-muted">The image for this order is no longer available.</p>
        ) : image.isError ? (
          <p className="text-sm text-danger">Couldn&apos;t load the image.</p>
        ) : o.image_path ? (
          <Spinner label="Loading image…" />
        ) : (
          <p className="text-sm text-muted">This order has no image.</p>
        )}
      </div>

      <section className="rounded-xl border border-line p-4">
        <h3 className="mb-3 text-sm font-bold text-ink">{o.model_name}</h3>
        <dl className="flex flex-col gap-2.5 text-sm">
          {o.order_items.map((i) => (
            <div key={`${i.sort_order}-${i.zone_name}`} className="flex items-center gap-3">
              <dt className="w-32 shrink-0 text-muted">{i.zone_name}</dt>
              <dd className="flex items-center gap-2 text-ink">
                <Swatch
                  hex={i.hex}
                  alpha={i.kind === 'translucent' ? i.alpha : null}
                  textureUrl={i.texture_path ? textureUrl(i) : null}
                  title={swatchLabel({ name: i.swatch_name, ref: i.ref })}
                  size={18}
                />
                {swatchLabel({ name: i.swatch_name, ref: i.ref })}
                {i.finish ? <span className="text-muted">· {FINISH_LABEL[i.finish]}</span> : null}
              </dd>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <dt className="w-32 shrink-0 text-muted">Quantity</dt>
            <dd className="text-ink">{o.quantity}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-bold text-ink">Optician</h3>
        <p className="font-semibold text-ink">{o.business_name ?? o.customer_name ?? '—'}</p>
        <p className="text-sm text-muted">
          {[o.customer_name, o.customer_email, o.phone].filter(Boolean).join(' · ')}
        </p>
        {address && <p className="text-sm text-muted">{address}</p>}
        {o.labeling && <p className="mt-1 text-sm text-ink">Name on the glasses: {o.labeling}</p>}
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-bold text-ink">Notes</h3>
        <p className="rounded-lg bg-bg px-3 py-2 text-sm whitespace-pre-wrap text-ink">
          {o.notes || 'No notes.'}
        </p>
      </section>

      {downloadError && (
        <p role="alert" className="text-sm text-danger">
          {downloadError}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button arrow onClick={() => navigate(`/orders/${o.id}`)}>
          Open order sheet
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<ImageDown className="size-4" aria-hidden />}
            disabled={!o.image_path || imageGone}
            onClick={() => void download('image')}
          >
            Download image
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="size-4" aria-hidden />}
            onClick={() => void download('sheet')}
          >
            Download Excel
          </Button>
        </div>
      </div>
    </aside>
  );
}
