import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';

// Spare parts (Carlos, 2026-10-28): the optician picks a model, then the front side or a temple (left,
// right or both), adds exactly 3 photos of the problem and an optional note, and sends it. No status:
// TAITIT's warehouse or the area's sales rep contacts them. The server (create_spare_part_request)
// checks the account, the model, the part and that the 3 photos are in the optician's own folder.

export type SparePart = 'front' | 'temple';
export type TempleSide = 'left' | 'right' | 'both';

export const PHOTOS_REQUIRED = 3;
export const NOTE_MAX = 500;
/** Photos are sent at most this many pixels on their longest side (a phone photo is 4000+). */
const PHOTO_MAX_SIDE = 1600;
const BUCKET = 'spare-parts';

export const PART_LABEL: Record<SparePart, string> = { front: 'Front side', temple: 'Temple' };
export const SIDE_LABEL: Record<TempleSide, string> = { left: 'Left', right: 'Right', both: 'Both' };

/** "Front side", "Left temple", "Right temple", "Both temples". */
export function partSummary(part: SparePart, side: TempleSide | null): string {
  if (part === 'front') return 'Front side';
  if (side === 'both') return 'Both temples';
  return `${side === 'right' ? 'Right' : 'Left'} temple`;
}

export type SparePartRequest = {
  id: string;
  number: number;
  createdAt: string;
  modelName: string;
  part: SparePart;
  side: TempleSide | null;
  note: string | null;
  /** The 3 photos' files (stable: images are cached by these, the links change). */
  photoPaths: string[];
  /** Temporary links (an hour) to the 3 photos; null where a link couldn't be made. */
  photoUrls: (string | null)[];
};

export const sparePartKeys = {
  all: ['spare-parts'] as const,
  list: (userId: string) => ['spare-parts', userId, 'list'] as const,
  one: (userId: string, id: string) => ['spare-parts', userId, id] as const,
};

const COLUMNS = 'id, number, created_at, model_name, part, side, note, photo_paths';
type Row = {
  id: string;
  number: number;
  created_at: string;
  model_name: string;
  part: SparePart;
  side: TempleSide | null;
  note: string | null;
  photo_paths: string[];
};

async function withPhotoLinks(rows: Row[]): Promise<SparePartRequest[]> {
  const paths = rows.flatMap((r) => r.photo_paths);
  const links = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
    for (const l of data ?? []) if (l.path && l.signedUrl) links.set(l.path, l.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    createdAt: r.created_at,
    modelName: r.model_name,
    part: r.part,
    side: r.side,
    note: r.note,
    photoPaths: r.photo_paths,
    photoUrls: r.photo_paths.map((p) => links.get(p) ?? null),
  }));
}

/** The optician's requests, newest first. */
export async function fetchSparePartRequests(userId: string): Promise<SparePartRequest[]> {
  const { data, error } = await supabase
    .from('spare_part_requests')
    .select(COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return withPhotoLinks((data ?? []) as Row[]);
}

export async function fetchSparePartRequest(userId: string, id: string): Promise<SparePartRequest | null> {
  const { data, error } = await supabase
    .from('spare_part_requests')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? (await withPhotoLinks([data as Row]))[0]! : null;
}

/** A picked or taken photo, ready to send: shrunk, as JPEG, with a preview of the same file. */
export type PreparedPhoto = {
  key: string;
  previewUri: string;
  width: number;
  height: number;
  bytes: Uint8Array;
};

const base64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

/** Shrinks a photo to at most 1600 px on its longest side and saves it as JPEG. */
export async function preparePhoto(
  key: string,
  uri: string,
  width: number,
  height: number,
): Promise<PreparedPhoto> {
  const context = ImageManipulator.manipulate(uri);
  // Both sides as numbers: the web version takes `null` as 0 (only `undefined` means "keep the ratio").
  // Sizes may be unknown (0) on some platforms: then the photo is shrunk by its width.
  if (!width || !height) context.resize({ width: PHOTO_MAX_SIDE });
  else if (Math.max(width, height) > PHOTO_MAX_SIDE) {
    const scale = PHOTO_MAX_SIDE / Math.max(width, height);
    context.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new Error('photo_failed');
  return {
    key,
    previewUri: saved.uri,
    width: saved.width,
    height: saved.height,
    bytes: base64ToBytes(saved.base64),
  };
}

const isAlreadyThere = (error: { message?: string; statusCode?: string }) =>
  error.statusCode === '409' || /already exists|duplicate/i.test(error.message ?? '');

/** Uploads a photo to the optician's folder. A retry finds it already there (same key): that is done. */
async function uploadPhoto(userId: string, photo: PreparedPhoto): Promise<void> {
  const body = photo.bytes.buffer.slice(
    photo.bytes.byteOffset,
    photo.bytes.byteOffset + photo.bytes.byteLength,
  ) as ArrayBuffer;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(`${userId}/${photo.key}.jpg`, body, { contentType: 'image/jpeg', upsert: false });
  if (error && !isAlreadyThere(error)) throw error;
}

/**
 * Sends a request: the photos first, then the request itself. `key` stays the same for retries of the
 * same attempt, so a lost answer never creates a second request.
 */
export async function sendSparePartRequest(input: {
  userId: string;
  key: string;
  modelId: string;
  part: SparePart;
  side: TempleSide | null;
  photos: PreparedPhoto[];
  note: string;
}): Promise<{ id: string; number: number }> {
  if (input.photos.length !== PHOTOS_REQUIRED) throw new Error('spare_part_photos_missing');
  await Promise.all(input.photos.map((p) => uploadPhoto(input.userId, p)));
  const { data, error } = await supabase.rpc('create_spare_part_request', {
    p_key: input.key,
    p_model_id: input.modelId,
    p_part: input.part,
    // The front has no side: null (the generated types can't express a nullable argument).
    p_side: (input.part === 'temple' ? input.side : null) as TempleSide,
    p_photo_keys: input.photos.map((p) => p.key),
    p_note: input.note.trim() || undefined,
  });
  if (error) throw error;
  const result = data as { id: string; number: number };
  return { id: result.id, number: result.number };
}

/** What the optician is told when sending fails. */
export function sparePartErrorMessage(e: unknown): string {
  const message = (e as { message?: string } | null)?.message ?? '';
  if (message.includes('account_not_approved')) return 'Your account is not approved yet.';
  if (message.includes('business_details_missing')) return 'Add your business details first.';
  if (message.includes('spare_part_model_unavailable')) return 'This model is no longer available.';
  if (message.includes('spare_part_photos_missing')) return 'Add 3 photos, then send again.';
  if (message.includes('spare_part_note_too_long')) return `The note can have up to ${NOTE_MAX} characters.`;
  return "Couldn't send the request. Check your connection and try again.";
}
