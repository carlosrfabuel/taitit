import { Redirect, Tabs } from 'expo-router';
import { ColorValue, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { Icon, IconName } from '@/ui';
import { fonts } from '@/ui/fonts';
import { useAuth } from '@/auth/AuthProvider';
import { useWelcome } from '@/lib/welcome';

const { colors, spacing } = tokens;
const BAR_HEIGHT = 62;

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={focused ? iconActive : icon} size={22} color={color} />
  ),
});

export default function TabsLayout() {
  const { session } = useAuth();
  const welcome = useWelcome();
  const insets = useSafeAreaInsets();

  // Visitors who aren't signed in see the welcome screen first (first launch, after signing out).
  if (welcome.show && !session) return <Redirect href="/welcome" />;

  return (
    <Tabs
      // The bar keeps its own margin above the system navigation (no inset padding inside the pill).
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fonts.heading },
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: tokens.typography.tiny, fontFamily: fonts.headingMedium },
        // A floating rounded bar (not overlaid: the screens end above it, nothing hides behind it).
        tabBarStyle: {
          height: BAR_HEIGHT,
          paddingTop: spacing.xs,
          paddingBottom: spacing.xs,
          marginHorizontal: spacing.lg,
          marginBottom: Math.max(insets.bottom, spacing.sm) + spacing.xs,
          borderRadius: 24,
          borderTopWidth: 0,
          backgroundColor: colors.surface,
          ...Platform.select({
            ios: {
              shadowColor: colors.text,
              shadowOpacity: 0.1,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            },
            default: { elevation: 6 },
          }),
        },
        tabBarItemStyle: { borderRadius: 20 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ ...tab('Catalog', 'glasses-outline', 'glasses'), headerShown: false }}
      />
      <Tabs.Screen name="designs" options={tab('My designs', 'heart-outline', 'heart')} />
      <Tabs.Screen name="orders" options={tab('My orders', 'receipt-outline', 'receipt')} />
      <Tabs.Screen name="account" options={tab('Account', 'person-outline', 'person')} />
    </Tabs>
  );
}
