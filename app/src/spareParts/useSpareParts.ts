import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import { fetchSparePartRequest, fetchSparePartRequests, sparePartKeys } from './spareParts';

// Photo links are valid for an hour: refreshed well before that.
const STALE = 30 * 60_000;

/** The signed-in optician's spare part requests (nothing for guests). Keyed by user. */
export function useSparePartRequests() {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: sparePartKeys.list(userId ?? 'guest'),
    queryFn: () => fetchSparePartRequests(userId!),
    enabled: !!userId,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}

/** One of the optician's requests. */
export function useSparePartRequest(id: string | undefined) {
  const userId = useAuth().session?.user.id;
  return useQuery({
    queryKey: sparePartKeys.one(userId ?? 'guest', id ?? ''),
    queryFn: () => fetchSparePartRequest(userId!, id!),
    enabled: !!userId && !!id,
    staleTime: STALE,
    refetchInterval: STALE,
  });
}
