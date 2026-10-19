import type { Database } from '@taitit/shared';
import { supabase } from './supabase';

export type AccountStatus = Database['public']['Enums']['account_status'];

export type CustomerRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  status: AccountStatus;
  created_at: string;
  reviewed_at: string | null;
};

export const customerKeys = { all: ['customers'] as const };

export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

/** Customer accounts (admins are not listed), newest first. */
export async function listCustomers(): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, status, created_at, reviewed_at')
    .eq('role', 'customer')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

/** Approve, reject or move back to pending (database function: admins only, never their own account). */
export async function setAccountStatus(userId: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.rpc('set_account_status', { p_user: userId, p_status: status });
  if (error) throw error;
}
