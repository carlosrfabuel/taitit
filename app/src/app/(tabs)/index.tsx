import { Text } from 'react-native';
import { MAX_ZONES_PER_MODEL, ORDER_STATUSES, ORDER_STATUS_LABEL, tokens } from '@taitit/shared';
import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function CatalogScreen() {
  const statuses = ORDER_STATUSES.map((s) => ORDER_STATUS_LABEL[s]).join(' → ');
  return (
    <Placeholder title="Catálogo" note="Lista de modelos (Día 9).">
      {/* Confirms the shared package is wired in. */}
      <Text style={{ color: tokens.colors.muted }}>
        {`shared OK · máx. ${MAX_ZONES_PER_MODEL} zonas · estados: ${statuses}`}
      </Text>
      <NavLink href="/customize/demo" label="Abrir personalizador (demo)" />
      <NavLink href="/sign-in" label="Iniciar sesión" />
    </Placeholder>
  );
}
