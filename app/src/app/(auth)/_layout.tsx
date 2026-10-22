import { Stack } from 'expo-router';
import { tokens } from '@taitit/shared';
import { BrandLogo } from '@/ui';

// The account screens (sign in, create account, reset and new password): Carlos's logo centered in the
// top bar, next to the back arrow (the screens' own titles are in the page).
const logoHeader = {
  title: '',
  headerTitleAlign: 'center' as const,
  headerTitle: () => <BrandLogo width={120} />,
};

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.background },
        contentStyle: { backgroundColor: tokens.colors.background },
      }}
    >
      <Stack.Screen name="sign-in" options={logoHeader} />
      <Stack.Screen name="sign-up" options={logoHeader} />
      <Stack.Screen name="forgot-password" options={logoHeader} />
      <Stack.Screen name="reset-password" options={logoHeader} />
    </Stack>
  );
}
