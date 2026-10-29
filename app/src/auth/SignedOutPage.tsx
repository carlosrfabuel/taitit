import { router } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText, Button, Card, EmptyState, Icon, Screen, useDesktop, type IconName } from '@/ui';

const { colors, spacing, radius } = tokens;

type Step = { icon: IconName; title: string; text: string };

type Props = {
  icon: IconName;
  /** Phone: the card's title and line. */
  title: string;
  message: string;
  /** Computer: the page's heading (the tab's name) and what the section is for. */
  heading: string;
  intro: string;
  /** Computer: what the guest can do once signed in, in order. */
  steps?: Step[];
  /** Below it all (Account: the app version). */
  children?: ReactNode;
};

/**
 * A tab's page for guests. Phone: a card with Sign in. Computer: a page of its own, the heading, what
 * the section is for and Sign in / Create account, centered in the window with the footer at the end.
 */
export function SignedOutPage({ icon, title, message, heading, intro, steps, children }: Props) {
  const desktop = useDesktop();
  if (!desktop)
    return (
      <Screen>
        <Card>
          <EmptyState
            icon={icon}
            title={title}
            message={message}
            actionLabel="Sign in"
            onAction={() => router.push('/sign-in')}
          />
        </Card>
        {children}
      </Screen>
    );

  return (
    <Screen contentStyle={styles.page}>
      <View style={styles.center}>
        <View style={styles.iconCircle}>
          <Icon name={icon} size={30} color={colors.text} />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          {heading}
        </AppText>
        <AppText align="center" color={colors.muted} style={styles.intro}>
          {intro}
        </AppText>
        {steps ? (
          <View style={styles.steps}>
            {steps.map((s, i) => (
              <View key={s.title} style={styles.step}>
                <View style={styles.stepIcon}>
                  <Icon name={s.icon} size={20} color={colors.text} />
                </View>
                <AppText variant="label" align="center">
                  {`${i + 1}. ${s.title}`}
                </AppText>
                <AppText variant="small" align="center">
                  {s.text}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.actions}>
          <Button title="Sign in" onPress={() => router.push('/sign-in')} />
          <Button title="Create account" variant="secondary" onPress={() => router.push('/sign-up')} />
        </View>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // The page fills the window: the block in the middle of it, the footer at the end.
  page: { flexGrow: 1 },
  center: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  intro: { maxWidth: 520 },
  steps: { flexDirection: 'row', gap: spacing.md, alignSelf: 'stretch', marginTop: spacing.lg },
  step: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.selected,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
});
