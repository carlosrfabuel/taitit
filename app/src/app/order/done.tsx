import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function OrderDoneScreen() {
  return (
    <Placeholder title="¡Pedido recibido!" note="Número de pedido y envío por WhatsApp (Día 17).">
      <NavLink href="/" label="Volver al catálogo" />
    </Placeholder>
  );
}
