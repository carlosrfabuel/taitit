import { useRef, useState } from 'react';
import { Button, useToast, type ButtonVariant } from '@/ui';
import type { Order } from './orders';
import { printOrder } from './printOrder';

/** "Print order": the phone's print dialog (print, or save as PDF) with the order sheet. */
export function PrintOrderButton({
  order,
  variant = 'primary',
  waiting = false,
}: {
  order: Order | null | undefined;
  variant?: ButtonVariant;
  /** The order is still loading. */
  waiting?: boolean;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  // Guards a second tap before the re-render.
  const running = useRef(false);

  const print = async () => {
    if (!order || running.current) return;
    running.current = true;
    setBusy(true);
    try {
      await printOrder(order);
    } catch (e) {
      // Closing the print dialog without printing is not an error.
      const message = (e as { message?: string } | null)?.message ?? '';
      if (!/did not complete|cancel/i.test(message)) toast("Couldn't open printing. Try again.", 'error');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <Button
      title="Print order"
      icon="print-outline"
      variant={variant}
      fullWidth
      onPress={print}
      loading={busy || waiting}
      disabled={!order}
    />
  );
}
