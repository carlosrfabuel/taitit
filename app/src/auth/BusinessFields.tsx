import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { TextField } from '@/ui';
import { BUSINESS_FIELDS, type BusinessDetails, type BusinessKey } from './business';

/** The business details form (sign-up and the edit screen). */
export function BusinessFields({
  values,
  errors,
  onChange,
}: {
  values: BusinessDetails;
  errors: Partial<Record<BusinessKey, string | null>>;
  onChange: (key: BusinessKey, value: string) => void;
}) {
  return (
    <View style={styles.fields}>
      {BUSINESS_FIELDS.map((f) => {
        if (f.key === 'city') return null; // shown next to the postal code
        const field = (g: (typeof BUSINESS_FIELDS)[number]) => (
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
        const city = BUSINESS_FIELDS.find((g) => g.key === 'city');
        if (f.key === 'postal_code' && city)
          return (
            <View key="postal_city" style={styles.row}>
              <View style={styles.postal}>{field(f)}</View>
              <View style={styles.city}>{field(city)}</View>
            </View>
          );
        return field(f);
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: tokens.spacing.lg },
  row: { flexDirection: 'row', gap: tokens.spacing.md, alignItems: 'flex-start' },
  postal: { flex: 2 },
  city: { flex: 3 },
});
