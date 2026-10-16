import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { closeAuth } from '@/auth/navigation';
import { validateEmail } from '@/auth/validation';
import { AppText, Button, Screen, TextField, useToast } from '@/ui';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // An edited field drops its old error; the next submit validates everything again.
  const clearError = (field: 'email' | 'password') =>
    setErrors((e) => (e[field] ? { ...e, [field]: null } : e));

  const submit = async () => {
    if (loading) return; // keyboard "done" can fire while a request is running
    const next = { email: validateEmail(email), password: password ? null : 'Enter your password.' };
    setErrors(next);
    setFormError(null);
    if (next.email || next.password) return;
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setFormError(error);
      return;
    }
    toast('Signed in', 'success');
    closeAuth();
  };

  return (
    <Screen>
      <AppText variant="title">Welcome</AppText>
      <AppText variant="small">Sign in to save your designs and place orders.</AppText>

      <View style={styles.form}>
        <TextField
          label="Email"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            clearError('email');
          }}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clearError('password');
          }}
          error={errors.password}
          revealable
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={submit}
        />
        {formError ? (
          <AppText variant="small" color={tokens.colors.danger} accessibilityLiveRegion="polite">
            {formError}
          </AppText>
        ) : null}
        <Button title="Sign in" onPress={submit} loading={loading} fullWidth />
      </View>

      <View style={styles.links}>
        <Button
          title="Create account"
          variant="secondary"
          onPress={() => router.push('/sign-up')}
          fullWidth
        />
        <Button title="Forgot my password" variant="ghost" onPress={() => router.push('/forgot-password')} />
        <Button title="Continue as guest" variant="ghost" onPress={closeAuth} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg, marginTop: tokens.spacing.md },
  links: { gap: tokens.spacing.sm, marginTop: tokens.spacing.md },
});
