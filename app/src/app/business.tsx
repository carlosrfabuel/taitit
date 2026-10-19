import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { BusinessFields } from '@/auth/BusinessFields';
import { businessFromProfile, saveBusiness, validateBusiness, type BusinessKey } from '@/auth/business';
import { AppText, Button, EmptyState, Loader, Screen, useToast } from '@/ui';

// Edit the optician's business details. They are copied into each new order; orders already sent
// keep the details they were sent with.
export default function BusinessScreen() {
  const { session, profile, profileFailed, reloadProfile } = useAuth();
  if (!session)
    return (
      <Screen>
        <EmptyState
          icon="person-circle-outline"
          title="Sign in first"
          message="Your business details belong to your account."
          actionLabel="Sign in"
          onAction={() => router.replace('/sign-in')}
        />
      </Screen>
    );
  if (!profile && profileFailed)
    return (
      <Screen>
        <EmptyState
          icon="cloud-offline-outline"
          title="Couldn't load your details"
          message="Check your connection and try again."
          actionLabel="Try again"
          onAction={reloadProfile}
        />
      </Screen>
    );
  if (!profile) return <Loader message="Loading your details…" />;
  // Keyed: the form starts from the details as loaded.
  return (
    <BusinessForm
      key={profile.id}
      userId={session.user.id}
      initial={businessFromProfile(profile)}
      onSaved={reloadProfile}
    />
  );
}

function BusinessForm({
  userId,
  initial,
  onSaved,
}: {
  userId: string;
  initial: ReturnType<typeof businessFromProfile>;
  onSaved: () => void;
}) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Partial<Record<BusinessKey, string | null>>>({});
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    const invalid = validateBusiness(values);
    if (invalid) return setErrors(invalid);
    setBusy(true);
    try {
      await saveBusiness(userId, values);
      onSaved();
      toast('Business details saved', 'success');
      router.back();
    } catch {
      toast("Couldn't save. Check your connection and try again.", 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: tokens.spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <AppText variant="small">
          TAITIT receives these details with every order. Orders already sent keep the details they were sent
          with.
        </AppText>
        <BusinessFields
          values={values}
          errors={errors}
          onChange={(key, v) => {
            setValues((b) => ({ ...b, [key]: v }));
            setErrors((e) => ({ ...e, [key]: null }));
          }}
        />
        <Button title="Save" onPress={save} loading={busy} fullWidth />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: tokens.colors.background },
  content: { padding: tokens.spacing.xl, gap: tokens.spacing.lg },
});
