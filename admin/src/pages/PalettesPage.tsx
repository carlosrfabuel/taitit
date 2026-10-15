import { MATERIAL_LABEL } from '@taitit/shared';
import { PageHeader } from '../components/PageHeader';

export function PalettesPage() {
  return (
    <PageHeader
      title="Paletas"
      note={`${MATERIAL_LABEL.metal} y ${MATERIAL_LABEL.acetate}: colores, referencias, acabados y texturas (Día 8).`}
    />
  );
}
