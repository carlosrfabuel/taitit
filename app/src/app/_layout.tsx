import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { ToastProvider } from '@/ui';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ToastProvider>
          <StatusBar style="dark" />
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
            <Stack.Screen name="customize/[modelId]" options={{ title: 'Personalizar' }} />
            <Stack.Screen name="order/summary" options={{ title: 'Resumen del pedido' }} />
            <Stack.Screen name="order/done" options={{ title: 'Pedido enviado', headerBackVisible: false }} />
            <Stack.Screen name="dev/ui-kit" options={{ title: 'UI kit' }} />
          </Stack>
        </ToastProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
