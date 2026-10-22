import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { useCloseAuth } from '@/auth/navigation';
import { WaitingForConfirmation } from '@/auth/WaitingForConfirmation';
import { validateEmail } from '@/auth/validation';
import { AppText, Button, Screen, TextField, useToast } from '@/ui';
import { fonts } from '@/ui/fonts';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const closeAuth = useCloseAuth();
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
    const { error, errorCode } = await signIn(email, password);
    setLoading(false);
    if (errorCode === 'email_not_confirmed') {
      setUnconfirmed(true);
      return;
    }
    if (error) {
      setFormError(error);
      return;
    }
    toast('Signed in', 'success');
    closeAuth();
  };

  if (unconfirmed)
    return (
      <Screen>
        <WaitingForConfirmation
          email={email}
          password={password}
          reason="not_confirmed"
          onContinue={() => {
            toast('Signed in', 'success');
            closeAuth();
          }}
          onSignIn={() => setUnconfirmed(false)}
          onForgotPassword={() => router.push('/forgot-password')}
        />
      </Screen>
    );

  return (
    <Screen fill>
      <View style={styles.intro}>
        <AppText variant="title">Sign in</AppText>
        <AppText variant="small">Welcome back to your TAITIT account.</AppText>
      </View>

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
        {/* Where people look for it: right under the password. */}
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push('/forgot-password')}
          hitSlop={10}
          style={styles.forgot}
        >
          <AppText variant="small" color={tokens.colors.primary} style={styles.underline}>
            Forgot password?
          </AppText>
        </Pressable>
        {formError ? (
          <AppText variant="small" color={tokens.colors.danger} accessibilityLiveRegion="polite">
            {formError}
          </AppText>
        ) : null}
        <Button title="Sign in" onPress={submit} loading={loading} fullWidth />
      </View>

      <View style={styles.links}>
        <Pressable accessibilityRole="link" onPress={() => router.push('/sign-up')} hitSlop={10}>
          <AppText variant="body" align="center">
            Don&apos;t have an account?{' '}
            <AppText variant="body" color={tokens.colors.primary} style={[styles.underline, styles.strong]}>
              Create account
            </AppText>
          </AppText>
        </Pressable>
        <Button title="Continue as guest" variant="ghost" onPress={closeAuth} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: tokens.spacing.sm, paddingTop: tokens.spacing.lg, marginBottom: tokens.spacing.xxl },
  // Even, generous spacing inside the form (fields, the link, the button).
  form: { gap: tokens.spacing.xl },
  forgot: { alignSelf: 'flex-end', marginTop: -tokens.spacing.xs, marginBottom: tokens.spacing.sm },
  underline: { textDecorationLine: 'underline' },
  strong: { fontFamily: fonts.bodyBold },
  links: { gap: tokens.spacing.md, marginTop: tokens.spacing.xl, alignItems: 'center' },
});
