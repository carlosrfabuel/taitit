import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Receipt, Search } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { OrderLinesColors } from '../components/OrderColors';
import { OrderPanel } from '../components/OrderPanel';
import { ModelThumb } from '../components/ModelThumb';
import { listModels, modelKeys } from '../lib/models';
import { Button, EmptyState, Input, Spinner, Table, Tag, type Column } from '../components/ui';
import {
  downloadOrdersSheet,
  filterOrders,
  orderDayAndTime,
  orderImageUrls,
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
// what the optician sent. Search and period narrow the list (and its Excel). Clicking a row shows the order
// in a panel beside the list; the panel opens the full order sheet.
export function OrdersPage() {
  const queryClient = useQueryClient();
  const orders = useQuery({ queryKey: orderKeys.all, queryFn: listOrders, refetchInterval: 60_000 });
  const rows = orders.data ?? [];
  const [query, setQuery] = useState('');
  const [period, setPeriod] = useState<OrderPeriod>('all');
  const shown = filterOrders(rows, query, period);
  const models = useQuery({ queryKey: modelKeys.all, queryFn: listModels });
  // By id, not name: a renamed model keeps its orders' pictures, a new one reusing a name gets none.
  const byId = new Map((models.data ?? []).map((m) => [m.id, m]));
  // The design each optician ordered (private images): links for every listed order in one request.
  const imagePaths = rows.map((o) => o.order_lines[0]?.image_path).filter((p): p is string => !!p);
  const images = useQuery({
    queryKey: ['orders', 'images', imagePaths],
    queryFn: () => orderImageUrls(imagePaths),
    enabled: imagePaths.length > 0,
    staleTime: 30 * 60_000, // the links last an hour
  });
  // The order in the panel: the one clicked, else the first one shown; none once the panel is closed.
  const [picked, setPicked] = useState<string | null>(null);
  const [panelClosed, setPanelClosed] = useState(false);
  const selected = panelClosed ? null : (shown.find((o) => o.id === picked) ?? shown[0] ?? null);
  // The order in the panel stays there when the list refreshes (a new order doesn't replace it).
  // (Adjusted during render, React's pattern for state that follows other values.)
  if (selected && selected.id !== picked) setPicked(selected.id);

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
    {
      key: 'date',
      header: 'Date',
      render: (o) => {
        const { day, time } = orderDayAndTime(o.created_at);
        return (
          <span className="flex flex-col whitespace-nowrap">
            <span>{day}</span>
            <span className="text-xs text-muted">{time}</span>
          </span>
        );
      },
    },
    {
      key: 'business',
      header: 'Optician',
      render: (o) => (
        <div className="flex max-w-56 flex-col">
          <span className="font-semibold text-ink">{o.business_name ?? o.customer_name ?? '—'}</span>
          <span className="truncate text-xs text-muted" title={o.customer_email ?? undefined}>
            {[o.city, o.customer_email].filter(Boolean).join(' · ')}
          </span>
        </div>
      ),
    },
    {
      key: 'model',
      header: 'Model',
      render: (o) => (
        <span className="flex items-center gap-3">
          <ModelThumb model={o.model_id ? byId.get(o.model_id) : undefined} className="h-9 w-16" />
          <span className="flex min-w-0 flex-col">
            <span className="max-w-48 truncate" title={o.model_name}>
              {o.model_name}
            </span>
            {o.order_lines.length > 1 && (
              <span className="text-xs text-muted">{o.order_lines.length} different frames</span>
            )}
          </span>
        </span>
      ),
    },
    {
      key: 'design',
      header: 'Design',
      render: (o) => {
        // The first frame's design; with several frames, how many more there are.
        const first = o.order_lines[0]?.image_path ?? null;
        const url = first ? images.data?.get(first) : undefined;
        const more = o.order_lines.length - 1;
        return (
          <span className="relative inline-flex h-9 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-white">
            {more > 0 && (
              <span className="absolute right-0.5 bottom-0.5 z-10 rounded-full bg-ink px-1.5 text-[10px] font-bold text-white">
                +{more}
              </span>
            )}
            {url ? (
              <img
                src={url}
                alt={`Design of order ${o.number}`}
                loading="lazy"
                className="size-full object-contain"
              />
            ) : first && images.isPending ? null : (
              <span className="text-[10px] leading-tight text-muted">No image</span>
            )}
          </span>
        );
      },
    },
    { key: 'colors', header: 'Colors', render: (o) => <OrderLinesColors order={o} /> },
    { key: 'quantity', header: 'Frames', className: 'w-24', render: (o) => o.quantity },
  ];

  const filtered = query.trim() !== '' || period !== 'all';

  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Orders' }]}
        title="Orders"
        note="Orders sent from the app, newest first. Click one to see it beside the list."
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
          <div
            className={
              selected
                ? 'grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_380px]'
                : ''
            }
          >
            <div className="min-w-0">
              <Table
                columns={columns}
                rows={shown}
                rowKey={(o) => o.id}
                selectedKey={selected?.id ?? null}
                onRowClick={(o) => {
                  setPicked(o.id);
                  setPanelClosed(false);
                }}
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
            </div>
            {selected && (
              <OrderPanel key={selected.id} order={selected} onClose={() => setPanelClosed(true)} />
            )}
          </div>
        </>
      )}
    </>
  );
}
