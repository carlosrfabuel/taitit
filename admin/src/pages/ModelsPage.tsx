import { Link } from 'react-router';
import { MAX_ZONES_PER_MODEL } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';

export function ModelsPage() {
  return (
    <PageHeader title="Modelos" note="Lista, alta y edición de modelos (Días 6–7).">
      {/* Confirms the shared package is wired in. */}
      <p className="text-sm text-muted">shared OK · máximo {MAX_ZONES_PER_MODEL} zonas por modelo</p>
      <Link to="/models/demo" className="mt-4 inline-block font-semibold text-accent">
        Abrir modelo de prueba →
      </Link>
    </PageHeader>
  );
}
