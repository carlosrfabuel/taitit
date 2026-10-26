// Explicit .ts extensions: the file also runs unbundled (Node in the tests, Deno for the email).
import type { Finish, ZoneRole } from './types.ts';
import { buildXlsx, type Cell } from './xlsx.ts';

// The order as a spreadsheet for TAITIT's accounting. One row per frame of the order (an order holds
// one or more frames since 2026-10-26) with the columns Carlos listed (2026-10-20), headers in his
// words: the optician's details from registration (company name … single labeling, in his order),
// then the frame's (model, main colour, secondary colour, end tips colour, quantity). Order number and
// date go first so rows can be matched; notes last. The same file is downloaded in the admin panel and
// attached to the order email.

export type SheetOrder = {
  number: number;
  createdAt: string;
  notes: string | null;
  /** The optician as copied into the order (orders before 2026-10-21 have no delivery, commercial
   * address, bank account or labeling: those cells stay empty). */
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  deliveryAddress: string | null;
  bankAccount: string | null;
  businessName: string | null;
  commercialAddress: string | null;
  phone: string | null;
  email: string | null;
  contact: string | null;
  labeling: string | null;
  /** The frames, in order: one row each. */
  lines: SheetLine[];
};

export type SheetLine = {
  modelName: string;
  quantity: number;
  items: {
    /** Null on orders placed before zones had roles: then the part's position decides. */
    zoneRole: ZoneRole | null;
    swatchName: string;
    ref: string;
    finish: Finish | null;
    sortOrder: number;
  }[];
};

const FINISH: Record<Finish, string> = { gloss: 'gloss', matte: 'matte' };

export const ORDER_SHEET_COLUMNS = [
  'Order',
  'Date',
  'Company name',
  'VAT number',
  'Address',
  'Delivery address',
  'Bank account',
  'Commercial name',
  'Commercial address',
  'Phone',
  'Email',
  'Contact',
  'Single labeling for entire order',
  'Model',
  'Main colour',
  'Secondary colour',
  'End tips colour',
  'Quantity',
  'Notes',
] as const;

/** Date as day/month/year in Spain's time zone (what TAITIT reads), e.g. 19/10/2026. */
export const sheetDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', {
    timeZone: 'Europe/Madrid',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

/** A part's colour in one cell: the number and finish, e.g. "38 (gloss)". Colours have no names
 * (Carlos, 2026-10-21): each client and sales rep has a sample set with the numbers. */
export const sheetColour = (i: SheetLine['items'][number]) =>
  `${i.ref}${i.finish ? ` (${FINISH[i.finish]})` : ''}`;

const ROLES: ZoneRole[] = ['main', 'secondary', 'tips'];

/** The part for each role: by its role, or (older orders) by position: 1st main, 2nd secondary, 3rd tips. */
function byRole(items: SheetLine['items']): Record<ZoneRole, SheetLine['items'][number] | undefined> {
  const sorted = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const withRoles = sorted.some((i) => i.zoneRole);
  return Object.fromEntries(
    ROLES.map((role, n) => [role, withRoles ? sorted.find((i) => i.zoneRole === role) : sorted[n]]),
  ) as Record<ZoneRole, SheetLine['items'][number] | undefined>;
}

export function orderSheetRows(orders: SheetOrder[]): Cell[][] {
  const rows: Cell[][] = [[...ORDER_SHEET_COLUMNS]];
  for (const o of orders)
    for (const line of o.lines) {
      const parts = byRole(line.items);
      const colour = (role: ZoneRole) => {
        const part = parts[role];
        return part ? sheetColour(part) : null;
      };
      rows.push([
        o.number,
        sheetDate(o.createdAt),
        o.legalName,
        o.taxId,
        o.address,
        o.deliveryAddress,
        o.bankAccount,
        o.businessName,
        o.commercialAddress,
        o.phone,
        o.email,
        o.contact,
        o.labeling,
        line.modelName,
        colour('main'),
        colour('secondary'),
        colour('tips'),
        line.quantity,
        o.notes,
      ]);
    }
  return rows;
}

/** The .xlsx file for one or more orders. */
export const orderSheet = (orders: SheetOrder[]) =>
  buildXlsx(orderSheetRows(orders), orders.length === 1 ? `Order ${orders[0]!.number}` : 'Orders');

export const orderSheetName = (number: number) => `order-${number}.xlsx`;
