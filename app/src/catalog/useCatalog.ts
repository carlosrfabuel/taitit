import { useQuery, useQueryClient } from '@tanstack/react-query';
import { catalogKeys, fetchCatalog, fetchSwatches } from './catalog';

export function useSwatches() {
  return useQuery({ queryKey: catalogKeys.swatches, queryFn: fetchSwatches });
}

/**
 * Published models with their default-color plans. Colors and models load together (one refresh
 * updates both); the colors are also stored for the customizer.
 */
export function useCatalog() {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: catalogKeys.all,
    queryFn: async () => {
      const swatches = await fetchSwatches();
      queryClient.setQueryData(catalogKeys.swatches, swatches);
      return fetchCatalog(swatches);
    },
  });
}
