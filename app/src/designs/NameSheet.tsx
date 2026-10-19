import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tokens } from '@taitit/shared';
import { Button, Sheet, TextField } from '@/ui';
import { NAME_MAX, validateName } from './designs';

/**
 * Asks for a design name (save, rename). `onSubmit` returns an error message to show, or nothing
 * when it worked (the sheet then closes).
 */
export function NameSheet({
  visible,
  title,
  initialName,
  submitLabel,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<string | void>;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title={title} onClose={onClose}>
      {/* Remounted on every open: the field starts from the current name each time. */}
      {visible ? (
        <NameForm initialName={initialName} submitLabel={submitLabel} onSubmit={onSubmit} onClose={onClose} />
      ) : null}
    </Sheet>
  );
}

function NameForm({
  initialName,
  submitLabel,
  onSubmit,
  onClose,
}: {
  initialName: string;
  submitLabel: string;
  onSubmit: (name: string) => Promise<string | void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Guards against a second submit before the re-render (keyboard "done" then a tap on Save).
  const submitting = useRef(false);

  const submit = async () => {
    if (submitting.current) return;
    const v = validateName(name);
    if ('error' in v) return setError(v.error);
    submitting.current = true;
    setBusy(true);
    const failure = await onSubmit(v.name);
    submitting.current = false;
    setBusy(false);
    if (failure) setError(failure);
    else onClose();
  };

  return (
    <>
      <TextField
        label="Name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        error={error}
        maxLength={NAME_MAX}
        autoFocus
        selectTextOnFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View style={styles.actions}>
        <Button title="Cancel" variant="secondary" onPress={onClose} disabled={busy} style={styles.action} />
        <Button title={submitLabel} onPress={submit} loading={busy} style={styles.action} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: tokens.spacing.md },
  action: { flex: 1 },
});
