import { Tabs } from 'expo-router';
import { tokens } from '@taitit/shared';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.background },
        sceneStyle: { backgroundColor: tokens.colors.background },
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Catálogo' }} />
      <Tabs.Screen name="designs" options={{ title: 'Mis diseños' }} />
      <Tabs.Screen name="orders" options={{ title: 'Mis pedidos' }} />
      <Tabs.Screen name="account" options={{ title: 'Cuenta' }} />
    </Tabs>
  );
}
