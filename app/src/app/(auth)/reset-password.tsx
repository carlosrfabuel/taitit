import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AuthScreen } from '@/auth/AuthScreen';
import { useAuth } from '@/auth/AuthProvider';
import { linkErrorMessage } from '@/auth/messages';
import { validatePassword } from '@/auth/validation';
import { AppText, Button, EmptyState, Loader, TextField, useToast } from '@/ui';

// Opened from the password-reset email link: ?code=… is exchanged for a session first.
export default function ResetPasswordScreen() {
  const { code, error_description, error_code } = useLocalSearchParams<{
    code?: string;
    error_description?: string;
    error_code?: string;
  }>();
  const { exchangeCode, updatePassword } = useAuth();
  const toast = useToast();
  // Result per code: each code can be used once, and a newer link must still be handled.
  const [result, setResult] = useState<{ code: string; error: string | null } | null>(null);
  const started = useRef<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code || error_description || started.current === code) return;
    started.current = code;
    exchangeCode(code).then((res) => setResult({ code, error: res.error }));
  }, [code, error_description, exchangeCode]);

  // A code from the email link is required: without one, a signed-in user could change the
  // password without proving they own the email (e.g. someone holding an unlocked phone).
  const linkError =
    (error_description ? linkErrorMessage(error_code) : null) ??
    (!code
      ? 'Open the link from the email on this phone, or request a new one.'
      : result?.code === code
        ? result.error
        : null);
  const exchanging = !!code && !error_description && result?.code !== code;

  if (exchanging) return <Loader message="Checking link…" />;

  if (linkError) {
    return (
      <AuthScreen>
        <EmptyState
          icon="alert-circle-outline"
          title="Invalid link"
          message={linkError}
          actionLabel="Request a new link"
          onAction={() => router.replace('/forgot-password')}
        />
      </AuthScreen>
    );
  }

  const submit = async () => {
    if (loading) return; // keyboard "done" can fire while a request is running
    const e = validatePassword(password);
    setError(e);
    if (e) return;
    setLoading(true);
    const res = await updatePassword(password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    toast('Password updated', 'success');
    router.replace('/');
  };

  return (
    <AuthScreen>
      <AppText variant="title">New password</AppText>
      <View style={styles.form}>
        <TextField
          label="New password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          error={error}
          helper="At least 8 characters."
          revealable
          autoCapitalize="none"
          autoComplete="new-password"
        />
        <Button title="Save password" onPress={submit} loading={loading} fullWidth />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg, marginTop: tokens.spacing.md },
});
