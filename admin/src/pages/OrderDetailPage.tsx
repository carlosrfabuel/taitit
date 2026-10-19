import { useParams } from 'react-router';
import { PageHeader } from '../components/PageHeader';

export function OrderDetailPage() {
  const { id } = useParams();
  return (
    <PageHeader
      title={`Pedido ${id}`}
      note="Próximamente: imagen del diseño, ficha por zona, notas y descargas."
    />
  );
}
