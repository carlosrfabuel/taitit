import { Stack, router } from 'expo-router';
import { EmptyState, Screen } from '@/ui';

// An address the app doesn't have (a mistyped or old link): our own page instead of the router's
// developer screen, which lists every page of the app.
export default function NotFoundScreen() {
  return (
    <Screen fill>
      <Stack.Screen options={{ title: 'Page not found' }} />
      <EmptyState
        icon="glasses-outline"
        title="Page not found"
        message="This page doesn't exist or has moved."
        actionLabel="Go to the catalog"
        onAction={() => router.replace('/')}
      />
    </Screen>
  );
}
