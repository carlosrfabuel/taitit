import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { fetchOrder, fetchOrders, orderKeys } from './orders';

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
