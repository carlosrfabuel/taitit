import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { AppText, Button, Card, Icon, Screen, TextField, useToast } from '@/ui';

// Account deletion (App Store / Google Play requirement, Day 20). The password is asked again so an
// unlocked phone can't lose the account by a stray tap. What goes and what stays is said up front.
export default function DeleteAccountScreen() {
  const { session, deleteAccount } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!session) {
    return (
      <Screen>
        <AppText>You are not signed in.</AppText>
      </Screen>
    );
  }

  const confirm = async () => {
    if (busy) return;
    if (!password) return setError('Enter your password to confirm.');
    setBusy(true);
    setError(null);
    const result = await deleteAccount(password);
    setBusy(false);
    if (result.error) return setError(result.error);
    toast('Your account has been deleted', 'success');
    router.replace('/');
  };

  return (
    <Screen>
      <View style={styles.head}>
        <Icon name="warning-outline" size={36} color={tokens.colors.danger} />
        <AppText variant="heading">Delete your account?</AppText>
      </View>
      <Card style={styles.card}>
        <AppText variant="label">This deletes, for good:</AppText>
        <AppText>• your account ({session.user.email})</AppText>
        <AppText>• your business details</AppText>
        <AppText>• your saved designs</AppText>
        <AppText variant="label" style={styles.kept}>
          Orders and spare part requests you have already sent stay with TAITIT for their records, with your
          name and email.
        </AppText>
      </Card>
      <TextField
        label="Password"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          setError(null);
        }}
        error={error}
        revealable
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={confirm}
      />
      <Button title="Delete my account" variant="danger" fullWidth loading={busy} onPress={confirm} />
      <Button title="Cancel" variant="ghost" fullWidth disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { alignItems: 'center', gap: tokens.spacing.sm, marginBottom: tokens.spacing.md },
  card: { gap: tokens.spacing.xs },
  kept: { marginTop: tokens.spacing.sm, color: tokens.colors.muted },
});
