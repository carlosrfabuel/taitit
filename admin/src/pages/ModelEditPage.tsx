import { useParams } from 'react-router';
import { PageHeader } from '../components/PageHeader';

export function ModelEditPage() {
  const { id } = useParams();
  return (
    <PageHeader
      title={`Modelo: ${id}`}
      note="Imagen base, zonas, validación y vista previa del color (Días 7–8)."
    />
  );
}
