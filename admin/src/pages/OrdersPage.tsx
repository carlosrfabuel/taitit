import { ORDER_STATUSES, ORDER_STATUS_LABEL } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';

export function OrdersPage() {
  return (
    <PageHeader title="Pedidos" note="Lista con filtro por estado (Día 19).">
      <div className="flex gap-2">
        {ORDER_STATUSES.map((s) => (
          <span key={s} className="rounded-full border border-line bg-surface px-3 py-1 text-sm">
            {ORDER_STATUS_LABEL[s]}
          </span>
        ))}
      </div>
    </PageHeader>
  );
}
