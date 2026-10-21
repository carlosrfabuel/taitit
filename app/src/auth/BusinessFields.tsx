import { Pressable, StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { AppText, Icon, TextField } from '@/ui';
import { BUSINESS_SECTIONS, type BusinessDetails, type BusinessKey, type SameKey } from './business';

/** The business details form (sign-up and the edit screen). */
export function BusinessFields({
  values,
  errors,
  onChange,
  onSame,
}: {
  values: BusinessDetails;
  errors: Partial<Record<BusinessKey, string | null>>;
  onChange: (key: BusinessKey, value: string) => void;
  onSame: (key: SameKey, same: boolean) => void;
}) {
  return (
    <View style={styles.fields}>
      {BUSINESS_SECTIONS.map((section) => {
        const same = section.same ? values.same[section.same.key] : false;
        const field = (g: (typeof section.fields)[number]) => (
          <TextField
            key={g.key}
            label={g.label}
            value={values[g.key]}
            onChangeText={(v) => onChange(g.key, v)}
            error={errors[g.key]}
            helper={g.helper}
            maxLength={g.max}
            {...g.input}
          />
        );
        return (
          <View key={section.id} style={styles.fields}>
            {section.title ? (
              <AppText variant="subheading" style={styles.title}>
                {section.title}
              </AppText>
            ) : null}
            {section.same ? (
              <SameCheck
                label={section.same.label}
                checked={same}
                onToggle={() => onSame(section.same!.key, !same)}
              />
            ) : null}
            {same
              ? null
              : section.fields.map((f) => {
                  if (f.key.endsWith('city')) return null; // shown next to the postal code
                  const city = section.fields.find((g) => g.key.endsWith('city'));
                  if (f.key.endsWith('postal_code') && city)
                    return (
                      <View key={`${f.key}_city`} style={styles.row}>
                        <View style={styles.postal}>{field(f)}</View>
                        <View style={styles.city}>{field(city)}</View>
                      </View>
                    );
                  return field(f);
                })}
          </View>
        );
      })}
    </View>
  );
}

function SameCheck({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      style={styles.check}
      hitSlop={6}
    >
      <Icon
        name={checked ? 'checkbox' : 'square-outline'}
        size={24}
        color={checked ? tokens.colors.primary : tokens.colors.muted}
      />
      <AppText variant="small" style={styles.checkText}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.spacing.lg },
  title: { marginTop: tokens.spacing.sm },
  row: { flexDirection: 'row', gap: tokens.spacing.md, alignItems: 'flex-start' },
  postal: { flex: 2 },
  city: { flex: 3 },
  check: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    minHeight: tokens.touch.minSize,
  },
  checkText: { flex: 1, color: tokens.colors.text },
});
