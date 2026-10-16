import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { validatePassword } from '@/auth/validation';
import { AppText, Button, EmptyState, Loader, Screen, TextField, useToast } from '@/ui';

// Opened from the password-reset email link: ?code=… is exchanged for a session first.
export default function ResetPasswordScreen() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
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
    error_description ??
    (!code
      ? 'Abre el enlace del email desde este móvil o solicita uno nuevo.'
      : result?.code === code
        ? result.error
        : null);
  const exchanging = !!code && !error_description && result?.code !== code;

  if (exchanging) return <Loader message="Comprobando enlace…" />;

  if (linkError) {
    return (
      <Screen>
        <EmptyState
          icon="alert-circle-outline"
          title="Enlace no válido"
          message={linkError}
          actionLabel="Solicitar otro enlace"
          onAction={() => router.replace('/forgot-password')}
        />
      </Screen>
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
    toast('Contraseña actualizada', 'success');
    router.replace('/');
  };

  return (
    <Screen>
      <AppText variant="title">Nueva contraseña</AppText>
      <View style={styles.form}>
        <TextField
          label="Nueva contraseña"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            setError(null);
          }}
          error={error}
          helper="Mínimo 8 caracteres."
          revealable
          autoCapitalize="none"
          autoComplete="new-password"
        />
        <Button title="Guardar contraseña" onPress={submit} loading={loading} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg, marginTop: tokens.spacing.md },
});
