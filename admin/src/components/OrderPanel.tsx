import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FileSpreadsheet, ImageDown, X } from 'lucide-react';
import { Button, Swatch } from './ui';
import { OrderLineImage } from './OrderLineImage';
import {
  downloadOrderImages,
  downloadOrderSheet,
  formatOrderDate,
  framesLabel,
  type OrderRow,
} from '../lib/orders';
import { addressLine } from '../lib/customers';
import { textureUrl } from '../lib/swatches';
import { readMessage } from '../lib/errors';
import { FINISH_LABEL, swatchLabel } from '../lib/labels';

/**
 * One order beside the order list (the list stays in view): each frame with its image, colors per part
 * and quantity, the optician, notes and the downloads. "Open order sheet" goes to the full page
 * (printing, all the optician's details).
 */
export function OrderPanel({ order: o, onClose }: { order: OrderRow; onClose: () => void }) {
  const navigate = useNavigate();
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const several = o.order_lines.length > 1;

  const download = async (what: 'image' | 'sheet') => {
    setDownloadError(null);
    try {
      if (what === 'image') await downloadOrderImages(o);
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
          <p className="text-sm text-muted">
            {formatOrderDate(o.created_at)}
            {several ? ` · ${o.order_lines.length} different frames, ${framesLabel(o.quantity)}` : ''}
          </p>
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

      {o.order_lines.map((line) => (
        <section key={line.id} className="flex flex-col gap-3 rounded-xl border border-line p-4">
          <div className="flex min-h-24 items-center justify-center rounded-lg bg-bg p-2">
            <OrderLineImage
              line={line}
              alt={
                several ? `Design of order ${o.number}, frame ${line.line_no}` : `Design of order ${o.number}`
              }
            />
          </div>
          <h3 className="text-sm font-bold text-ink">
            {several ? `${line.line_no}. ` : ''}
            {line.model_name}
          </h3>
          <dl className="flex flex-col gap-2.5 text-sm">
            {line.order_items.map((i) => (
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
              <dd className="text-ink">{line.quantity}</dd>
            </div>
          </dl>
        </section>
      ))}

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
            disabled={!o.order_lines.some((l) => l.image_path)}
            onClick={() => void download('image')}
          >
            {several ? 'Download images' : 'Download image'}
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
