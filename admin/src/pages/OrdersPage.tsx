import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Receipt, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { OrderColors } from '../components/OrderColors';
import { Button, EmptyState, Input, Spinner, Table, Tag, type Column } from '../components/ui';
import {
  downloadOrdersSheet,
  filterOrders,
  formatOrderDate,
  listOrders,
  markOrdersSeen,
  orderKeys,
  ordersSeenAt,
  ORDERS_LIMIT,
  PERIOD_LABEL,
  type OrderPeriod,
  type OrderRow,
} from '../lib/orders';
import { readMessage } from '../lib/errors';

const PERIODS: OrderPeriod[] = ['all', 'today', 'week', 'month'];

// Orders sent from the app, newest first. No status (client decision): an order is a fixed copy of
// what the optician sent. Search and period narrow the list (and its Excel).
export function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: orderKeys.all, queryFn: listOrders, refetchInterval: 60_000 });
  const rows = orders.data ?? [];
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<OrderPeriod>('all');
  const shown = filterOrders(rows, query, period);

  // Orders sent since this browser last opened the list are marked "New" during this visit; the list
  // then counts as seen (the sidebar badge clears).
  const [seenBefore] = useState(ordersSeenAt);
  const newest = rows[0]?.created_at;
  useEffect(() => {
    if (!newest || (seenBefore && newest <= seenBefore)) return;
    markOrdersSeen(newest);
    queryClient.setQueryData(orderKeys.seen, newest);
  }, [newest, seenBefore, queryClient]);
  const isNew = (o: OrderRow) => !!seenBefore && o.created_at > seenBefore;

  const columns: Column<OrderRow>[] = [
    {
      key: 'number',
      header: 'No.',
      className: 'w-24',
      render: (o) => (
        <span className="flex flex-col items-start gap-1">
          <span className="font-bold text-ink">#{o.number}</span>
          {isNew(o) && <Tag tone="attention">New</Tag>}
        </span>
      ),
    },
    { key: 'date', header: 'Date', render: (o) => formatOrderDate(o.created_at) },
    {
      key: 'business',
      header: 'Optician',
      render: (o) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{o.business_name ?? o.customer_name ?? '—'}</span>
          <span className="text-xs text-muted">{[o.city, o.customer_email].filter(Boolean).join(' · ')}</span>
        </div>
      ),
    },
    { key: 'model', header: 'Model', render: (o) => o.model_name },
    { key: 'colors', header: 'Colors', render: (o) => <OrderColors items={o.order_items} /> },
    { key: 'quantity', header: 'Quantity', className: 'w-24', render: (o) => o.quantity },
  ];

  const filtered = query.trim() !== '' || period !== 'all';

  return (
    <>
      <PageHeader
        title="Orders"
        note="Orders sent from the app, newest first. Click one to see its order sheet and download the image and the Excel."
        actions={
          shown.length > 0 ? (
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" aria-hidden />}
              onClick={() => downloadOrdersSheet(shown)}
            >
              {filtered
                ? `Excel for ${shown.length === 1 ? 'this order' : `these ${shown.length}`}`
                : 'Excel for the list'}
            </Button>
          ) : undefined
        }
      />
      {orders.isPending ? (
        <Spinner />
      ) : orders.isError && !orders.data ? (
        <EmptyState
          title="Couldn't load the orders"
          message={readMessage(orders.error)}
          action={<Button onClick={() => void orders.refetch()}>Try again</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" aria-hidden />}
          title="No orders yet"
          message="Orders that opticians send from the app will appear here."
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search no., optician, email, city or model"
                aria-label="Search orders"
                className="pl-9"
              />
            </div>
            <div role="group" aria-label="Period" className="flex gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={period === p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
                    period === p
                      ? 'border border-selected-line bg-selected text-on-selected'
                      : 'border border-line bg-surface text-ink hover:bg-bg'
                  }`}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
            {filtered && (
              <span className="text-sm text-muted">
                {shown.length} of {rows.length}
              </span>
            )}
          </div>
          <Table
            columns={columns}
            rows={shown}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`/orders/${o.id}`)}
            empty={
              <EmptyState
                icon={<Search className="size-6" aria-hidden />}
                title="No orders match"
                message="Try another search or period."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('');
                      setPeriod('all');
                    }}
                  >
                    View all
                  </Button>
                }
              />
            }
          />
          {rows.length === ORDERS_LIMIT && (
            <p className="mt-3 text-sm text-muted">
              Showing the {ORDERS_LIMIT} most recent orders; the search and the Excel include only these.
            </p>
          )}
        </>
      )}
    </>
  );
}
