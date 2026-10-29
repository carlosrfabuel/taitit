import { X } from 'lucide-react';
import { addressLine } from '../lib/customers';
import { formatOrderDate } from '../lib/orders';
import { partSummary, type SparePartRow } from '../lib/spareParts';

/**
 * One spare part request beside the list: the 3 photos large (each opens full size), the part, the
 * note and everything needed to contact the optician and send the part.
 */
export function SparePartPanel({
  request: r,
  photoUrls,
  onClose,
}: {
  request: SparePartRow;
  photoUrls: Map<string, string> | undefined;
  onClose: () => void;
}) {
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
        {r.photo_paths.map((path, i) => {
          const url = photoUrls?.get(path);
          return url ? (
            <a
              key={path}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="block overflow-hidden rounded-lg border border-line bg-bg"
              title="Open full size"
            >
              <img
                src={url}
                alt={`Photo ${i + 1} of request ${r.number}`}
                className="max-h-80 w-full object-contain"
              />
            </a>
          ) : (
            <div
              key={path}
              className="flex h-24 items-center justify-center rounded-lg border border-line bg-bg"
            >
              <span className="text-xs text-muted">
                {photoUrls ? `Photo ${i + 1} not available` : 'Loading…'}
              </span>
            </div>
          );
        })}
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
