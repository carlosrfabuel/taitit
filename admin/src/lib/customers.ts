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
  labeling: string | null;
  contact_email: string | null;
  bank_account: string | null;
  delivery_address: string | null;
  delivery_postal_code: string | null;
  delivery_city: string | null;
  delivery_province: string | null;
  commercial_address: string | null;
  commercial_postal_code: string | null;
  commercial_city: string | null;
  commercial_province: string | null;
};

/** An address as one line: "street, postal code city, province" (null when there is none). */
export const addressLine = (
  address: string | null,
  postalCode: string | null,
  city: string | null,
  province: string | null,
) => [address, [postalCode, city].filter(Boolean).join(' '), province].filter(Boolean).join(', ') || null;

export const customerKeys = { all: ['customers'] as const, pending: ['customers', 'pending'] as const };

export const STATUS_LABEL: Record<AccountStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

const PAGE = 1000; // the most rows the API returns per request

/** Every customer account (admins are not listed), newest first, fetched in pages. */
export async function listCustomers(): Promise<CustomerRow[]> {
  const all: CustomerRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, full_name, status, created_at, reviewed_at, business_name, legal_name, tax_id, phone, address, postal_code, city, province, labeling, contact_email, bank_account, delivery_address, delivery_postal_code, delivery_city, delivery_province, commercial_address, commercial_postal_code, commercial_city, commercial_province',
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

/**
 * Deletes a customer's account on their request (database function: admins only; never an admin or
 * the caller). Profile and designs go; their orders stay with the name/email copy.
 */
export async function deleteCustomerAccount(userId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_customer_account', { p_user: userId });
  if (error) throw error;
}

/** Approve, reject or move back to pending (database function: admins only, never their own account). */
export async function setAccountStatus(userId: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.rpc('set_account_status', { p_user: userId, p_status: status });
  if (error) throw error;
}
