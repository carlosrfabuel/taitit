import { Tabs } from 'expo-router';
import { ColorValue } from 'react-native';
import { tokens } from '@taitit/shared';
import { Icon, IconName } from '@/ui';

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={focused ? iconActive : icon} size={22} color={color} />
  ),
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: tokens.colors.background },
        sceneStyle: { backgroundColor: tokens.colors.background },
        tabBarActiveTintColor: tokens.colors.primary,
        tabBarInactiveTintColor: tokens.colors.muted,
        tabBarLabelStyle: { fontSize: tokens.typography.tiny, fontWeight: tokens.weight.medium },
      }}
    >
      <Tabs.Screen name="index" options={tab('Catálogo', 'glasses-outline', 'glasses')} />
      <Tabs.Screen name="designs" options={tab('Mis diseños', 'heart-outline', 'heart')} />
      <Tabs.Screen name="orders" options={tab('Mis pedidos', 'receipt-outline', 'receipt')} />
      <Tabs.Screen name="account" options={tab('Cuenta', 'person-outline', 'person')} />
    </Tabs>
  );
}
