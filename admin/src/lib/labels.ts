import type { Finish, Material } from '@taitit/shared';

// The admin panel is in Spanish (for TAITIT's staff); the app uses the English labels from shared.
export const MATERIAL_LABEL: Record<Material, string> = { metal: 'Metal', acetate: 'Acetato' };
export const FINISH_LABEL: Record<Finish, string> = { gloss: 'Brillo', matte: 'Mate' };
