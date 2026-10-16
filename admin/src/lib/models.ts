import { supabase } from './supabase';

/** Same limits as the check constraints on public.models. */
export const MODEL_LIMITS = { name: 60, category: 60, sizeRef: 30, description: 1000 } as const;

export type ModelRow = {
  id: string;
  name: string;
  category: string;
  size_ref: string | null;
  description: string | null;
  base_path: string | null;
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
};

const COLUMNS =
  'id, name, category, size_ref, description, base_path, published, sort_order, model_zones(count)';

type Raw = Omit<ModelRow, 'zones'> & { model_zones: { count: number }[] };
const toRow = ({ model_zones, ...m }: Raw): ModelRow => ({ ...m, zones: model_zones[0]?.count ?? 0 });

export async function listModels(): Promise<ModelRow[]> {
  const { data, error } = await supabase.from('models').select(COLUMNS).order('sort_order').order('name');
  if (error) throw error;
  return (data as Raw[]).map(toRow);
}

export async function getModel(id: string): Promise<ModelRow | null> {
  const { data, error } = await supabase.from('models').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? toRow(data as Raw) : null;
}

export type FieldErrors = Partial<Record<keyof ModelInput, string>>;

export function validateModel(input: ModelInput): FieldErrors {
  const e: FieldErrors = {};
  const name = input.name.trim();
  if (!name) e.name = 'Introduce el nombre del modelo.';
  else if (name.length > MODEL_LIMITS.name) e.name = `Máximo ${MODEL_LIMITS.name} caracteres.`;
  if (input.category.trim().length > MODEL_LIMITS.category)
    e.category = `Máximo ${MODEL_LIMITS.category} caracteres.`;
  if (input.size_ref.trim().length > MODEL_LIMITS.sizeRef)
    e.size_ref = `Máximo ${MODEL_LIMITS.sizeRef} caracteres.`;
  if (input.description.trim().length > MODEL_LIMITS.description)
    e.description = `Máximo ${MODEL_LIMITS.description} caracteres.`;
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

export async function updateModel(id: string, input: ModelInput): Promise<void> {
  // .select() so a row hidden by RLS (or deleted meanwhile) is reported instead of silently skipped.
  const { data, error } = await supabase.from('models').update(toColumns(input)).eq('id', id).select('id');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Model not found' };
}

/** Moves one model up or down; renumbers the whole list 0..n-1 so ties (all 0) can't block a move. */
export function reorder(rows: ModelRow[], index: number, direction: -1 | 1): ModelRow[] {
  const target = index + direction;
  if (target < 0 || target >= rows.length) return rows;
  const next = [...rows];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next.map((r, i) => ({ ...r, sort_order: i }));
}

/** Saves the sort_order of every row that changed. */
export async function saveOrder(before: ModelRow[], after: ModelRow[]): Promise<void> {
  const old = new Map(before.map((r) => [r.id, r.sort_order]));
  const changed = after.filter((r) => old.get(r.id) !== r.sort_order);
  const results = await Promise.all(
    changed.map((r) =>
      supabase.from('models').update({ sort_order: r.sort_order }).eq('id', r.id).select('id'),
    ),
  );
  const failed = results.find((r) => r.error || !r.data?.length);
  if (failed) throw failed.error ?? { code: 'not_found', message: 'Model not found' };
}
