import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function OrderSummaryScreen() {
  return (
    <Placeholder title="Resumen del pedido" note="Imagen, zonas, referencias y notas (Día 16).">
      <NavLink href="/order/done" label="Confirmar pedido" />
    </Placeholder>
  );
}
