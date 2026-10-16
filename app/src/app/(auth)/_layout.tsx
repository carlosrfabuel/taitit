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
      <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
      <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
      <Stack.Screen name="forgot-password" options={{ title: 'Reset password' }} />
      <Stack.Screen name="reset-password" options={{ title: 'New password' }} />
    </Stack>
  );
}
