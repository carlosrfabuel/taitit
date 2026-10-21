/** Lowercase without accents, for searches ("Óptica" matches "optica"). */
export const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
