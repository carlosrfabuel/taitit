import type { Finish, Material, Swatch } from './types';

/** Contract limit: at most 4 customizable zones per model. */
export const MAX_ZONES_PER_MODEL = 4;

/** Labels in the app's language (English, client decision). The admin panel keeps its own. */
export const MATERIAL_LABEL: Record<Material, string> = {
  metal: 'Metal',
  acetate: 'Acetate',
};

export const FINISH_LABEL: Record<Finish, string> = {
  gloss: 'Gloss',
  matte: 'Matte',
};

/** Only swatches of the zone's material, active, in display order. */
export const paletteFor = (swatches: Swatch[], material: Material): Swatch[] =>
  swatches.filter((s) => s.material === material && s.active).sort((a, b) => a.sortOrder - b.sortOrder);
