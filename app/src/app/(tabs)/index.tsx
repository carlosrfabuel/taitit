import { Text } from 'react-native';
import { MAX_ZONES_PER_MODEL, tokens } from '@taitit/shared';
import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function CatalogScreen() {
  return (
    <Placeholder title="Catalog" note="Model list (Day 9).">
      {/* Confirms the shared package is wired in. */}
      <Text style={{ color: tokens.colors.muted }}>
        {`shared OK · max. ${MAX_ZONES_PER_MODEL} zones per model`}
      </Text>
      <NavLink href="/customize/demo" label="Open customizer (demo)" />
      <NavLink href="/sign-in" label="Sign in" />
    </Placeholder>
  );
}
