import { Redirect, Tabs } from 'expo-router';
import { ColorValue, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { tokens } from '@taitit/shared';
import { Icon, IconName, InTabsContext, useDesktop } from '@/ui';
import { fonts } from '@/ui/fonts';
import { useAuth } from '@/auth/AuthProvider';
import { useWelcome } from '@/lib/welcome';
import { DesktopNav } from '@/navigation/DesktopNav';

const { colors, spacing } = tokens;
const BAR_HEIGHT = 62;

// Window widths (in text-sized points: a larger font setting needs more) below which the longer labels
// no longer fit their fifth of the bar and a shorter one shows (measured 2026-10-29). Only the bar's
// label: the screen's heading and the page title keep the full name.
const FITS_SPARE_PARTS = 390;
const FITS_MY_LABELS = 370;

const tab = (title: string, icon: IconName, iconActive: IconName, label = title) => ({
  title,
  tabBarLabel: label,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Icon name={focused ? iconActive : icon} size={22} color={color} />
  ),
});

export default function TabsLayout() {
  const { session } = useAuth();
  const welcome = useWelcome();
  const insets = useSafeAreaInsets();
  const desktop = useDesktop();
  const { width, fontScale } = useWindowDimensions();
  const room = width / fontScale;

  // Visitors who aren't signed in see the welcome screen first (first launch, after signing out).
  // A website opens on the products: not on a computer, where "Sign in" is in the top bar.
  if (welcome.show && !session && !desktop) return <Redirect href="/welcome" />;

  return (
    // The tab screens' content ends above the bar, which clears the phone's navigation buttons itself.
    <InTabsContext.Provider value>
      <Tabs
        // Computer: a website's top bar instead of the phone's floating bar at the bottom.
        tabBar={desktop ? (props) => <DesktopNav {...props} /> : undefined}
        // The bar keeps its own margin above the system navigation (no inset padding inside the pill).
        safeAreaInsets={{ bottom: 0 }}
        screenOptions={{
          tabBarPosition: desktop ? 'top' : 'bottom',
          headerShadowVisible: false,
          // Computer: the top bar already marks the section (a title bar below it would repeat it).
          ...(desktop ? { headerShown: false } : null),
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
            // 8 px from the sides (was 16): room for five labels on 390 px wide phones.
            marginHorizontal: spacing.sm,
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
          // No side padding: the most room for the five labels (shorter ones on narrow phones, above).
          tabBarItemStyle: { borderRadius: 20, paddingHorizontal: 0 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ ...tab('Catalog', 'glasses-outline', 'glasses'), headerShown: false }}
        />
        <Tabs.Screen
          name="designs"
          options={tab('My designs', 'heart-outline', 'heart', room < FITS_MY_LABELS ? 'Designs' : undefined)}
        />
        <Tabs.Screen
          name="orders"
          options={tab(
            'My orders',
            'receipt-outline',
            'receipt',
            room < FITS_MY_LABELS ? 'Orders' : undefined,
          )}
        />
        <Tabs.Screen
          name="spare-parts"
          options={tab(
            'Spare parts',
            'construct-outline',
            'construct',
            room < FITS_SPARE_PARTS ? 'Parts' : undefined,
          )}
        />
        <Tabs.Screen name="account" options={tab('Account', 'person-outline', 'person')} />
      </Tabs>
    </InTabsContext.Provider>
  );
}
