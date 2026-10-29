import { router } from 'expo-router';
import { Card, EmptyState, Screen } from '@/ui';

/** What a guest sees on any spare parts page (the tab, or one opened by its address). */
export function SparePartsSignIn() {
  return (
    <Screen>
      <Card>
        <EmptyState
          icon="construct-outline"
          title="Spare parts"
          message="Sign in to request spare parts for your frames."
          actionLabel="Sign in"
          onAction={() => router.push('/sign-in')}
        />
      </Card>
    </Screen>
  );
}
