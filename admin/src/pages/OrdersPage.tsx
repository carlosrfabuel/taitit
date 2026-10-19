import { useNavigate } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Receipt } from 'lucide-react';
import { PageHeader } from '../components/PageHeader';
import { Button, EmptyState, Spinner, Table, type Column } from '../components/ui';
import {
  downloadOrdersSheet,
  formatOrderDate,
  listOrders,
  orderKeys,
  ORDERS_LIMIT,
  type OrderRow,
} from '../lib/orders';
import { dbMessage } from '../lib/errors';

// Orders sent from the app, newest first. No status (client decision): an order is a fixed copy of
// what the optician sent.
export function OrdersPage() {
  const navigate = useNavigate();
  const orders = useQuery({ queryKey: orderKeys.all, queryFn: listOrders, refetchInterval: 60_000 });
  const rows = orders.data ?? [];

  const columns: Column<OrderRow>[] = [
    {
      key: 'number',
      header: 'Nº',
      className: 'w-20',
      render: (o) => <span className="font-bold text-ink">#{o.number}</span>,
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
    { key: 'parts', header: 'Piezas', className: 'w-20', render: (o) => o.order_items.length },
  ];

  return (
    <>
      <PageHeader
        title="Pedidos"
        note="Pedidos enviados desde la app, del más reciente al más antiguo. Pulsa uno para ver la ficha y descargar la imagen y el Excel."
        actions={
          rows.length > 0 ? (
            <Button
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" aria-hidden />}
              onClick={() => downloadOrdersSheet(rows)}
            >
              Excel de la lista
            </Button>
          ) : undefined
        }
      />
      {orders.isPending ? (
        <Spinner />
      ) : orders.isError ? (
        <EmptyState
          title="No se pudieron cargar los pedidos"
          message={dbMessage(orders.error)}
          action={<Button onClick={() => void orders.refetch()}>Reintentar</Button>}
        />
      ) : (
        <>
          <Table
            columns={columns}
            rows={rows}
            rowKey={(o) => o.id}
            onRowClick={(o) => navigate(`/orders/${o.id}`)}
            empty={
              <EmptyState
                icon={<Receipt className="size-6" aria-hidden />}
                title="Todavía no hay pedidos"
                message="Los pedidos que envíen las ópticas desde la app aparecerán aquí."
              />
            }
          />
          {rows.length === ORDERS_LIMIT && (
            <p className="mt-3 text-sm text-muted">Se muestran los {ORDERS_LIMIT} pedidos más recientes.</p>
          )}
        </>
      )}
    </>
  );
}
