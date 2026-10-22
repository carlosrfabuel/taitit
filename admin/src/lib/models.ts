import { supabase } from './supabase';
import { removeImages, uploadImage, type Size } from './images';

/** Same limits as the check constraints on public.models. */
export const MODEL_LIMITS = { name: 60, category: 60, sizeRef: 30, description: 1000 } as const;

export type ModelRow = {
  id: string;
  name: string;
  category: string;
  size_ref: string | null;
  description: string | null;
  base_path: string | null;
  base_width: number | null;
  base_height: number | null;
  thumb_path: string | null;
  thumb_key: string | null;
  published: boolean;
  sort_order: number;
  zones: number;
};

export type ModelInput = {
  name: string;
  category: string;
  size_ref: string;
  description: string;
  published: boolean;
};

export const modelKeys = {
  all: ['models'] as const,
  one: (id: string) => ['models', id] as const,
  problems: (id: string) => ['models', id, 'problems'] as const,
  zones: (id: string) => ['models', id, 'zones'] as const,
  /** All zones of all models (under ['models'], so every model change refreshes it). */
  allZones: ['models', 'all-zones'] as const,
};

const COLUMNS =
  'id, name, category, size_ref, description, base_path, base_width, base_height, thumb_path, thumb_key, published, sort_order, model_zones(count)';

type Raw = Omit<ModelRow, 'zones'> & { model_zones: { count: number }[] };
const toRow = ({ model_zones, ...m }: Raw): ModelRow => ({ ...m, zones: model_zones[0]?.count ?? 0 });

export async function listModels(): Promise<ModelRow[]> {
  // Alphabetical, like the app (client decision 2026-10-20).
  const { data, error } = await supabase.from('models').select(COLUMNS).order('name');
  if (error) throw error;
  return (data as Raw[]).map(toRow);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getModel(id: string): Promise<ModelRow | null> {
  if (!UUID.test(id)) return null; // a mistyped link: "not found", not a database error
  const { data, error } = await supabase.from('models').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toRow(data as Raw) : null;
}

export type FieldErrors = Partial<Record<keyof ModelInput, string>>;

export function validateModel(input: ModelInput): FieldErrors {
  const e: FieldErrors = {};
  const name = input.name.trim();
  if (!name) e.name = 'Enter the model name.';
  else if (name.length > MODEL_LIMITS.name) e.name = `Maximum ${MODEL_LIMITS.name} characters.`;
  if (input.category.trim().length > MODEL_LIMITS.category)
    e.category = `Maximum ${MODEL_LIMITS.category} characters.`;
  if (input.size_ref.trim().length > MODEL_LIMITS.sizeRef)
    e.size_ref = `Maximum ${MODEL_LIMITS.sizeRef} characters.`;
  if (input.description.trim().length > MODEL_LIMITS.description)
    e.description = `Maximum ${MODEL_LIMITS.description} characters.`;
  return e;
}

const toColumns = (input: ModelInput) => ({
  name: input.name.trim(),
  category: input.category.trim(),
  size_ref: input.size_ref.trim() || null,
  description: input.description.trim() || null,
  published: input.published,
});

/** Creates a model at the end of the list; returns its id. */
export async function createModel(input: ModelInput): Promise<string> {
  const last = await supabase
    .from('models')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (last.error) throw last.error;
  const { data, error } = await supabase
    .from('models')
    .insert({ ...toColumns(input), sort_order: (last.data?.sort_order ?? -1) + 1 })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

/**
 * Saves the form. `published` is only written when the admin changed it in this form: otherwise a
 * form opened before the model was published elsewhere (another tab, tools/zones) would unpublish it.
 */
export async function updateModel(id: string, input: ModelInput, publishedChanged: boolean): Promise<void> {
  const { published, ...rest } = toColumns(input);
  const columns = publishedChanged ? { ...rest, published } : rest;
  // .select() so a row hidden by RLS (or deleted meanwhile) is reported instead of silently skipped.
  const { data, error } = await supabase.from('models').update(columns).eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Model not found' };
}

/** Replaces the base image: new file first, then the row, then the old file is removed. */
export async function setBaseImage(model: ModelRow, file: File, size: Size): Promise<void> {
  // The path stored now (the screen may be out of date if it changed in another tab or the CLI).
  const current = await supabase.from('models').select('base_path').eq('id', model.id).maybeSingle();
  if (current.error) throw current.error;
  if (!current.data) throw { code: 'not_found', message: 'Model not found' };
  const path = await uploadImage(model.id, 'base', file);
  const { data, error } = await supabase
    .from('models')
    .update({ base_path: path, base_width: size.width, base_height: size.height })
    .eq('id', model.id)
    .select('id');
  if (error || !data.length) {
    await removeImages([path]); // the database said no: don't leave the new file behind
    throw error ?? { code: 'not_found', message: 'Model not found' };
  }
  if (current.data.base_path !== path) await removeImages([current.data.base_path]);
}

/** What still blocks publishing (codes from the database check, see the publish_rules migration). */
export async function publishProblems(id: string): Promise<string[]> {
  const { data, error } = await supabase.rpc('model_publish_problems', { p_model_id: id });
  if (error) throw error;
  return data ?? [];
}

/** Deletes the model (zones cascade, customers' saved designs too; orders keep their snapshot) and its files. */
export async function deleteModel(model: ModelRow, layerPaths: (string | null)[]): Promise<void> {
  // The paths stored now: the screen may be behind (e.g. a thumbnail the preview just replaced).
  const { data, error } = await supabase
    .from('models')
    .delete()
    .eq('id', model.id)
    .select('base_path, thumb_path');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Model not found' };
  // Everything the panel uploaded lives under "<model id>/"; tools/zones files are referenced by path.
  const folder = await supabase.storage.from('models').list(model.id, { limit: 1000 });
  const inFolder = (folder.data ?? []).map((f) => `${model.id}/${f.name}`);
  await removeImages([data[0]!.base_path, data[0]!.thumb_path, ...layerPaths, ...inFolder]);
}

type Sortable = { id: string; sort_order: number };

/** Moves one row up or down; renumbers the whole list 0..n-1 so ties (all 0) can't block a move. */
export function reorder<T extends Sortable>(rows: T[], index: number, direction: -1 | 1): T[] {
  const target = index + direction;
  if (target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((r, i) => ({ ...r, sort_order: i }));
}

/** Saves the sort_order of every row that changed. */
export async function saveOrder(
  table: 'models' | 'model_zones' | 'swatches',
  before: Sortable[],
  after: Sortable[],
): Promise<void> {
  const old = new Map(before.map((r) => [r.id, r.sort_order]));
  const changed = after.filter((r) => old.get(r.id) !== r.sort_order);
  const results = await Promise.all(
    changed.map((r) => supabase.from(table).update({ sort_order: r.sort_order }).eq('id', r.id).select('id')),
  );
  const failed = results.find((r) => r.error || !r.data?.length);
  if (failed) throw failed.error ?? { code: 'not_found', message: 'Not found' };
}
