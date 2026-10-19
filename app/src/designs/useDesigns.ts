import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/auth/AuthProvider';
import {
  createDesign,
  deleteDesign,
  designKeys,
  fetchDesigns,
  updateDesign,
  type Design,
  type Selection,
} from './designs';

/** The signed-in user's designs (nothing for guests). Keyed by user: another account never sees them. */
export function useDesigns() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: designKeys.list(userId ?? 'guest'),
    queryFn: fetchDesigns,
    enabled: !!userId,
  });
}

/** Create, update and delete; the list is refreshed after each change. */
export function useDesignMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: designKeys.all });
  const create = useMutation({
    mutationFn: (input: { modelId: string; name: string; selection: Selection }) => createDesign(input),
    onSettled: refresh,
  });
  const update = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; name?: string; selection?: Selection }) =>
      updateDesign(id, patch),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteDesign(id),
    onSettled: refresh,
  });
  return { create, update, remove };
}

export type { Design };
