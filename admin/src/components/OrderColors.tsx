import { Swatch } from './ui';
import { textureUrl } from '../lib/swatches';
import { swatchLabel } from '../lib/labels';
import type { OrderItemRow } from '../lib/orders';

/** An order's colors as small chips, in part order (main, secondary, tips), for lists. */
export function OrderColors({ items }: { items: OrderItemRow[] }) {
  return (
    <span className="flex items-center gap-1">
      {items.map((i) => (
        <Swatch
          key={`${i.sort_order}-${i.zone_name}`}
          hex={i.hex}
          alpha={i.kind === 'translucent' ? i.alpha : null}
          textureUrl={i.texture_path ? textureUrl(i) : null}
          title={`${i.zone_name}: ${swatchLabel({ name: i.swatch_name, ref: i.ref })}`}
          size={18}
        />
      ))}
    </span>
  );
}
