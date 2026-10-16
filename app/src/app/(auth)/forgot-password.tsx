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
          title="Revisa tu email"
          message="Si existe una cuenta con ese email, te hemos enviado un enlace para crear una nueva contraseña. Ábrelo desde este móvil; si pides otro, usa solo el más reciente."
          actionLabel="Volver a iniciar sesión"
          onAction={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Recuperar contraseña</AppText>
      <AppText variant="small">Te enviaremos un enlace para crear una nueva contraseña.</AppText>
      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={error}
          placeholder="tu@email.com"
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
        <Button title="Enviar enlace" onPress={submit} loading={loading} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg, marginTop: tokens.spacing.md },
});
