import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { ToastProvider } from '@/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';

// Keep the splash screen until the stored session is read, so signed-in users never see a signed-out flash.
SplashScreen.preventAutoHideAsync().catch(() => {});

function RootStack() {
  const { initializing } = useAuth();

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync().catch(() => {});
  }, [initializing]);

  if (initializing) return null;

  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.background },
        headerTintColor: tokens.colors.text,
        contentStyle: { backgroundColor: tokens.colors.background },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" options={{ title: 'Confirm account' }} />
      <Stack.Screen name="customize/[modelId]" options={{ title: 'Customize' }} />
      <Stack.Screen name="order/summary" options={{ title: 'Order summary' }} />
      <Stack.Screen name="order/done" options={{ title: 'Order sent', headerBackVisible: false }} />
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
              <StatusBar style="dark" />
              <RootStack />
            </AuthProvider>
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
