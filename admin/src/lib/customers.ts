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
  business_name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  province: string | null;
};

export const customerKeys = { all: ['customers'] as const, pending: ['customers', 'pending'] as const };

export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Pendiente',
  approved: 'Aprobado',
  rejected: 'Rechazado',
};

const PAGE = 1000; // the most rows the API returns per request

/** Every customer account (admins are not listed), newest first, fetched in pages. */
export async function listCustomers(): Promise<CustomerRow[]> {
  const all: CustomerRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, status, created_at, reviewed_at, business_name, legal_name, tax_id, phone, address, postal_code, city, province',
      )
      .eq('role', 'customer')
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1);
    if (error) throw error;
    all.push(...data);
    if (data.length < PAGE) return all;
  }
}

/** How many accounts wait for approval (a count only: nothing is downloaded). */
export async function countPending(): Promise<number> {
  const { count, error } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'customer')
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

/** Approve, reject or move back to pending (database function: admins only, never their own account). */
export async function setAccountStatus(userId: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.rpc('set_account_status', { p_user: userId, p_status: status });
  if (error) throw error;
}
