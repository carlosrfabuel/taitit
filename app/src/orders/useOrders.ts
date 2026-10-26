import { Linking } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { fetchOrder, fetchOrders, fetchWhatsappNumber, orderKeys, whatsappUrl } from './orders';

// Image links are valid for an hour: refreshed well before that.
const STALE = 30 * 60_000;

/** The signed-in user's sent orders (nothing for guests). Keyed by user. */
export function useOrders() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: orderKeys.list(userId ?? 'guest'),
    queryFn: () => fetchOrders(userId!),
    enabled: !!userId,
    staleTime: STALE,
    // Image links expire after an hour: refresh while the screen stays open.
    refetchInterval: STALE,
  });
}

/** One of the user's orders. */
export function useOrder(id: string | undefined) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: orderKeys.one(userId ?? 'guest', id ?? ''),
    queryFn: () => fetchOrder(userId!, id!),
    enabled: !!userId && !!id,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

/**
 * Opens WhatsApp with an order's summary, to TAITIT's number from the admin panel (read fresh each
 * time: a number just changed there is used right away). If it can't be read, WhatsApp asks which chat.
 */
export async function openWhatsapp(text: string): Promise<void> {
  const number = await fetchWhatsappNumber().catch(() => '');
  await Linking.openURL(whatsappUrl(text, number));
}
