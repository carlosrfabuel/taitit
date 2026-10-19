import { orderSheet, orderSheetName, type SheetOrder } from '@taitit/shared';
import type { Database } from '@taitit/shared';
import { supabase } from './supabase';

type Enums = Database['public']['Enums'];

export type OrderItemRow = {
  zone_name: string;
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
  order_items: OrderItemRow[];
};

export const orderKeys = {
  all: ['orders'] as const,
  one: (id: string) => ['orders', id] as const,
};

const COLUMNS =
  'id, number, created_at, model_name, notes, shop_ref, image_path, customer_name, customer_email, business_name, legal_name, tax_id, phone, address, postal_code, city, province, order_items(zone_name, material, swatch_name, hex, ref, finish, kind, alpha, texture_path, sort_order)';

/** Order date and time in Spain (where TAITIT reads them). */
export const formatOrderDate = (iso: string) =>
  new Date(iso).toLocaleString('es-ES', {
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
  notes: o.notes,
  customerName: o.customer_name,
  customerEmail: o.customer_email,
  businessName: o.business_name,
  legalName: o.legal_name,
  taxId: o.tax_id,
  phone: o.phone,
  address: o.address,
  postalCode: o.postal_code,
  city: o.city,
  province: o.province,
  items: o.order_items.map((i) => ({
    zoneName: i.zone_name,
    material: i.material,
    swatchName: i.swatch_name,
    ref: i.ref,
    hex: i.hex,
    finish: i.finish,
    kind: i.kind,
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
    'pedidos.xlsx',
  );
}

/** The order image, saved as pedido-<number>.jpg. */
export async function downloadOrderImage(o: OrderRow) {
  if (!o.image_path) return;
  const { data, error } = await supabase.storage.from('orders').download(o.image_path);
  if (error) throw error;
  saveFile(data, `pedido-${o.number}.jpg`);
}
