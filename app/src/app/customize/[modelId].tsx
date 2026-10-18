import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { tokens } from '@taitit/shared';
import { NavLink } from '@/components/NavLink';
import { AppText, EmptyState, Loader, Screen } from '@/ui';
import { useCatalog } from '@/catalog/useCatalog';
import { ModelImage } from '@/catalog/ModelImage';

// Entry point from the catalog. The customizer itself (zones, palettes, finishes) comes on Days 11–13.
export default function CustomizeScreen() {
  const { modelId } = useLocalSearchParams<{ modelId: string }>();
  const { width } = useWindowDimensions();
  const catalog = useCatalog();
  const model = catalog.data?.find((m) => m.id === modelId);

  if (catalog.isPending) return <Loader message="Loading model…" />;
  if (catalog.isError && !catalog.data)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load this model"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={() => void catalog.refetch()}
        />
      </Screen>
    );
  if (!model)
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Model not available"
          message="It may have been removed from the collection."
          actionLabel="Back to catalog"
          onAction={() => router.back()}
        />
      </Screen>
    );

  return (
    <Screen>
      <Stack.Screen options={{ title: model.name }} />
      <ModelImage model={model} width={width - tokens.spacing.xl * 2} />
      <View style={styles.info}>
        <AppText variant="title">{model.name}</AppText>
        {model.sizeRef ? <AppText variant="small">{model.sizeRef}</AppText> : null}
        {model.description ? <AppText>{model.description}</AppText> : null}
        <AppText variant="small">
          {model.zones.length} customizable {model.zones.length === 1 ? 'part' : 'parts'}:{' '}
          {model.zones.map((z) => z.name).join(', ')}. Customizer (Days 11–13).
        </AppText>
      </View>
      <NavLink href="/order/summary" label="Continue to summary" />
    </Screen>
  );
}

const styles = StyleSheet.create({ info: { gap: tokens.spacing.sm } });
