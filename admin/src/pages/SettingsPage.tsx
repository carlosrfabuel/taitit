import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { Button, Card, EmptyState, Input, Spinner } from '../components/ui';
import {
  formatWhatsapp,
  getSettings,
  normalizeWhatsapp,
  saveSettings,
  settingsKeys,
  validateSettings,
  type Settings,
} from '../lib/settings';
import { dbMessage, readMessage } from '../lib/errors';

// What TAITIT changes itself (Carlos, 2026-10-26): the WhatsApp number orders are shared to and the
// address the order emails go to. The app reads the number when an optician shares an order, so a
// change applies at once, with no app update.
export function SettingsPage() {
  const settings = useQuery({ queryKey: settingsKeys.all, queryFn: getSettings });
  return (
    <>
      <PageHeader crumbs={[{ label: 'Settings' }]} title="Settings" />
      {settings.isPending ? (
        <Spinner />
      ) : settings.isError && !settings.data ? (
        <EmptyState
          title="Couldn't load the settings"
          message={readMessage(settings.error)}
          action={<Button onClick={() => void settings.refetch()}>Try again</Button>}
        />
      ) : (
        <SettingsForm initial={settings.data} />
      )}
    </>
  );
}

function SettingsForm({ initial }: { initial: Settings }) {
  const queryClient = useQueryClient();
  const [whatsapp, setWhatsapp] = useState(formatWhatsapp(initial.whatsapp_number));
  const [email, setEmail] = useState(initial.order_email);
  const [errors, setErrors] = useState<{ whatsapp?: string; email?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () =>
      saveSettings({ whatsapp_number: normalizeWhatsapp(whatsapp), order_email: email.trim() }),
    onSuccess: () => {
      setNotice('Settings saved.');
      void queryClient.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (save.isPending) return;
    setNotice(null);
    const next = validateSettings(whatsapp, email);
    setErrors(next);
    if (next.whatsapp || next.email) return;
    save.mutate();
  };

  const edit = (apply: () => void) => {
    apply();
    setNotice(null);
    if (!save.isPending) save.reset();
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-2xl">
      <Card className="flex flex-col gap-5">
        <Input
          label="WhatsApp for orders"
          value={whatsapp}
          inputMode="tel"
          autoComplete="off"
          placeholder="+34 647 942 967"
          error={errors.whatsapp}
          hint="With the country code. Opticians send their order summary to this number from the app. Leave it empty to let them choose the chat."
          onChange={(e) =>
            edit(() => {
              setWhatsapp(e.target.value);
              setErrors((x) => ({ ...x, whatsapp: undefined }));
            })
          }
        />
        <Input
          label="Email for orders"
          type="email"
          value={email}
          autoComplete="off"
          placeholder="orders@taititeyewear.com"
          error={errors.email}
          hint="Address for the order emails (with the image and the Excel sheet). They start once the email service is set up."
          onChange={(e) =>
            edit(() => {
              setEmail(e.target.value);
              setErrors((x) => ({ ...x, email: undefined }));
            })
          }
        />
        {save.isError && (
          <p role="alert" className="text-sm text-danger">
            {`Couldn't save. ${dbMessage(save.error)}`}
          </p>
        )}
        {notice && !save.isPending && (
          <p role="status" className="text-sm text-success">
            {notice}
          </p>
        )}
        <div>
          <Button type="submit" loading={save.isPending}>
            Save
          </Button>
        </div>
      </Card>
    </form>
  );
}
