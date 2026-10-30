import { useState } from 'react';
import { X } from 'lucide-react';
import { addressLine } from '../lib/customers';
import { formatOrderDate } from '../lib/orders';
import { partSummary, type SparePartRow } from '../lib/spareParts';
import { PhotoViewer } from './PhotoViewer';

/**
 * One spare part request beside the list: the 3 photos in a row (each opens whole, over the page), the
 * part, the note and everything needed to contact the optician and send the part.
 */
export function SparePartPanel({
  request: r,
  photos,
  onClose,
}: {
  request: SparePartRow;
  /** The photo links: loading, ready, or failed to load (with a retry). */
  photos: { urls: Map<string, string> | undefined; loading: boolean; failed: boolean; retry: () => void };
  onClose: () => void;
}) {
  // The photo shown over the page (an index into the loaded ones), or none.
  const [viewing, setViewing] = useState<number | null>(null);
  const photoAlt = (i: number) => `Photo ${i + 1} of request ${r.number}`;
  const shown = r.photo_paths.flatMap((path, i) => {
    const url = photos.urls?.get(path);
    return url ? [{ path, url, alt: photoAlt(i) }] : [];
  });
  const address = addressLine(r.address, r.postal_code, r.city, r.province);
  const delivery = addressLine(
    r.delivery_address,
    r.delivery_postal_code,
    r.delivery_city,
    r.delivery_province,
  );
  const contact = [r.contact_email, r.contact_email !== r.customer_email ? r.customer_email : null].filter(
    Boolean,
  );

  return (
    <aside
      aria-label={`Spare part request #${r.number}`}
      className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col gap-5 overflow-y-auto rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl font-bold text-ink">Request #{r.number}</h2>
          <p className="text-sm text-muted">{formatOrderDate(r.created_at)}</p>
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

      <section className="flex flex-col gap-1">
        <h3 className="text-sm font-bold text-ink">{r.model_name}</h3>
        <p className="text-sm text-ink">{partSummary(r.part, r.side)}</p>
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-ink">Photos</h3>
        {/* Three tiles in a row, cropped to fill (any photo shape); a click shows the photo whole. */}
        <div className="grid grid-cols-3 gap-2">
          {r.photo_paths.map((path, i) => {
            const url = photos.urls?.get(path);
            return url ? (
              <button
                key={path}
                type="button"
                onClick={() => setViewing(shown.findIndex((p) => p.path === path))}
                className="block aspect-[3/4] overflow-hidden rounded-lg border border-line bg-bg hover:opacity-90"
                title="View larger"
              >
                <img src={url} alt={photoAlt(i)} className="size-full object-cover" />
              </button>
            ) : (
              <div
                key={path}
                className="flex aspect-[3/4] items-center justify-center rounded-lg border border-line bg-bg p-2 text-center text-xs text-muted"
              >
                {photos.loading ? 'Loading…' : photos.failed ? '—' : `Photo ${i + 1} not available`}
              </div>
            );
          })}
        </div>
        {photos.failed && shown.length < r.photo_paths.length && (
          <p className="flex items-center gap-2 text-xs text-muted">
            Couldn&apos;t load the photos.
            <button
              type="button"
              onClick={photos.retry}
              className="font-semibold text-ink underline hover:no-underline"
            >
              Try again
            </button>
          </p>
        )}
        <PhotoViewer photos={shown} index={viewing} onChange={setViewing} onClose={() => setViewing(null)} />
      </section>

      <section>
        <h3 className="mb-1.5 text-sm font-bold text-ink">Note</h3>
        <p className="rounded-lg bg-bg px-3 py-2 text-sm whitespace-pre-wrap text-ink">
          {r.note || 'No note.'}
        </p>
      </section>

      <section className="flex flex-col gap-0.5">
        <h3 className="mb-1 text-sm font-bold text-ink">Optician</h3>
        <p className="font-semibold text-ink">{r.business_name ?? r.customer_name ?? '—'}</p>
        {r.legal_name && r.legal_name !== r.business_name && (
          <p className="text-sm text-muted">{r.legal_name}</p>
        )}
        <p className="text-sm text-muted">{[r.customer_name, r.tax_id].filter(Boolean).join(' · ')}</p>
        {r.phone && (
          <p className="text-sm text-ink">
            <a href={`tel:${r.phone.replace(/\s+/g, '')}`} className="underline">
              {r.phone}
            </a>
          </p>
        )}
        {contact.map((email) => (
          <p key={email} className="text-sm text-ink">
            <a href={`mailto:${email}`} className="underline">
              {email}
            </a>
          </p>
        ))}
        {address && <p className="text-sm text-muted">{address}</p>}
        {delivery && delivery !== address && <p className="text-sm text-ink">Delivery: {delivery}</p>}
        {!r.user_id && <p className="mt-1 text-xs text-muted">This account has since been deleted.</p>}
      </section>
    </aside>
  );
}
