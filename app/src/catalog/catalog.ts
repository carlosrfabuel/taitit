import {
  buildRenderPlan,
  renderKey,
  type Finish,
  type Material,
  type RenderPlan,
  type SwatchKind,
  type ZoneRole,
} from '@taitit/shared';
import { supabase } from '@/lib/supabase';

const storageUrl = (bucket: 'models' | 'textures', path: string) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

export type CatalogSwatch = {
  id: string;
  material: Material;
  name: string;
  ref: string;
  hex: string;
  kind: SwatchKind;
  alpha: number | null;
  textureUrl: string | null;
  /** Storage path of the texture (stored with an order). */
  texturePath: string | null;
  finishes: Finish[];
  sortOrder: number;
};

export type CatalogZone = {
  id: string;
  name: string;
  material: Material;
  layerUrl: string | null;
  defaultSwatchId: string | null;
  defaultFinish: Finish | null;
  sortOrder: number;
  /** Main metal, secondary front or tips (Carlos, 2026-10-20); null on zones not set up yet. */
  role: ZoneRole | null;
  /** Tortoiseshell pattern for havana colors (acetate zones), see shared/src/render.ts. */
  patternUrl: string | null;
  patternHex: string | null;
  patternOwn: boolean;
};

export type CatalogModel = {
  id: string;
  name: string;
  category: string;
  sizeRef: string | null;
  description: string | null;
  zones: CatalogZone[];
  /** Default colors, ready for RecolorView. */
  plan: RenderPlan;
  /** The admin's thumbnail, only when it shows exactly the current defaults (see thumbnails migration). */
  thumbUrl: string | null;
};

export const catalogKeys = { all: ['catalog'] as const, swatches: ['swatches'] as const };

/** Active colors (customers can only read active ones). Shared with the customizer. */
export async function fetchSwatches(): Promise<CatalogSwatch[]> {
  const { data, error } = await supabase
    .from('swatches')
    .select('id, material, name, ref, hex, kind, alpha, texture_path, finishes, sort_order')
    .eq('active', true)
    .order('sort_order')
    .order('name');
  if (error) throw error;
  return data.map((s) => ({
    id: s.id,
    material: s.material,
    name: s.name,
    ref: s.ref,
    hex: s.hex,
    kind: s.kind,
    alpha: s.alpha,
    textureUrl: s.texture_path ? storageUrl('textures', s.texture_path) : null,
    texturePath: s.texture_path,
    finishes: s.finishes,
    sortOrder: s.sort_order,
  }));
}

/** Published models in alphabetical order (client decision 2026-10-20), each with its default-color plan. */
export async function fetchCatalog(swatches: CatalogSwatch[]): Promise<CatalogModel[]> {
  const { data, error } = await supabase
    .from('models')
    .select(
      // One literal string: the client infers the row type from it.
      'id, name, category, size_ref, description, base_path, base_width, base_height, thumb_path, thumb_key, model_zones(id, name, material, layer_path, default_swatch_id, default_finish, sort_order, role, pattern_path, pattern_hex, pattern_own)',
    )
    .eq('published', true)
    .order('name');
  if (error) throw error;
  const result: CatalogModel[] = [];
  for (const m of data) {
    // Published models always have these (database rule); skip defensively if not.
    if (!m.base_path || !m.base_width || !m.base_height) continue;
    const zones: CatalogZone[] = m.model_zones
      .map((z) => ({
        id: z.id,
        name: z.name,
        material: z.material,
        layerUrl: z.layer_path ? storageUrl('models', z.layer_path) : null,
        defaultSwatchId: z.default_swatch_id,
        defaultFinish: z.default_finish,
        sortOrder: z.sort_order,
        role: z.role,
        patternUrl: z.pattern_path ? storageUrl('models', z.pattern_path) : null,
        patternHex: z.pattern_hex,
        patternOwn: z.pattern_own,
      }))
      // Same order as the renderer and the order function: sort order, then id.
      .sort((a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const plan = buildRenderPlan({
      baseUrl: storageUrl('models', m.base_path),
      width: m.base_width,
      height: m.base_height,
      zones,
      swatches,
    });
    result.push({
      id: m.id,
      name: m.name,
      category: m.category,
      sizeRef: m.size_ref,
      description: m.description,
      zones,
      plan,
      thumbUrl: m.thumb_path && m.thumb_key === renderKey(plan) ? storageUrl('models', m.thumb_path) : null,
    });
  }
  return result;
}

/** Material of the model's secondary front (metal or acetate; every model has one), for the catalog filter. */
export const frontMaterial = (model: Pick<CatalogModel, 'zones'>): Material | null =>
  model.zones.find((z) => z.role === 'secondary')?.material ?? null;

const ROLE_ORDER: ZoneRole[] = ['main', 'secondary', 'tips'];

/** The model's default colors in part order (main, secondary front, tips), for the catalog cards. */
export function defaultColors(
  model: Pick<CatalogModel, 'zones'>,
  swatches: CatalogSwatch[],
): CatalogSwatch[] {
  const byId = new Map(swatches.map((s) => [s.id, s]));
  return [...model.zones]
    .sort((a, b) => ROLE_ORDER.indexOf(a.role ?? 'tips') - ROLE_ORDER.indexOf(b.role ?? 'tips'))
    .map((z) => (z.defaultSwatchId ? byId.get(z.defaultSwatchId) : undefined))
    .filter((s): s is CatalogSwatch => !!s);
}

/** Categories present in the catalog, in first-seen (catalog) order. */
export const categoriesOf = (models: CatalogModel[]) => [
  ...new Set(models.map((m) => m.category.trim()).filter(Boolean)),
];

/** Case- and accent-insensitive name search. */
export function matchesSearch(model: CatalogModel, query: string) {
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const q = norm(query.trim());
  return !q || norm(model.name).includes(q);
}
