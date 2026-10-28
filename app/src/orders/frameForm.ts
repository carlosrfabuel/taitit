// The customizing form of a frame (Carlos, 2026-10-27): measurements in whole millimetres, a temple
// labeling (a special name for that frame only; the optician's general "name on the glasses" stays)
// and notes for the frame. All optional. Filled in the customizer, kept with the frame in the cart,
// sent with the order (database function create_order_lines checks it again).

export type FrameForm = {
  templeLength: number | null;
  bridgeSize: number | null;
  ringSizeA: number | null;
  ringSizeB: number | null;
  templeLabeling: string;
  notes: string;
};

export type Measure = 'templeLength' | 'bridgeSize' | 'ringSizeA' | 'ringSizeB';

export const EMPTY_FORM: FrameForm = {
  templeLength: null,
  bridgeSize: null,
  ringSizeA: null,
  ringSizeB: null,
  templeLabeling: '',
  notes: '',
};

/** The measurements in the order Carlos gave them, and whether TAITIT charges extra for them. */
export const MEASURES: { key: Measure; label: string; extraCost: boolean }[] = [
  { key: 'templeLength', label: 'Temple length', extraCost: false },
  { key: 'bridgeSize', label: 'Bridge size', extraCost: true },
  { key: 'ringSizeA', label: 'Ring size A', extraCost: true },
  { key: 'ringSizeB', label: 'Ring size B', extraCost: true },
];

export const MM_MIN = 1;
export const MM_MAX = 200;
export const LABELING_MAX = 25;
export const FRAME_NOTES_MAX = 500;
/** Fields in the form (for "2 of 6 filled"). */
export const FORM_FIELDS = MEASURES.length + 2;

// The database counts characters (code points), not UTF-16 units.
export const charCount = (s: string) => Array.from(s).length;

const mm = (v: unknown) =>
  typeof v === 'number' && Number.isInteger(v) && v >= MM_MIN && v <= MM_MAX ? v : null;
const text = (v: unknown, max: number) => (typeof v === 'string' ? Array.from(v).slice(0, max).join('') : '');

/** A form read back from the phone's storage (anything unexpected is left empty). */
export function parseForm(value: unknown): FrameForm {
  const f = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    templeLength: mm(f.templeLength),
    bridgeSize: mm(f.bridgeSize),
    ringSizeA: mm(f.ringSizeA),
    ringSizeB: mm(f.ringSizeB),
    templeLabeling: text(f.templeLabeling, LABELING_MAX),
    notes: text(f.notes, FRAME_NOTES_MAX),
  };
}

/** The form as it is sent: only what was filled in, texts trimmed. */
export function formPayload(f: FrameForm): Partial<Record<keyof FrameForm, number | string>> {
  const out: Partial<Record<keyof FrameForm, number | string>> = {};
  for (const { key } of MEASURES) if (f[key] !== null) out[key] = f[key]!;
  if (f.templeLabeling.trim()) out.templeLabeling = f.templeLabeling.trim();
  if (f.notes.trim()) out.notes = f.notes.trim();
  return out;
}

/** Same key = same form (two frames only become one when their colors and forms are the same). */
export const formKey = (f: FrameForm) => JSON.stringify(formPayload(f));

export const filledCount = (f: FrameForm) => Object.keys(formPayload(f)).length;

/** What was filled in, one line each, e.g. "Temple length: 140 mm" (cart, order, printed order). */
export function formSummary(f: FrameForm): string[] {
  const p = formPayload(f);
  return [
    ...MEASURES.filter(({ key }) => p[key] !== undefined).map(({ key, label }) => `${label}: ${p[key]} mm`),
    ...(p.templeLabeling ? [`Temple labeling: ${p.templeLabeling}`] : []),
    ...(p.notes ? [`Notes: ${p.notes}`] : []),
  ];
}
