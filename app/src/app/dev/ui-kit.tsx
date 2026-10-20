import { useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import {
  AppText,
  Badge,
  Button,
  Card,
  Chip,
  EmptyState,
  Screen,
  Skeleton,
  Swatch,
  TextField,
  useToast,
} from '@/ui';
import { RecolorDemo } from '@/render/RecolorDemo';

// Sample palette: solid, translucent and metal swatches (real colors come from the client's chart).
const SAMPLES = [
  { name: 'Black', hex: '#1E1E22' },
  { name: 'Neon green', hex: '#4CFF5A' },
  { name: 'Translucent pink', hex: '#E8434F', alpha: 0.55 },
  { name: 'Crystal', hex: '#F4F1EA', alpha: 0.45 },
  { name: 'Gold', hex: '#C9A45C' },
  { name: 'Blue', hex: '#2A6FDB' },
];

// Development-only gallery of the UI kit. Expo Router bundles every route file, so production
// builds redirect instead of showing it (e.g. if opened through a taitit://dev/ui-kit link).
export default function UiKitRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <UiKitScreen />;
}

function UiKitScreen() {
  const toast = useToast();
  const [chip, setChip] = useState('All');
  const [swatch, setSwatch] = useState(0);
  const [loading, setLoading] = useState(false);

  return (
    <Screen>
      <Section title="Recolor (renderer)">
        <RecolorDemo />
      </Section>

      <Section title="Typography">
        <AppText variant="title">Title</AppText>
        <AppText variant="heading">Heading</AppText>
        <AppText variant="subheading">Subheading</AppText>
        <AppText>Regular body text.</AppText>
        <AppText variant="small">Small secondary text.</AppText>
      </Section>

      <Section title="Buttons">
        <Button title="Primary" icon="cart-outline" onPress={() => toast('Primary button', 'success')} />
        <Button title="Secondary" variant="secondary" onPress={() => toast('Secondary button')} />
        <Button
          title="Delete"
          variant="danger"
          icon="trash-outline"
          onPress={() => toast('Sample error', 'error')}
        />
        <Button
          title="Loading"
          loading={loading}
          onPress={() => {
            setLoading(true);
            setTimeout(() => setLoading(false), 1500);
          }}
        />
        <View style={styles.row}>
          <Button title="Small" size="sm" />
          <Button title="Ghost" size="sm" variant="ghost" />
          <Button title="Disabled" size="sm" disabled />
        </View>
      </Section>

      <Section title="Fields">
        <TextField
          label="Email"
          placeholder="you@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextField label="Password" placeholder="••••••••" revealable />
        <TextField label="With error" defaultValue="not-an-email" error="Enter a valid email address." />
      </Section>

      <Section title="Filters">
        <View style={styles.row}>
          {['All', 'Optical', 'Sunglasses'].map((c) => (
            <Chip key={c} label={c} selected={chip === c} onPress={() => setChip(c)} />
          ))}
        </View>
      </Section>

      <Section title="Status">
        <Badge tone="selected" icon="checkmark-circle" label="Approved: you can place orders" />
        <Badge tone="highlight" icon="time-outline" label="Waiting for approval by TAITIT" />
        <Badge tone="danger" icon="close-circle-outline" label="Not approved. Please contact TAITIT." />
        <Badge label="Neutral" />
      </Section>

      <Section title="Color swatches">
        <View style={styles.row}>
          {SAMPLES.map((s, i) => (
            <Swatch
              key={s.name}
              hex={s.hex}
              alpha={s.alpha}
              selected={swatch === i}
              onPress={() => setSwatch(i)}
              accessibilityLabel={s.name}
            />
          ))}
        </View>
        <AppText variant="small">Selected: {SAMPLES[swatch]?.name}</AppText>
      </Section>

      <Section title="Card and loading">
        <Card onPress={() => toast('Card pressed')} accessibilityLabel="Sample card">
          <AppText variant="subheading">PHILEAS</AppText>
          <AppText variant="small">Titanium + acetate</AppText>
        </Card>
        <Skeleton height={120} radius={tokens.radius.lg} />
        <Skeleton width="60%" />
      </Section>

      <Section title="Empty">
        <Card>
          <EmptyState
            icon="heart-outline"
            title="No designs yet"
            message="Customize a model and save it to see it here."
            actionLabel="Go to catalog"
            onAction={() => toast('Action')}
          />
        </Card>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="tiny" style={styles.sectionTitle}>
        {title.toUpperCase()}
      </AppText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: tokens.spacing.md, marginBottom: tokens.spacing.md },
  sectionTitle: { letterSpacing: 1 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.spacing.sm, alignItems: 'center' },
});
