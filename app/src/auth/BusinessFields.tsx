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
      {BUSINESS_FIELDS.map((f) => (
        <TextField
          key={f.key}
          label={f.label}
          value={values[f.key]}
          onChangeText={(v) => onChange(f.key, v)}
          error={errors[f.key]}
          helper={f.helper}
          maxLength={f.max}
          {...f.input}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ fields: { gap: tokens.spacing.lg } });
