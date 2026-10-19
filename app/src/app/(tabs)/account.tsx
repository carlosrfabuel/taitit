import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { AppText, Button, Card, EmptyState, Screen, useToast } from '@/ui';

export default function AccountScreen() {
  const { session, profile, signOut } = useAuth();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const devKit = __DEV__ ? (
    <Button
      title="UI kit (development only)"
      variant="ghost"
      icon="color-palette-outline"
      onPress={() => router.push('/dev/ui-kit')}
    />
  ) : null;

  const version = (
    <AppText variant="tiny" align="center">
      Version {Constants.expoConfig?.version ?? '—'}
    </AppText>
  );

  if (!session) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon="person-circle-outline"
            title="You are not signed in"
            message="Sign in to save your designs and place orders."
            actionLabel="Sign in"
            onAction={() => router.push('/sign-in')}
          />
        </Card>
        {devKit}
        {version}
      </Screen>
    );
  }

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    toast('Signed out');
  };

  return (
    <Screen>
      <Card>
        <View style={styles.row}>
          <AppText variant="tiny">NAME</AppText>
          <AppText variant="subheading">{profile?.full_name || '—'}</AppText>
        </View>
        <View style={styles.row}>
          <AppText variant="tiny">EMAIL</AppText>
          <AppText>{session.user.email}</AppText>
        </View>
      </Card>
      <Button
        title="Sign out"
        variant="secondary"
        icon="log-out-outline"
        onPress={onSignOut}
        loading={signingOut}
      />
      {/* Account deletion (store requirement) arrives on Day 20; the privacy policy link when the client sends its URL. */}
      {devKit}
      {version}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: tokens.spacing.xs, paddingVertical: tokens.spacing.sm },
});
