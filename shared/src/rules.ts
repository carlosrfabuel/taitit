import type { Finish, Material, OrderStatus, Swatch } from './types';

/** Contract limit: at most 4 customizable zones per model. */
export const MAX_ZONES_PER_MODEL = 4;

export const ORDER_STATUSES: OrderStatus[] = ['received', 'in_production', 'ready', 'delivered'];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'Recibido',
  in_production: 'En producción',
  ready: 'Listo',
  delivered: 'Entregado',
};

export const MATERIAL_LABEL: Record<Material, string> = {
  metal: 'Metal',
  acetate: 'Acetato',
};

export const FINISH_LABEL: Record<Finish, string> = {
  gloss: 'Brillo',
  matte: 'Mate',
};

export const nextStatus = (s: OrderStatus): OrderStatus | null => {
  const i = ORDER_STATUSES.indexOf(s);
  return ORDER_STATUSES[i + 1] ?? null;
};

/** Only swatches of the zone's material, active, in display order. */
export const paletteFor = (swatches: Swatch[], material: Material): Swatch[] =>
  swatches.filter((s) => s.material === material && s.active).sort((a, b) => a.sortOrder - b.sortOrder);
