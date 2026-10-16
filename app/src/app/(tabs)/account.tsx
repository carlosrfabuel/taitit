import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { useAuth } from '@/auth/AuthProvider';
import { AppText, Button, Card, EmptyState, Screen, useToast } from '@/ui';

export default function AccountScreen() {
  const { session, profile, signOut } = useAuth();
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);

  const devKit = __DEV__ ? (
    <Button
      title="UI kit (solo desarrollo)"
      variant="ghost"
      icon="color-palette-outline"
      onPress={() => router.push('/dev/ui-kit')}
    />
  ) : null;

  if (!session) {
    return (
      <Screen>
        <Card>
          <EmptyState
            icon="person-circle-outline"
            title="No has iniciado sesión"
            message="Inicia sesión para guardar tus diseños y hacer pedidos."
            actionLabel="Iniciar sesión"
            onAction={() => router.push('/sign-in')}
          />
        </Card>
        {devKit}
      </Screen>
    );
  }

  const onSignOut = async () => {
    setSigningOut(true);
    await signOut();
    setSigningOut(false);
    toast('Sesión cerrada');
  };

  return (
    <Screen>
      <Card>
        <View style={styles.row}>
          <AppText variant="tiny">NOMBRE</AppText>
          <AppText variant="subheading">{profile?.full_name || '—'}</AppText>
        </View>
        <View style={styles.row}>
          <AppText variant="tiny">EMAIL</AppText>
          <AppText>{session.user.email}</AppText>
        </View>
      </Card>
      <Button
        title="Cerrar sesión"
        variant="secondary"
        icon="log-out-outline"
        onPress={onSignOut}
        loading={signingOut}
      />
      {/* Account deletion (store requirement) arrives on Day 20. */}
      {devKit}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { gap: tokens.spacing.xs, paddingVertical: tokens.spacing.sm },
});
