import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { validateEmail, validateName, validatePassword } from '@/auth/validation';
import { AppText, Button, EmptyState, Icon, Screen, TextField, useToast } from '@/ui';
import { closeAuth } from '@/auth/navigation';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    if (loading) return; // keyboard "done" can fire while a request is running
    const next = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      accepted: accepted ? null : 'Debes aceptar la política de privacidad.',
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;
    setLoading(true);
    const { error, needsConfirmation } = await signUp(name, email, password);
    setLoading(false);
    if (error) {
      setFormError(error);
      return;
    }
    if (needsConfirmation) {
      setSentTo(email.trim());
      return;
    }
    toast('Cuenta creada', 'success');
    closeAuth();
  };

  if (sentTo) {
    // Neutral wording: Supabase doesn't reveal whether the email was already registered.
    return (
      <Screen>
        <EmptyState
          icon="mail-unread-outline"
          title="Revisa tu email"
          message={`Si ${sentTo} no estaba registrado, te hemos enviado un enlace para confirmar la cuenta. Ábrelo desde este móvil; si pides otro, usa solo el más reciente.`}
          actionLabel="Ir a iniciar sesión"
          onAction={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Crear cuenta</AppText>
      <View style={styles.form}>
        <TextField
          label="Nombre"
          value={name}
          onChangeText={setName}
          error={errors.name}
          autoComplete="name"
          textContentType="name"
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={errors.email}
          placeholder="tu@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
        />
        <TextField
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          error={errors.password}
          helper="Mínimo 8 caracteres."
          revealable
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          onPress={() => setAccepted((v) => !v)}
          style={styles.check}
          hitSlop={6}
        >
          <Icon
            name={accepted ? 'checkbox' : 'square-outline'}
            size={24}
            color={accepted ? tokens.colors.primary : tokens.colors.muted}
          />
          {/* Link to the real policy URL once the client publishes it (Milestone 5). */}
          <AppText variant="small" style={styles.checkText}>
            Acepto la política de privacidad y las condiciones de uso.
          </AppText>
        </Pressable>
        {errors.accepted ? (
          <AppText variant="small" color={tokens.colors.danger}>
            {errors.accepted}
          </AppText>
        ) : null}
        {formError ? (
          <AppText variant="small" color={tokens.colors.danger} accessibilityLiveRegion="polite">
            {formError}
          </AppText>
        ) : null}
        <Button title="Crear cuenta" onPress={submit} loading={loading} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg, marginTop: tokens.spacing.md },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    minHeight: tokens.touch.minSize,
  },
  checkText: { flex: 1, color: tokens.colors.text },
});
