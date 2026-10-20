import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { validateEmail } from '@/auth/validation';
import { AppText, Button, EmptyState, Screen, TextField } from '@/ui';

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (loading) return; // keyboard "done" can fire while a request is running
    const e = validateEmail(email);
    setError(e);
    setFormError(null);
    if (e) return;
    setLoading(true);
    const res = await sendPasswordReset(email);
    setLoading(false);
    if (res.error) setFormError(res.error);
    else setSent(true);
  };

  if (sent) {
    return (
      <Screen>
        <EmptyState
          icon="mail-unread-outline"
          title="Check your email"
          message="If an account exists for that email, we have sent a link to set a new password. Open it on this phone; if you request another one, use only the latest."
          actionLabel="Back to sign in"
          onAction={() => router.dismissTo('/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Reset password</AppText>
      <AppText variant="small">We will send you a link to set a new password.</AppText>
      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            setError(null);
          }}
          error={error}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          onSubmitEditing={submit}
        />
        {formError ? (
          <AppText variant="small" color={tokens.colors.danger} accessibilityLiveRegion="polite">
            {formError}
          </AppText>
        ) : null}
        <Button title="Send link" onPress={submit} loading={loading} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg, marginTop: tokens.spacing.md },
});
