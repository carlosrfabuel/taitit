import type { TextInputProps } from 'react-native';
import { supabase } from '@/lib/supabase';
import type { Profile } from './AuthProvider';
import { validateEmail } from './validation';

// The optician's business details (client decisions 2026-10-19 and 2026-10-21): asked at sign-up,
// editable in Account, copied into every order. The database has the same limits and the same
// required set (private.business_complete); the server is what enforces them for orders.

export type BusinessKey =
  | 'business_name'
  | 'legal_name'
  | 'tax_id'
  | 'phone'
  | 'address'
  | 'postal_code'
  | 'city'
  | 'province'
  | 'delivery_address'
  | 'delivery_postal_code'
  | 'delivery_city'
  | 'delivery_province'
  | 'commercial_address'
  | 'commercial_postal_code'
  | 'commercial_city'
  | 'commercial_province'
  | 'contact_email'
  | 'labeling'
  | 'bank_account';

/** Parts that default to "the same as …": their fields are then stored as none. */
export type SameKey = 'delivery' | 'commercial' | 'contact';

export type BusinessDetails = Record<BusinessKey, string> & { same: Record<SameKey, boolean> };

type Field = {
  key: BusinessKey;
  label: string;
  max: number;
  /** Required (for a "same as" part: required when the part has its own value). */
  required: boolean;
  helper?: string;
  input?: Pick<TextInputProps, 'keyboardType' | 'autoCapitalize' | 'autoComplete' | 'textContentType'>;
};

const addressFields = (prefix: '' | 'delivery_' | 'commercial_', fill: boolean): Field[] => [
  {
    key: `${prefix}address` as BusinessKey,
    label: 'Address',
    max: 200,
    required: true,
    input: fill ? { autoComplete: 'street-address', textContentType: 'fullStreetAddress' } : undefined,
  },
  {
    key: `${prefix}postal_code` as BusinessKey,
    label: 'Postal code',
    max: 12,
    required: true,
    input: fill
      ? { autoCapitalize: 'characters', autoComplete: 'postal-code', textContentType: 'postalCode' }
      : { autoCapitalize: 'characters' },
  },
  {
    key: `${prefix}city` as BusinessKey,
    label: 'City',
    max: 80,
    required: true,
    input: fill ? { textContentType: 'addressCity' } : undefined,
  },
  {
    key: `${prefix}province` as BusinessKey,
    label: 'Province (optional)',
    max: 80,
    required: false,
    input: fill ? { textContentType: 'addressState' } : undefined,
  },
];

export type Section = {
  id: string;
  title?: string;
  /** "Same as …" choice shown above the fields (checked = the fields are hidden and not stored). */
  same?: { key: SameKey; label: string };
  fields: Field[];
};

// In the order of Carlos's list (company, VAT, address, delivery address, bank account, commercial
// name and address, phone, email, contact, labeling); the contact person is the account's name.
export const BUSINESS_SECTIONS: Section[] = [
  {
    id: 'business',
    fields: [
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
    ],
  },
  { id: 'address', title: 'Address', fields: addressFields('', true) },
  {
    id: 'delivery',
    title: 'Delivery address',
    same: { key: 'delivery', label: 'Same as the address above' },
    fields: addressFields('delivery_', false),
  },
  {
    id: 'commercial',
    title: 'Commercial address',
    same: { key: 'commercial', label: 'Same as the address above' },
    fields: addressFields('commercial_', false),
  },
  {
    id: 'contact',
    title: 'Contact email',
    same: { key: 'contact', label: 'Same as the sign-in email' },
    fields: [
      {
        key: 'contact_email',
        label: 'Email for questions and invoices',
        max: 254,
        required: true,
        input: { keyboardType: 'email-address', autoCapitalize: 'none', autoComplete: 'email' },
      },
    ],
  },
  {
    id: 'orders',
    title: 'For your orders',
    fields: [
      {
        key: 'labeling',
        label: 'Name on the glasses',
        max: 60,
        required: true,
        helper: 'TAITIT puts this name on the glasses of all your orders.',
      },
      {
        key: 'bank_account',
        label: 'Bank account (optional)',
        max: 42,
        required: false,
        input: { autoCapitalize: 'characters' },
      },
    ],
  },
];

export const BUSINESS_FIELDS: Field[] = BUSINESS_SECTIONS.flatMap((s) => s.fields);

/** The section a field belongs to, when that section can be "the same as …". */
const sameOf = (key: BusinessKey): SameKey | undefined =>
  BUSINESS_SECTIONS.find((s) => s.fields.some((f) => f.key === key))?.same?.key;

export const emptyBusiness = (): BusinessDetails => ({
  ...(Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.key, ''])) as Record<BusinessKey, string>),
  same: { delivery: true, commercial: true, contact: true },
});

export const businessFromProfile = (p: Profile | null): BusinessDetails => ({
  ...(Object.fromEntries(BUSINESS_FIELDS.map((f) => [f.key, p?.[f.key] ?? ''])) as Record<
    BusinessKey,
    string
  >),
  same: { delivery: !p?.delivery_address, commercial: !p?.commercial_address, contact: !p?.contact_email },
});

// The database counts characters (code points), like Array.from.
const length = (s: string) => Array.from(s).length;

/** Errors per field (null when the form is fine). */
export function validateBusiness(values: BusinessDetails): Partial<Record<BusinessKey, string>> | null {
  const errors: Partial<Record<BusinessKey, string>> = {};
  for (const f of BUSINESS_FIELDS) {
    const same = sameOf(f.key);
    if (same && values.same[same]) continue; // not shown, not stored
    const v = values[f.key].trim();
    if (f.required && !v) errors[f.key] = 'Required.';
    else if (length(v) > f.max) errors[f.key] = `Use at most ${f.max} characters.`;
    else if (f.key === 'contact_email' && v) {
      const e = validateEmail(v);
      if (e) errors[f.key] = e;
    }
  }
  return Object.keys(errors).length ? errors : null;
}

/** Trimmed values; blank optional fields and "same as" parts are stored as none. */
export const businessColumns = (values: BusinessDetails): Record<BusinessKey, string | null> =>
  Object.fromEntries(
    BUSINESS_FIELDS.map((f) => {
      const same = sameOf(f.key);
      return [f.key, same && values.same[same] ? null : values[f.key].trim() || null];
    }),
  ) as Record<BusinessKey, string | null>;

/**
 * The details TAITIT approves an account with. Changing one of them (not filling in an empty one)
 * sends an approved account back to review: database rule in 20261022130000_business_identity_review.sql.
 */
export const IDENTITY_KEYS: BusinessKey[] = ['business_name', 'legal_name', 'tax_id'];
export const identityChanged = (before: BusinessDetails, after: BusinessDetails) =>
  IDENTITY_KEYS.some((k) => before[k].trim() !== '' && after[k].trim() !== before[k].trim());

/** All required details present (same rule as the order function; own addresses are always complete). */
export const businessComplete = (p: Profile | null) =>
  !!p && BUSINESS_FIELDS.every((f) => !f.required || !!sameOf(f.key) || !!p[f.key]?.trim());

/** An address as one line: "street, postal code city (province)". */
export const addressLine = (
  address: string | null,
  postalCode: string | null,
  city: string | null,
  province?: string | null,
) => [address, [postalCode, city].filter(Boolean).join(' '), province].filter(Boolean).join(', ') || null;

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
