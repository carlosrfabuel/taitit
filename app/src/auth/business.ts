import type { TextInputProps } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Profile } from './AuthProvider';

// The optician's business details (client decision 2026-10-19): asked at sign-up, editable in
// Account, copied into every order. The database has the same limits and the same required set
// (private.business_complete); the server is what enforces them for orders.

export type BusinessKey =
  'business_name' | 'legal_name' | 'tax_id' | 'phone' | 'address' | 'postal_code' | 'city' | 'province';

export type BusinessDetails = Record<BusinessKey, string>;

type Field = {
  key: BusinessKey;
  label: string;
  max: number;
  required: boolean;
  helper?: string;
  input?: Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'textContentType'>;
};

export const BUSINESS_FIELDS: Field[] = [
  {
    key: 'business_name',
    label: 'Business name',
    max: 120,
    required: true,
    helper: 'The name of your optician shop.',
  },
  {
    key: 'legal_name',
    label: 'Legal name (optional)',
    max: 120,
    required: false,
    helper: 'If different from the business name.',
  },
  {
    key: 'tax_id',
    label: 'Tax ID (CIF / NIF)',
    max: 20,
    required: true,
    input: { autoCapitalize: 'characters' },
  },
  {
    key: 'phone',
    label: 'Phone',
    max: 30,
    required: true,
    input: { keyboardType: 'phone-pad', autoComplete: 'tel', textContentType: 'telephoneNumber' },
  },
  {
    key: 'address',
    label: 'Address',
    max: 200,
    required: true,
    input: { autoComplete: 'street-address', textContentType: 'fullStreetAddress' },
  },
  {
    key: 'postal_code',
    label: 'Postal code',
    max: 12,
    required: true,
    input: { keyboardType: 'number-pad', autoComplete: 'postal-code', textContentType: 'postalCode' },
  },
  { key: 'city', label: 'City', max: 80, required: true, input: { textContentType: 'addressCity' } },
  {
    key: 'province',
    label: 'Province (optional)',
    max: 80,
    required: false,
    input: { textContentType: 'addressState' },
  },
];

export const emptyBusiness = (): BusinessDetails =>
  Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.key, ''])) as BusinessDetails;

export const businessFromProfile = (p: Profile | null): BusinessDetails =>
  Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.key, p?.[f.key] ?? ''])) as BusinessDetails;

// The database counts characters (code points), like Array.from.
const length = (s: string) => Array.from(s).length;

/** Errors per field (null when the form is fine). */
export function validateBusiness(values: BusinessDetails): Partial<Record<BusinessKey, string>> | null {
  const errors: Partial<Record<BusinessKey, string>> = {};
  for (const f of BUSINESS_FIELDS) {
    const v = values[f.key].trim();
    if (f.required && !v) errors[f.key] = 'Required.';
    else if (length(v) > f.max) errors[f.key] = `Use at most ${f.max} characters.`;
  }
  return Object.keys(errors).length ? errors : null;
}

/** Trimmed values; blank optional fields are stored as none. */
export const businessColumns = (values: BusinessDetails): Record<BusinessKey, string | null> =>
  Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.key, values[f.key].trim() || null])) as Record<
    BusinessKey,
    string | null
  >;

/** All required details present (same rule as the order function). */
export const businessComplete = (p: Profile | null) =>
  !!p && BUSINESS_FIELDS.every((f) => !f.required || !!p[f.key]?.trim());

/** Saves the signed-in user's details (the database only lets them change their own row). */
export async function saveBusiness(userId: string, values: BusinessDetails): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .update(businessColumns(values))
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  if (!data.length) throw new Error('profile_missing');
}
