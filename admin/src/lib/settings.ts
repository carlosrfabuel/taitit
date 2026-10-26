import { supabase } from './supabase';

/** What TAITIT sets in Settings (one row, admins only: see the app_settings migration). */
export type Settings = { whatsapp_number: string; order_email: string; updated_at: string };

export const settingsKeys = { all: ['settings'] as const };

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('whatsapp_number, order_email, updated_at')
    .eq('id', true)
    .single();
  if (error) throw error;
  return data;
}

export async function saveSettings(input: Pick<Settings, 'whatsapp_number' | 'order_email'>): Promise<void> {
  const { data, error } = await supabase.from('app_settings').update(input).eq('id', true).select('id');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Settings not found' };
}

/**
 * The number as wa.me needs it: digits only, country code first ("+34 647 94 29 67" → "34647942967").
 * A leading 00 is the same as +.
 */
export const normalizeWhatsapp = (input: string) => input.replace(/\D/g, '').replace(/^00/, '');

export function validateSettings(whatsapp: string, email: string): { whatsapp?: string; email?: string } {
  const digits = normalizeWhatsapp(whatsapp);
  return {
    whatsapp:
      digits && (digits.length < 8 || digits.length > 15)
        ? 'Enter the full number with the country code, e.g. +34 647 942 967.'
        : undefined,
    email: !email.trim()
      ? 'Enter the email address.'
      : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
        ? undefined
        : 'Enter a valid email address.',
  };
}

/** "34647942967" → "+34 647942967" for display (country code apart). */
export const formatWhatsapp = (digits: string) => (digits ? `+${digits}` : '');
