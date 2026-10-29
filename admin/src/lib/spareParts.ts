import { supabase } from './supabase';

// Spare part requests sent from the app (Carlos, 2026-10-28): model, part (front side or a temple),
// 3 photos and a note, with a copy of the optician's details. No status: the warehouse or the area's
// sales rep contacts the optician, so the panel only shows them.

export type SparePart = 'front' | 'temple';
export type TempleSide = 'left' | 'right' | 'both';

export type SparePartRow = {
  id: string;
  number: number;
  created_at: string;
  user_id: string | null;
  model_id: string | null;
  model_name: string;
  part: SparePart;
  side: TempleSide | null;
  note: string | null;
  photo_paths: string[];
  customer_name: string | null;
  customer_email: string | null;
  business_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  contact_email: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
  delivery_address: string | null;
  delivery_postal_code: string | null;
  delivery_city: string | null;
  delivery_province: string | null;
};

export const sparePartKeys = {
  all: ['spare-parts'] as const,
  photos: (paths: string[]) => ['spare-parts', 'photos', paths] as const,
};

export const SPARE_PARTS_LIMIT = 200;

/** "Front side", "Left temple", "Right temple", "Both temples". */
export function partSummary(part: SparePart, side: TempleSide | null): string {
  if (part === 'front') return 'Front side';
  if (side === 'both') return 'Both temples';
  return `${side === 'right' ? 'Right' : 'Left'} temple`;
}

/** Every request, newest first (admins read all: database rule). */
export async function listSparePartRequests(): Promise<SparePartRow[]> {
  const { data, error } = await supabase
    .from('spare_part_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(SPARE_PARTS_LIMIT);
  if (error) throw error;
  return data as SparePartRow[];
}

/** Temporary links (an hour) to private photos, by path. */
export async function sparePartPhotoUrls(paths: string[]): Promise<Map<string, string>> {
  const urls = new Map<string, string>();
  if (paths.length === 0) return urls;
  const { data, error } = await supabase.storage.from('spare-parts').createSignedUrls(paths, 3600);
  if (error) throw error;
  for (const u of data ?? []) if (u.path && u.signedUrl && !u.error) urls.set(u.path, u.signedUrl);
  return urls;
}

/** Requests matching a search: number, optician, email, city or model. */
export function filterSparePartRequests(rows: SparePartRow[], query: string): SparePartRow[] {
  const q = query.trim().toLowerCase().replace(/^#/, '');
  if (!q) return rows;
  return rows.filter((r) =>
    [
      String(r.number),
      r.business_name,
      r.customer_name,
      r.customer_email,
      r.contact_email,
      r.city,
      r.model_name,
      r.tax_id,
    ].some((v) => v?.toLowerCase().includes(q)),
  );
}
