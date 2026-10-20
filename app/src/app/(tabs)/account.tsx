import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { canOrder, useAuth } from '@/auth/AuthProvider';
import { businessComplete } from '@/auth/business';
import { AppText, Badge, Button, Card, EmptyState, Screen, useToast } from '@/ui';

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
        <View style={styles.row}>
          <AppText variant="tiny">ACCOUNT</AppText>
          {profile ? (
            <Badge
              tone={canOrder(profile) ? 'selected' : profile.status === 'rejected' ? 'danger' : 'highlight'}
              icon={
                canOrder(profile)
                  ? 'checkmark-circle'
                  : profile.status === 'rejected'
                    ? 'close-circle-outline'
                    : 'time-outline'
              }
              label={
                profile.role === 'admin'
                  ? 'Administrator'
                  : profile.status === 'approved'
                    ? 'Approved: you can place orders'
                    : profile.status === 'rejected'
                      ? 'Not approved. Please contact TAITIT.'
                      : 'Waiting for approval by TAITIT. You can browse and save designs meanwhile.'
              }
              style={styles.status}
            />
          ) : (
            <AppText>—</AppText>
          )}
        </View>
      </Card>
      <Card>
        <View style={styles.row}>
          <AppText variant="tiny">BUSINESS</AppText>
          {profile?.business_name ? (
            <>
              <AppText variant="subheading">{profile.business_name}</AppText>
              <AppText variant="small">
                {[
                  profile.tax_id,
                  [profile.address, profile.postal_code, profile.city].filter(Boolean).join(', '),
                  profile.phone,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </AppText>
            </>
          ) : (
            <AppText color={tokens.colors.muted}>
              Not added yet. TAITIT needs them to process your orders.
            </AppText>
          )}
          {profile && !businessComplete(profile) && profile.business_name ? (
            <AppText variant="small" color={tokens.colors.danger}>
              Some required details are missing.
            </AppText>
          ) : null}
        </View>
        <Button
          title={profile?.business_name ? 'Edit business details' : 'Add business details'}
          variant="secondary"
          size="sm"
          icon="create-outline"
          onPress={() => router.push('/business')}
        />
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
  status: { marginTop: tokens.spacing.xs },
});
