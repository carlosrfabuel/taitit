import { supabase } from './supabase';

/** What TAITIT sets in Settings (one row, admins only: see the app_settings migration). */
export type Settings = { order_email: string; updated_at: string };

export const settingsKeys = { all: ['settings'] as const };

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('order_email, updated_at')
    .eq('id', true)
    .single();
  if (error) throw error;
  return data;
}

export async function saveSettings(input: Pick<Settings, 'order_email'>): Promise<void> {
  const { data, error } = await supabase.from('app_settings').update(input).eq('id', true).select('id');
  if (error) throw error;
  if (!data.length) throw { code: 'not_found', message: 'Settings not found' };
}

export function validateSettings(email: string): { email?: string } {
  return {
    email: !email.trim()
      ? 'Enter the email address.'
      : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
        ? undefined
        : 'Enter a valid email address.',
  };
}
