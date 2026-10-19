import { NavLink } from '@/components/NavLink';
import { Placeholder } from '@/components/Placeholder';

export default function OrderSummaryScreen() {
  return (
    <Placeholder
      title="Order summary"
      note="Coming soon: design image, colors per part, references and notes."
    >
      <NavLink href="/order/done" label="Confirm order" />
    </Placeholder>
  );
}
