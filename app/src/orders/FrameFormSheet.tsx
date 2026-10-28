import { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { tokens } from '@taitit/shared';
import { Button, Sheet, TextField } from '@/ui';
import {
  EMPTY_FORM,
  FRAME_NOTES_MAX,
  LABELING_MAX,
  MEASURES,
  MM_MAX,
  MM_MIN,
  charCount,
  type FrameForm,
  type Measure,
} from './frameForm';

const { spacing } = tokens;

/**
 * The customizing form of the frame being designed, over the customizer (Carlos: on the same page as
 * the colors). Edits a copy; "Done" hands it back once the measurements are valid.
 */
export function FrameFormSheet({
  visible,
  value,
  onDone,
  onClose,
}: {
  visible: boolean;
  value: FrameForm;
  onDone: (form: FrameForm) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title="Customizing form" onClose={onClose}>
      {/* Remounted on every open: the fields start from the frame's current form each time. */}
      {visible ? <FormFields initial={value} onDone={onDone} /> : null}
    </Sheet>
  );
}

const digits = (n: number | null) => (n === null ? '' : String(n));

function FormFields({ initial, onDone }: { initial: FrameForm; onDone: (form: FrameForm) => void }) {
  const { height } = useWindowDimensions();
  // Measurements as typed (digits only); turned into numbers on "Done".
  const [mm, setMm] = useState<Record<Measure, string>>({
    templeLength: digits(initial.templeLength),
    bridgeSize: digits(initial.bridgeSize),
    ringSizeA: digits(initial.ringSizeA),
    ringSizeB: digits(initial.ringSizeB),
  });
  const [labeling, setLabeling] = useState(initial.templeLabeling);
  const [notes, setNotes] = useState(initial.notes);
  const [errors, setErrors] = useState<Partial<Record<Measure, string>>>({});

  const done = () => {
    const found: Partial<Record<Measure, string>> = {};
    const form: FrameForm = { ...EMPTY_FORM, templeLabeling: labeling, notes };
    for (const { key } of MEASURES) {
      if (!mm[key]) continue;
      const n = Number(mm[key]);
      if (n < MM_MIN || n > MM_MAX) found[key] = `${MM_MIN}–${MM_MAX} mm`;
      else form[key] = n;
    }
    setErrors(found);
    if (Object.keys(found).length === 0) onDone(form);
  };

  return (
    <>
      <ScrollView
        style={{ maxHeight: height * 0.55 }}
        contentContainerStyle={styles.fields}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.grid}>
          {MEASURES.map(({ key, label, extraCost }) => (
            <View key={key} style={styles.cell}>
              <TextField
                label={`${label} (mm)`}
                value={mm[key]}
                onChangeText={(t) => {
                  // Whole millimetres: digits only, at most 3.
                  setMm((v) => ({ ...v, [key]: t.replace(/\D/g, '').slice(0, 3) }));
                  setErrors((e) => ({ ...e, [key]: undefined }));
                }}
                keyboardType="number-pad"
                maxLength={3}
                error={errors[key]}
                helper={extraCost ? 'Extra cost' : 'No extra cost'}
              />
            </View>
          ))}
        </View>
        <TextField
          label="Temple labeling"
          value={labeling}
          onChangeText={(t) => setLabeling(Array.from(t).slice(0, LABELING_MAX).join(''))}
          autoCapitalize="characters"
          helper={`No extra cost · ${charCount(labeling)}/${LABELING_MAX}`}
        />
        <TextField
          label="Notes for this frame"
          value={notes}
          onChangeText={(t) => setNotes(Array.from(t).slice(0, FRAME_NOTES_MAX).join(''))}
          multiline
          style={styles.notes}
          helper={`${charCount(notes)}/${FRAME_NOTES_MAX}`}
        />
      </ScrollView>
      <View style={styles.actions}>
        <Button
          title="Clear"
          variant="ghost"
          onPress={() => {
            setMm({ templeLength: '', bridgeSize: '', ringSizeA: '', ringSizeB: '' });
            setLabeling('');
            setNotes('');
            setErrors({});
          }}
        />
        <Button title="Done" onPress={done} style={styles.done} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  // Two measurements per row.
  cell: { flexBasis: '45%', flexGrow: 1 },
  notes: { minHeight: 72, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: spacing.md },
  done: { flex: 1 },
});
