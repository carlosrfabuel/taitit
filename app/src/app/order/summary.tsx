import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function OrderSummaryScreen() {
  return (
    <Placeholder title="Order summary" note="Image, zones, references and notes (Day 16).">
      <NavLink href="/order/done" label="Confirm order" />
    </Placeholder>
  );
}
