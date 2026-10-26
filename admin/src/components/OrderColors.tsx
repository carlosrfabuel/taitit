import { Swatch } from './ui';
import { textureUrl } from '../lib/swatches';
import { swatchLabel } from '../lib/labels';
import type { OrderItemRow, OrderRow } from '../lib/orders';

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

/** Most frames listed with their colors in a list row; the rest are counted. */
const LINES_SHOWN = 3;

/**
 * An order's colors for lists: the chips alone for one frame; with several frames, one row per frame
 * (model and chips), the first few, then how many more.
 */
export function OrderLinesColors({ order }: { order: OrderRow }) {
  const lines = order.order_lines;
  if (lines.length === 1) return <OrderColors items={lines[0]!.order_items} />;
  return (
    <span className="flex flex-col gap-1">
      {lines.slice(0, LINES_SHOWN).map((l) => (
        <span key={l.id} className="flex items-center gap-2 text-xs">
          <span className="w-20 truncate font-semibold text-ink" title={l.model_name}>
            {l.model_name}
            {l.quantity > 1 ? ` ×${l.quantity}` : ''}
          </span>
          <OrderColors items={l.order_items} />
        </span>
      ))}
      {lines.length > LINES_SHOWN && (
        <span className="text-xs text-muted">+{lines.length - LINES_SHOWN} more</span>
      )}
    </span>
  );
}
