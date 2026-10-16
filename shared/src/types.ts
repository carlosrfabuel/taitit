export type Material = 'metal' | 'acetate';
export type Finish = 'gloss' | 'matte';
export type SwatchKind = 'metal' | 'solid' | 'translucent' | 'havana';
export type OrderStatus = 'received' | 'in_production' | 'ready' | 'delivered';

export type Swatch = {
  id: string;
  material: Material;
  name: string;
  hex: string;
  ref: string;
  kind: SwatchKind;
  /** Opacity for translucent acetates, 0..1. */
  alpha: number | null;
  /** Storage path of the tortoiseshell texture. */
  texturePath: string | null;
  finishes: Finish[];
  active: boolean;
  sortOrder: number;
};

export type ModelZone = {
  id: string;
  modelId: string;
  name: string;
  material: Material;
  layerPath: string;
  defaultSwatchId: string;
  defaultFinish: Finish | null;
  sortOrder: number;
};

export type GlassesModel = {
  id: string;
  name: string;
  category: string;
  sizeRef: string | null;
  description: string | null;
  basePath: string;
  published: boolean;
  sortOrder: number;
  zones: ModelZone[];
};

export type ZonePick = { swatchId: string; finish: Finish | null };

/** Zone id -> chosen swatch and finish. */
export type Selection = Record<string, ZonePick>;

// ---------------------------------------------------------------------------
// Compile-time guard: typecheck fails if these unions drift from the database enums
// (regenerate shared/src/database.types.ts with `npm run db:types` after schema changes).
// ---------------------------------------------------------------------------
import type { Database } from './database.types';

type DbEnums = Database['public']['Enums'];
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;

export type EnumsInSyncWithDatabase = [
  Assert<Same<Material, DbEnums['material']>>,
  Assert<Same<Finish, DbEnums['finish']>>,
  Assert<Same<SwatchKind, DbEnums['swatch_kind']>>,
  Assert<Same<OrderStatus, DbEnums['order_status']>>,
];
