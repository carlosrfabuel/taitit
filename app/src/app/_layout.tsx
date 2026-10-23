import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ToastProvider } from '@/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { WelcomeProvider } from '@/lib/welcome';
import { FONT_FILES, fonts } from '@/ui/fonts';

// Keep the splash screen until the stored session is read, so
// signed-in users never see a signed-out flash, and until the fonts are loaded (no text jump).
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { initializing } = useAuth();
  // A font that fails to load falls back to the system font: never a reason to stay on the splash.
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  const loading = initializing || (!fontsLoaded && !fontError);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  if (loading) return null;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.text,
        headerTitleStyle: { fontFamily: fonts.heading },
        contentStyle: { backgroundColor: tokens.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false, animation: 'fade' }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" options={{ title: 'Confirm account' }} />
      <Stack.Screen name="customize/[modelId]" options={{ title: 'Customize' }} />
      <Stack.Screen name="order/summary" options={{ title: 'Order summary' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="order/done" options={{ title: 'Order sent', headerBackVisible: false }} />
      <Stack.Screen name="business" options={{ title: 'Business details' }} />
      <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
      <Stack.Screen name="dev/ui-kit" options={{ title: 'UI kit' }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <AuthProvider>
              <WelcomeProvider>
                <StatusBar style="dark" />
                <RootStack />
              </WelcomeProvider>
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
