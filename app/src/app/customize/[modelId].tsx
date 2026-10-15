import { useLocalSearchParams } from 'expo-router';
import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function CustomizeScreen() {
  const { modelId } = useLocalSearchParams<{ modelId: string }>();
  return (
    <Placeholder title="Personalizador" note={`Modelo: ${modelId}. Zonas, paletas y acabados (Días 11–13).`}>
      <NavLink href="/order/summary" label="Continuar al resumen" />
    </Placeholder>
  );
}
