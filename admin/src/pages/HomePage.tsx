import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Check, Glasses, Receipt, Users } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { OrderColors } from '../components/OrderColors';
import { Button, Card, Spinner } from '../components/ui';
import { customerKeys, listCustomers, setAccountStatus, type CustomerRow } from '../lib/customers';
import { filterOrders, formatOrderDate, listOrders, orderKeys, ordersSeenAt } from '../lib/orders';
import { listModels, modelKeys } from '../lib/models';
import { dbMessage, readMessage } from '../lib/errors';

const SHOWN = 5;

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// What waits for TAITIT: accounts to approve and the latest orders, with links to the full lists.
export function HomePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customers = useQuery({ queryKey: customerKeys.all, queryFn: listCustomers, refetchInterval: 60_000 });
  const orders = useQuery({ queryKey: orderKeys.all, queryFn: listOrders, refetchInterval: 60_000 });
  const models = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  const seen = useQuery({ queryKey: orderKeys.seen, queryFn: ordersSeenAt, staleTime: Infinity });

  const [error, setError] = useState<string | null>(null);
  const approve = useMutation({
    mutationFn: (id: string) => setAccountStatus(id, 'approved'),
    onMutate: () => setError(null),
    onError: (e) => setError(`Couldn't approve. ${dbMessage(e)}`),
    onSettled: () => queryClient.invalidateQueries({ queryKey: customerKeys.all }),
  });

  const pending = (customers.data ?? []).filter((c) => c.status === 'pending');
  const orderRows = orders.data ?? [];
  const seenAt = seen.data ?? null;
  const fresh = seenAt ? orderRows.filter((o) => o.created_at > seenAt).length : 0;
  const week = filterOrders(orderRows, '', 'week').length;
  const published = (models.data ?? []).filter((m) => m.published).length;
  const drafts = (models.data ?? []).length - published;

  const loadError = (q: { isError: boolean; data?: unknown; error: unknown }) =>
    q.isError && !q.data ? (
      <p className="text-sm text-danger">{readMessage(q.error as { message?: string })}</p>
    ) : null;

  return (
    <>
      <PageHeader title="Home" note="What needs your attention: accounts to approve and the latest orders." />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          to="/customers"
          icon={<Users className="size-5" aria-hidden />}
          label="Customers to approve"
          value={customers.data ? pending.length : '…'}
          attention={pending.length > 0}
        />
        <Stat
          to="/orders"
          icon={<Receipt className="size-5" aria-hidden />}
          label="New orders"
          value={orders.data ? fresh : '…'}
          note={seenAt ? 'since your last visit to Orders' : 'open Orders to start counting them'}
          attention={fresh > 0}
        />
        <Stat
          to="/orders"
          icon={<Receipt className="size-5" aria-hidden />}
          label="Orders in 7 days"
          value={orders.data ? week : '…'}
        />
        <Stat
          to="/models"
          icon={<Glasses className="size-5" aria-hidden />}
          label="Published models"
          value={models.data ? published : '…'}
          note={drafts > 0 ? `${drafts} ${drafts === 1 ? 'draft' : 'drafts'}` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <SectionTitle to="/customers" title="Customers to approve" />
          {error && (
            <p role="alert" className="mb-3 text-sm text-danger">
              {error}
            </p>
          )}
          {customers.isPending ? (
            <Spinner />
          ) : (
            (loadError(customers) ??
            (pending.length === 0 ? (
              <p className="text-sm text-muted">No pending accounts. New opticians will appear here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {pending.slice(0, SHOWN).map((c) => (
                  <PendingRow
                    key={c.id}
                    customer={c}
                    busy={approve.isPending && approve.variables === c.id}
                    disabled={approve.isPending}
                    onApprove={() => approve.mutate(c.id)}
                  />
                ))}
              </ul>
            )))
          )}
          {pending.length > SHOWN && (
            <p className="mt-3 text-sm text-muted">And {pending.length - SHOWN} more in Customers.</p>
          )}
        </Card>

        <Card>
          <SectionTitle to="/orders" title="Latest orders" />
          {orders.isPending ? (
            <Spinner />
          ) : (
            (loadError(orders) ??
            (orderRows.length === 0 ? (
              <p className="text-sm text-muted">No orders yet.</p>
            ) : (
              <ul className="divide-y divide-line">
                {orderRows.slice(0, SHOWN).map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`/orders/${o.id}`)}
                      className="flex w-full items-center gap-4 py-3 text-left hover:bg-bg"
                    >
                      <span className="w-14 font-bold text-ink">#{o.number}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-semibold text-ink">
                          {o.business_name ?? o.customer_name ?? '—'}
                        </span>
                        <span className="truncate text-xs text-muted">
                          {o.model_name} · {o.quantity} {o.quantity === 1 ? 'unit' : 'units'} ·{' '}
                          {formatOrderDate(o.created_at)}
                        </span>
                      </span>
                      <OrderColors items={o.order_items} />
                    </button>
                  </li>
                ))}
              </ul>
            )))
          )}
        </Card>
      </div>
    </>
  );
}

function Stat({
  to,
  icon,
  label,
  value,
  note,
  attention = false,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  value: number | string;
  note?: string;
  attention?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col gap-1 rounded-2xl border p-5 transition hover:shadow-sm ${
        attention ? 'border-highlight bg-highlight/40' : 'border-line bg-surface'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-muted">
        {icon}
        {label}
      </span>
      <span className="text-3xl font-extrabold text-ink">{value}</span>
      {note && <span className="text-xs text-muted">{note}</span>}
    </Link>
  );
}

function SectionTitle({ to, title }: { to: string; title: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      <Link
        to={to}
        className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
      >
        View all <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function PendingRow({
  customer: c,
  busy,
  disabled,
  onApprove,
}: {
  customer: CustomerRow;
  busy: boolean;
  disabled: boolean;
  onApprove: () => void;
}) {
  return (
    <li className="flex items-center gap-4 py-3">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-ink">
          {c.business_name || c.full_name || 'No company details'}
        </span>
        <span className="truncate text-xs text-muted">
          {[c.email, c.city, `signed up ${formatDate(c.created_at)}`].filter(Boolean).join(' · ')}
        </span>
      </span>
      <Button
        size="sm"
        icon={<Check className="size-4" aria-hidden />}
        loading={busy}
        disabled={disabled}
        onClick={onApprove}
        aria-label={`Approve: ${c.email ?? c.business_name ?? 'customer'}`}
      >
        Approve
      </Button>
    </li>
  );
}
