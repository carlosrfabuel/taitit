import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { validateEmail, validateName, validatePassword } from '@/auth/validation';
import {
  businessColumns,
  emptyBusiness,
  validateBusiness,
  type BusinessDetails,
  type BusinessKey,
} from '@/auth/business';
import { BusinessFields } from '@/auth/BusinessFields';
import { AppText, Button, Icon, Screen, TextField, useToast } from '@/ui';
import { useCloseAuth } from '@/auth/navigation';
import { WaitingForConfirmation, type WaitReason } from '@/auth/WaitingForConfirmation';
import { openPrivacyPolicy } from '@/lib/links';
import { fonts } from '@/ui/fonts';

export default function SignUpScreen() {
  const { signUp } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // The optician's business details: TAITIT needs them on every order (and to approve the account).
  const [business, setBusiness] = useState<BusinessDetails>(emptyBusiness);
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [waitReason, setWaitReason] = useState<WaitReason>('signed_up');
  const closeAuth = useCloseAuth();
  // An edited field drops its old error; the next submit validates everything again.
  const clearError = (field: string) => setErrors((e) => (e[field] ? { ...e, [field]: null } : e));

  const submit = async () => {
    if (loading) return; // keyboard "done" can fire while a request is running
    const next = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      accepted: accepted ? null : 'You must accept the privacy policy.',
      ...validateBusiness(business),
    };
    setErrors(next);
    setFormError(null);
    if (Object.values(next).some(Boolean)) return;
    setLoading(true);
    const { error, needsConfirmation, existingAccount } = await signUp(
      name,
      email,
      password,
      businessColumns(business),
    );
    setLoading(false);
    if (error) {
      setFormError(error);
      return;
    }
    if (needsConfirmation) {
      setWaitReason(existingAccount ? 'existing_account' : 'signed_up');
      setSentTo(email.trim());
      return;
    }
    toast('Account created. TAITIT will review it before you can order.', 'success');
    closeAuth();
  };

  if (sentTo) {
    return (
      <Screen>
        <WaitingForConfirmation
          email={sentTo}
          password={password}
          reason={waitReason}
          onContinue={() => {
            toast(waitReason === 'existing_account' ? 'Signed in' : 'Welcome to TAITIT', 'success');
            closeAuth();
          }}
          onSignIn={() => router.dismissTo('/sign-in')}
          onForgotPassword={() => router.push('/forgot-password')}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppText variant="title">Create account</AppText>
      <AppText variant="small">Join TAITIT and start designing your perfect eyewear.</AppText>
      <View style={styles.form}>
        <TextField
          label="Contact person"
          value={name}
          onChangeText={(v) => {
            setName(v);
            clearError('name');
          }}
          error={errors.name}
          autoComplete="name"
          textContentType="name"
        />
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
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            clearError('password');
          }}
          error={errors.password}
          helper="At least 8 characters."
          revealable
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
        />
        <AppText variant="heading" style={styles.section}>
          Your business
        </AppText>
        <BusinessFields
          values={business}
          errors={errors as Partial<Record<BusinessKey, string | null>>}
          onChange={(key, v) => {
            setBusiness((b) => ({ ...b, [key]: v }));
            clearError(key);
          }}
          onSame={(key, same) => setBusiness((b) => ({ ...b, same: { ...b.same, [key]: same } }))}
        />
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          onPress={() => {
            setAccepted((v) => !v);
            clearError('accepted');
          }}
          style={styles.check}
          hitSlop={6}
        >
          <Icon
            name={accepted ? 'checkbox' : 'square-outline'}
            size={24}
            color={accepted ? tokens.colors.primary : tokens.colors.muted}
          />
          <AppText variant="small" style={styles.checkText}>
            I accept the{' '}
            <AppText
              variant="small"
              color={tokens.colors.primary}
              style={styles.link}
              onPress={openPrivacyPolicy}
              accessibilityRole="link"
            >
              privacy policy
            </AppText>
            .
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
        <Button title="Create account" onPress={submit} loading={loading} fullWidth />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: tokens.spacing.lg, marginTop: tokens.spacing.lg },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    minHeight: tokens.touch.minSize,
  },
  checkText: { flex: 1, color: tokens.colors.text },
  link: { textDecorationLine: 'underline', fontFamily: fonts.bodyMedium },
  section: { marginTop: tokens.spacing.sm },
});
