// Explicit .ts extensions: the file also runs unbundled (Node in the tests, Deno for the email).
import type { Finish, Material, SwatchKind } from './types.ts';
import { buildXlsx, type Cell } from './xlsx.ts';

// The order as a spreadsheet for TAITIT's accounting (client decision 2026-10-19): one row per
// part, with the order and the optician repeated on every row (imports cleanly). The same file is
// downloaded in the admin panel and attached to the order email. ⏳ Columns to be confirmed by the
// client; changing them only touches this file.

export type SheetOrder = {
  number: number;
  createdAt: string;
  modelName: string;
  notes: string | null;
  customerName: string | null;
  customerEmail: string | null;
  businessName: string | null;
  legalName: string | null;
  taxId: string | null;
  phone: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  items: {
    zoneName: string;
    material: Material;
    swatchName: string;
    ref: string;
    hex: string;
    finish: Finish | null;
    kind: SwatchKind;
  }[];
};

const MATERIAL: Record<Material, string> = { metal: 'Metal', acetate: 'Acetato' };
const FINISH: Record<Finish, string> = { gloss: 'Brillo', matte: 'Mate' };
const KIND: Record<SwatchKind, string> = {
  metal: 'Metal',
  solid: 'Sólido',
  translucent: 'Translúcido',
  havana: 'Carey',
};

export const ORDER_SHEET_COLUMNS = [
  'Pedido',
  'Fecha',
  'Óptica',
  'Razón social',
  'CIF/NIF',
  'Teléfono',
  'Dirección',
  'CP',
  'Ciudad',
  'Provincia',
  'Contacto',
  'Email',
  'Modelo',
  'Pieza',
  'Material',
  'Color',
  'Referencia',
  'Acabado',
  'Tipo',
  'HEX',
  'Notas',
] as const;

/** Date as day/month/year in Spain's time zone (what TAITIT reads), e.g. 19/10/2026. */
export const sheetDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export function orderSheetRows(orders: SheetOrder[]): Cell[][] {
  const rows: Cell[][] = [[...ORDER_SHEET_COLUMNS]];
  for (const o of orders) {
    for (const i of o.items) {
      rows.push([
        o.number,
        sheetDate(o.createdAt),
        o.businessName,
        o.legalName,
        o.taxId,
        o.phone,
        o.address,
        o.postalCode,
        o.city,
        o.province,
        o.customerName,
        o.customerEmail,
        o.modelName,
        i.zoneName,
        MATERIAL[i.material],
        i.swatchName,
        i.ref,
        i.finish ? FINISH[i.finish] : null,
        KIND[i.kind],
        i.hex,
        o.notes,
      ]);
    }
  }
  return rows;
}

/** The .xlsx file for one or more orders. */
export const orderSheet = (orders: SheetOrder[]) =>
  buildXlsx(orderSheetRows(orders), orders.length === 1 ? `Pedido ${orders[0]!.number}` : 'Pedidos');

export const orderSheetName = (number: number) => `pedido-${number}.xlsx`;
