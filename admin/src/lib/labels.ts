import type { Finish, Material, SwatchKind, ZoneRole } from '@taitit/shared';

// The admin panel is in Spanish (for TAITIT's staff); the app uses the English labels from shared.
export const MATERIAL_LABEL: Record<Material, string> = { metal: 'Metal', acetate: 'Acetato' };

/** The three zones every model has (Carlos, 2026-10-20), as TAITIT calls them. */
export const ZONE_ROLE_LABEL: Record<ZoneRole, string> = {
  main: 'Metal principal',
  secondary: 'Frente secundario',
  tips: 'Terminales',
};
/** The zone's name in the app (English). */
export const ZONE_ROLE_APP_NAME: Record<ZoneRole, string> = {
  main: 'Main metal',
  secondary: 'Secondary front',
  tips: 'Tips',
};
/** Material fixed by the role (database rule): main metal is metal, tips are acetate. */
export const ZONE_ROLE_MATERIAL: Partial<Record<ZoneRole, Material>> = { main: 'metal', tips: 'acetate' };
export const FINISH_LABEL: Record<Finish, string> = { gloss: 'Brillo', matte: 'Mate' };
export const KIND_LABEL: Record<SwatchKind, string> = {
  metal: 'Metal',
  solid: 'Sólido',
  translucent: 'Translúcido',
  havana: 'Carey',
};

/**
 * A color as the panel shows it: its number, and the name only when it has one of its own. TAITIT's
 * colors have no names (Carlos, 2026-10-21): the name is the number and the app shows only that.
 */
export const swatchLabel = (s: { name: string; ref: string }) =>
  s.name && s.name !== s.ref ? `${s.ref} · ${s.name}` : s.ref;
