import { useLocalSearchParams } from 'expo-router';
import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function CustomizeScreen() {
  const { modelId } = useLocalSearchParams<{ modelId: string }>();
  return (
    <Placeholder title="Customizer" note={`Model: ${modelId}. Zones, palettes and finishes (Days 11–13).`}>
      <NavLink href="/order/summary" label="Continue to summary" />
    </Placeholder>
  );
}
