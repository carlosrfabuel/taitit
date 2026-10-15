import { useParams } from 'react-router';
import { PageHeader } from '../components/PageHeader';

export function OrderDetailPage() {
  const { id } = useParams();
  return <PageHeader title={`Pedido ${id}`} note="Imagen, ficha por zona, estado y descargas (Día 19)." />;
}
