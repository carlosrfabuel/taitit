import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogKeys, fetchCatalog, fetchSwatches } from './catalog';

export function useSwatches() {
  return useQuery({ queryKey: catalogKeys.swatches, queryFn: fetchSwatches });
}

/**
 * Published models with their default-color plans. Colors and models load together, at the same time
 * (one refresh updates both); the colors go through their own query, so a screen asking for them too
 * shares the one request, and the customizer finds them stored.
 */
export function useCatalog() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: catalogKeys.all,
    queryFn: () =>
      // staleTime 0: fresh colors on every catalog load (a refresh too); one already loading is shared.
      fetchCatalog(
        queryClient.fetchQuery({ queryKey: catalogKeys.swatches, queryFn: fetchSwatches, staleTime: 0 }),
      ),
  });
}
