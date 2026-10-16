import { Stack } from 'expo-router';
import { tokens } from '@taitit/shared';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.background },
        contentStyle: { backgroundColor: tokens.colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={{ title: 'Iniciar sesión' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Crear cuenta' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Recuperar contraseña' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Nueva contraseña' }} />
    </Stack>
  );
}
