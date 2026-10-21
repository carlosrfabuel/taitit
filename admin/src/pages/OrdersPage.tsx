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

  // Orders sent since this browser last opened the list are marked "Nuevo" during this visit; the list
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
      header: 'Nº',
      className: 'w-24',
      render: (o) => (
        <span className="flex flex-col items-start gap-1">
          <span className="font-bold text-ink">#{o.number}</span>
          {isNew(o) && <Tag tone="attention">Nuevo</Tag>}
        </span>
      ),
    },
    { key: 'date', header: 'Fecha', render: (o) => formatOrderDate(o.created_at) },
    {
      key: 'business',
      header: 'Óptica',
      render: (o) => (
        <div className="flex flex-col">
          <span className="font-semibold text-ink">{o.business_name ?? o.customer_name ?? '—'}</span>
          <span className="text-xs text-muted">{[o.city, o.customer_email].filter(Boolean).join(' · ')}</span>
        </div>
      ),
    },
    { key: 'model', header: 'Modelo', render: (o) => o.model_name },
    { key: 'colors', header: 'Colores', render: (o) => <OrderColors items={o.order_items} /> },
    { key: 'quantity', header: 'Cantidad', className: 'w-24', render: (o) => o.quantity },
  ];

  const filtered = query.trim() !== '' || period !== 'all';

  return (
    <>
      <PageHeader
        title="Pedidos"
        note="Pedidos enviados desde la app, del más reciente al más antiguo. Pulsa uno para ver la ficha y descargar la imagen y el Excel."
        actions={
          shown.length > 0 ? (
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" aria-hidden />}
              onClick={() => downloadOrdersSheet(shown)}
            >
              {filtered ? `Excel de estos ${shown.length}` : 'Excel de la lista'}
            </Button>
          ) : undefined
        }
      />
      {orders.isPending ? (
        <Spinner />
      ) : orders.isError && !orders.data ? (
        <EmptyState
          title="No se pudieron cargar los pedidos"
          message={readMessage(orders.error)}
          action={<Button onClick={() => void orders.refetch()}>Reintentar</Button>}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Receipt className="size-6" aria-hidden />}
          title="Todavía no hay pedidos"
          message="Los pedidos que envíen las ópticas desde la app aparecerán aquí."
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
                placeholder="Buscar nº, óptica, email, ciudad o modelo"
                aria-label="Buscar pedidos"
                className="pl-9"
              />
            </div>
            <div role="group" aria-label="Periodo" className="flex gap-2">
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
                {shown.length} de {rows.length}
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
                title="Ningún pedido coincide"
                message="Prueba con otra búsqueda u otro periodo."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setQuery('');
                      setPeriod('all');
                    }}
                  >
                    Ver todos
                  </Button>
                }
              />
            }
          />
          {rows.length === ORDERS_LIMIT && (
            <p className="mt-3 text-sm text-muted">
              Se muestran los {ORDERS_LIMIT} pedidos más recientes; la búsqueda y el Excel incluyen solo
              estos.
            </p>
          )}
        </>
      )}
    </>
  );
}
