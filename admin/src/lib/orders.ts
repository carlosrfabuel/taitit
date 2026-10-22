import { orderSheet, orderSheetName, type SheetOrder } from '@taitit/shared';
import { addressLine } from './customers';
import { fold } from './text';
import type { Database } from '@taitit/shared';
import { supabase } from './supabase';

type Enums = Database['public']['Enums'];

export type OrderItemRow = {
  zone_name: string;
  zone_role: Enums['zone_role'] | null;
  material: Enums['material'];
  swatch_name: string;
  hex: string;
  ref: string;
  finish: Enums['finish'] | null;
  kind: Enums['swatch_kind'];
  alpha: number | null;
  texture_path: string | null;
  sort_order: number;
};

export type OrderRow = {
  id: string;
  number: number;
  created_at: string;
  model_name: string;
  quantity: number;
  notes: string | null;
  shop_ref: string | null;
  image_path: string | null;
  customer_name: string | null;
  customer_email: string | null;
  business_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  labeling: string | null;
  contact_email: string | null;
  bank_account: string | null;
  delivery_address: string | null;
  delivery_postal_code: string | null;
  delivery_city: string | null;
  delivery_province: string | null;
  commercial_address: string | null;
  commercial_postal_code: string | null;
  commercial_city: string | null;
  commercial_province: string | null;
  order_items: OrderItemRow[];
};

export const orderKeys = {
  all: ['orders'] as const,
  one: (id: string) => ['orders', id] as const,
  seen: ['orders', 'seen'] as const,
  since: (iso: string) => ['orders', 'since', iso] as const,
};

// "New" orders: sent after this browser last opened the order list. Kept per browser (no account
// setting): a convenience, so storage may be missing (private window) and then nothing is marked new.
const SEEN_KEY = 'taitit.admin.ordersSeenAt';

/** When this browser last saw the newest order (ISO), or null. */
export function ordersSeenAt(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markOrdersSeen(iso: string) {
  try {
    localStorage.setItem(SEEN_KEY, iso);
  } catch {
    // storage unavailable: nothing to remember
  }
}

/** How many orders were sent after `iso` (a count only: nothing is downloaded). */
export async function countOrdersSince(iso: string): Promise<number> {
  const { count, error } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .gt('created_at', iso);
  if (error) throw error;
  return count ?? 0;
}

export type OrderPeriod = 'all' | 'today' | 'week' | 'month';

export const PERIOD_LABEL: Record<OrderPeriod, string> = {
  all: 'All',
  today: 'Today',
  week: '7 days',
  month: '30 days',
};

/** The calendar day in Spain (YYYY-MM-DD), so "Today" means TAITIT's today. */
const madridDay = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });

/** Orders within the period whose number, optician, email, city, CIF or model contain the search. */
export function filterOrders(
  rows: OrderRow[],
  query: string,
  period: OrderPeriod,
  now = new Date(),
): OrderRow[] {
  const q = fold(query.trim().replace(/^#/, ''));
  const today = madridDay(now);
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 0;
  const from = now.getTime() - days * 86_400_000;
  return rows.filter((o) => {
    if (period === 'today' && madridDay(new Date(o.created_at)) !== today) return false;
    if (days && new Date(o.created_at).getTime() < from) return false;
    if (!q) return true;
    return [
      String(o.number),
      o.business_name,
      o.legal_name,
      o.customer_name,
      o.customer_email,
      o.contact_email,
      o.city,
      o.tax_id,
      o.model_name,
    ].some((v) => v && fold(v).includes(q));
  });
}

const COLUMNS =
  'id, number, created_at, model_name, quantity, notes, shop_ref, image_path, customer_name, customer_email, business_name, legal_name, tax_id, phone, address, postal_code, city, province, labeling, contact_email, bank_account, delivery_address, delivery_postal_code, delivery_city, delivery_province, commercial_address, commercial_postal_code, commercial_city, commercial_province, order_items(zone_name, zone_role, material, swatch_name, hex, ref, finish, kind, alpha, texture_path, sort_order)';

/** Order date and time in Spain (where TAITIT reads them). */
export const formatOrderDate = (iso: string) =>
  new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Europe/Madrid',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Newest orders shown in the list (more would need paging; order search is out of scope). */
export const ORDERS_LIMIT = 200;

const sortItems = (o: OrderRow): OrderRow => ({
  ...o,
  order_items: [...o.order_items].sort((a, b) => a.sort_order - b.sort_order),
});

/** All orders, newest first (admins read every order: database rule). */
export async function listOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(ORDERS_LIMIT);
  if (error) throw error;
  return (data as OrderRow[]).map(sortItems);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One order, or null if it doesn't exist (or the link is malformed). */
export async function getOrder(id: string): Promise<OrderRow | null> {
  if (!UUID.test(id)) return null;
  const { data, error } = await supabase.from('orders').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? sortItems(data as OrderRow) : null;
}

/** The storage file does not exist (Storage answers "Object not found"), as opposed to a failed request. */
export function isMissingFile(error: unknown): boolean {
  const e = error as { message?: string; statusCode?: string | number } | null;
  return /not.?found/i.test(e?.message ?? '') || String(e?.statusCode) === '404';
}

/** Temporary link to the private order image (an hour). */
export async function orderImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('orders').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export const toSheetOrder = (o: OrderRow): SheetOrder => ({
  number: o.number,
  createdAt: o.created_at,
  modelName: o.model_name,
  quantity: o.quantity,
  notes: o.notes,
  legalName: o.legal_name,
  taxId: o.tax_id,
  address: addressLine(o.address, o.postal_code, o.city, o.province),
  deliveryAddress: addressLine(
    o.delivery_address,
    o.delivery_postal_code,
    o.delivery_city,
    o.delivery_province,
  ),
  bankAccount: o.bank_account,
  businessName: o.business_name,
  commercialAddress: addressLine(
    o.commercial_address,
    o.commercial_postal_code,
    o.commercial_city,
    o.commercial_province,
  ),
  phone: o.phone,
  // Older orders have no contact email copy: the sign-in email was the contact then.
  email: o.contact_email ?? o.customer_email,
  contact: o.customer_name,
  labeling: o.labeling,
  items: o.order_items.map((i) => ({
    zoneRole: i.zone_role,
    swatchName: i.swatch_name,
    ref: i.ref,
    finish: i.finish,
    sortOrder: i.sort_order,
  })),
});

/** Saves a file from the browser. */
function saveFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked later: some browsers start the download asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** The order's Excel sheet (same file as the order email). */
export function downloadOrderSheet(o: OrderRow) {
  saveFile(
    new Blob([orderSheet([toSheetOrder(o)]) as Uint8Array<ArrayBuffer>], { type: XLSX_TYPE }),
    orderSheetName(o.number),
  );
}

/** Several orders in one sheet (one row per part). */
export function downloadOrdersSheet(orders: OrderRow[]) {
  saveFile(
    new Blob([orderSheet(orders.map(toSheetOrder)) as Uint8Array<ArrayBuffer>], { type: XLSX_TYPE }),
    'orders.xlsx',
  );
}

/** The order image, saved as order-<number>.jpg. */
export async function downloadOrderImage(o: OrderRow) {
  if (!o.image_path) return;
  const { data, error } = await supabase.storage.from('orders').download(o.image_path);
  if (error) throw error;
  saveFile(data, `order-${o.number}.jpg`);
}
