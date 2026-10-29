import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AuthScreen } from '@/auth/AuthScreen';
import { useAuth } from '@/auth/AuthProvider';
import { validateEmail } from '@/auth/validation';
import { AppText, Button, EmptyState, TextField, useDesktop } from '@/ui';

export default function ForgotPasswordScreen() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const desktop = useDesktop();

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
      <AuthScreen>
        <EmptyState
          icon="mail-unread-outline"
          title="Check your email"
          // The link works only where it was asked for (PKCE): this phone, or this browser on the web.
          message={`If an account exists for that email, we have sent a link to set a new password. Open it ${Platform.OS === 'web' ? 'in this browser' : 'on this phone'}; if you request another one, use only the latest.`}
          actionLabel="Back to sign in"
          onAction={() => router.dismissTo('/sign-in')}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen fill>
      <View style={[styles.intro, desktop && compact.intro]}>
        <AppText variant="title">Reset password</AppText>
        <AppText variant="small">We will send you a link to set a new password.</AppText>
      </View>
      <View style={[styles.form, desktop && compact.form]}>
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
      <View style={[styles.links, desktop && compact.links]}>
        <Button title="Back to sign in" variant="ghost" onPress={() => router.back()} />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: tokens.spacing.sm, paddingTop: tokens.spacing.lg, marginBottom: tokens.spacing.xxl },
  form: { gap: tokens.spacing.xl },
  links: { alignItems: 'center', marginTop: tokens.spacing.lg },
});

// Computer: the form sits in a compact card (AuthScreen), so tighter spacing.
const compact = StyleSheet.create({
  intro: { gap: tokens.spacing.xs, paddingTop: 0, marginBottom: tokens.spacing.sm },
  form: { gap: tokens.spacing.md },
  links: { marginTop: 0 },
});
