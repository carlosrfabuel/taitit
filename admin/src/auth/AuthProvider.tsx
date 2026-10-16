import { useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authMessage } from '../lib/errors';
import { AuthContext, NOT_ADMIN_MESSAGE, type AuthStatus, type AuthValue } from './context';

async function fetchRole(userId: string) {
  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).single();
  if (error) throw error;
  return data.role;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // undefined = session not read yet.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Fires INITIAL_SESSION first, then every sign-in, sign-out and token refresh.
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      // Any sign-out (button, other tab, expired refresh): no data from that account stays cached.
      if (event === 'SIGNED_OUT') queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = session?.user.id;
  const role = useQuery({
    queryKey: ['role', userId],
    queryFn: () => fetchRole(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  let status: AuthStatus;
  if (session === undefined) status = 'loading';
  else if (!session) status = 'signedOut';
  else if (role.isPending) status = 'loading';
  else if (role.isError) status = 'error';
  else status = role.data === 'admin' ? 'admin' : 'forbidden';

  const signIn: AuthValue['signIn'] = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: authMessage(error) };
    try {
      const r = await queryClient.fetchQuery({
        queryKey: ['role', data.user.id],
        queryFn: () => fetchRole(data.user.id),
        staleTime: 0, // always read the role fresh at login (it may have just been changed)
      });
      if (r === 'admin') return { error: null };
    } catch {
      await supabase.auth.signOut();
      return { error: 'No se pudo comprobar tu acceso. Inténtalo de nuevo.' };
    }
    // Customers can't use the panel: don't leave them signed in here.
    await supabase.auth.signOut();
    return { error: NOT_ADMIN_MESSAGE };
  };

  const signOut = async () => {
    await supabase.auth.signOut(); // SIGNED_OUT clears the cache (see above)
  };

  return (
    <AuthContext
      value={{
        status,
        email: session?.user.email ?? null,
        signIn,
        signOut,
        retry: () => void role.refetch(),
      }}
    >
      {children}
    </AuthContext>
  );
}
