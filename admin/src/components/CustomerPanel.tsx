import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Mail, Phone, X } from 'lucide-react';
import { Spinner, Tag } from './ui';
import { ModelThumb } from './ModelThumb';
import { addressLine, STATUS_LABEL, type CustomerRow } from '../lib/customers';
import { formatOrderDate, listCustomerOrders, orderKeys } from '../lib/orders';
import { readMessage } from '../lib/errors';
import type { ModelRow } from '../lib/models';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });

/** Initials of the optician's business (or contact) name, for the round avatar. */
const customerInitials = (c: Pick<CustomerRow, 'business_name' | 'full_name' | 'email'>) => {
  const name = (c.business_name || c.full_name || c.email || '?').trim();
  const words = name.split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? '?') + (words[1]?.[0] ?? '')).toUpperCase();
};

export function Avatar({ customer, size = 'md' }: { customer: CustomerRow; size?: 'md' | 'lg' }) {
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-selected font-bold text-on-selected ${
        size === 'lg' ? 'size-14 text-lg' : 'size-9 text-sm'
      }`}
    >
      {customerInitials(customer)}
    </span>
  );
}

/**
 * One optician beside the customer list: contact, company details, addresses, and the orders they sent
 * (newest first; each opens its order sheet).
 */
export function CustomerPanel({
  customer: c,
  models,
  onClose,
}: {
  customer: CustomerRow;
  /** Catalog models by id (for the order thumbnails). */
  models: Map<string, ModelRow>;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  // All of this optician's orders, newest first.
  const ordersQuery = useQuery({
    queryKey: orderKeys.customer(c.id),
    queryFn: () => listCustomerOrders(c.id),
  });
  const orders = ordersQuery.data ?? [];
  const loaded = !!ordersQuery.data;
  const units = orders.reduce((n, o) => n + o.quantity, 0);
  const address = addressLine(c.address, c.postal_code, c.city, c.province);
  const delivery = addressLine(
    c.delivery_address,
    c.delivery_postal_code,
    c.delivery_city,
    c.delivery_province,
  );
  const commercial = addressLine(
    c.commercial_address,
    c.commercial_postal_code,
    c.commercial_city,
    c.commercial_province,
  );

  return (
    <aside
      aria-label={c.business_name || c.email || 'Customer'}
      className="sticky top-8 flex max-h-[calc(100vh-4rem)] flex-col gap-5 overflow-y-auto rounded-2xl border border-line bg-surface p-5"
    >
      <div className="flex items-start gap-4">
        <Avatar customer={c} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-2xl font-bold text-ink">
            {c.business_name || c.full_name || 'No company details'}
          </h2>
          <p className="text-sm text-muted">Customer since {formatDate(c.created_at)}</p>
          <div className="mt-1.5">
            <Tag
              tone={c.status === 'approved' ? 'success' : c.status === 'pending' ? 'attention' : 'neutral'}
            >
              {STATUS_LABEL[c.status]}
            </Tag>
          </div>
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

      <div className="flex flex-col gap-1.5 text-sm text-ink">
        {c.business_name && c.full_name && <p className="font-semibold">{c.full_name}</p>}
        {c.email && (
          <p className="flex items-center gap-2">
            <Mail className="size-4 text-muted" aria-hidden /> {c.email}
          </p>
        )}
        {c.contact_email && c.contact_email !== c.email && (
          <p className="flex items-center gap-2">
            <Mail className="size-4 text-muted" aria-hidden /> {c.contact_email}
            <span className="text-muted">(contact)</span>
          </p>
        )}
        {c.phone && (
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-muted" aria-hidden /> {c.phone}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Figure value={loaded ? orders.length : '…'} label={orders.length === 1 ? 'Order' : 'Orders'} />
        <Figure value={loaded ? units : '…'} label={units === 1 ? 'Unit' : 'Units'} />
        <Figure
          value={!loaded ? '…' : orders[0] ? formatDate(orders[0].created_at) : '—'}
          label="Last order"
        />
      </div>

      <dl className="flex flex-col gap-3 text-sm">
        <Field label="Company name" value={c.legal_name} />
        <Field label="VAT number" value={c.tax_id} />
        <Field label="Name on the glasses" value={c.labeling} />
        <Field label="Address" value={address} />
        <Field label="Delivery address" value={c.delivery_address ? delivery : null} />
        <Field label="Commercial address" value={c.commercial_address ? commercial : null} />
        <Field label="Bank account" value={c.bank_account} />
      </dl>

      <section>
        <h3 className="mb-2 text-sm font-bold text-ink">Orders</h3>
        {ordersQuery.isPending ? (
          <Spinner label="Loading orders…" />
        ) : ordersQuery.isError ? (
          <p className="text-sm text-danger">
            Couldn&apos;t load the orders. {readMessage(ordersQuery.error as { message?: string })}
          </p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-muted">No orders yet.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {orders.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-bg"
                >
                  <ModelThumb model={o.model_id ? models.get(o.model_id) : undefined} className="h-9 w-16" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold text-ink">#{o.number}</span>
                    <span className="truncate text-xs text-muted">
                      {o.model_name} · {formatOrderDate(o.created_at)}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

function Figure({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  );
}
