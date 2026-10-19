import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Database } from '@taitit/shared';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from './messages';

export type Profile = Database['public']['Tables']['profiles']['Row'];

type Result = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** True until the stored session has been read on startup. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  /** needsConfirmation: the account exists but the email link must be opened first. */
  signUp: (name: string, email: string, password: string) => Promise<Result & { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<Result>;
  updatePassword: (password: string) => Promise<Result>;
  /** Turns the one-time code from an email link into a session on this device. errorCode = Supabase error code. */
  exchangeCode: (code: string) => Promise<Result & { errorCode: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Runs the action when signed in; otherwise opens sign-in (guests can browse but not save or order). */
export function useRequireAuth() {
  const { session } = useAuth();
  return useCallback(
    (action: () => void) => {
      if (session) action();
      else router.push('/sign-in');
    },
    [session],
  );
}

// Deep links back into the app from emails (Expo Go: exp://…/--/auth/callback, builds: taitit://auth/callback).
const callbackUrl = () => Linking.createURL('auth/callback');
const resetUrl = () => Linking.createURL('reset-password');

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  // Tagged with the user it belongs to, so a stale profile never shows after sign-out or a user switch.
  const [loadedProfile, setLoadedProfile] = useState<{ userId: string; profile: Profile | null } | null>(
    null,
  );
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      // If stored-session storage fails, start signed out instead of hanging on the splash screen.
      .catch(() => setSession(null))
      .finally(() => setInitializing(false));
    // Don't call other Supabase methods inside this callback (it can deadlock); profile loads in its own effect.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    // A failed load (e.g. no connection at startup) is retried a few times, waiting longer each time.
    const load = (attempt: number) =>
      supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        .then(({ data, error }) => {
          if (cancelled) return;
          if (error && attempt < 4) retry = setTimeout(() => load(attempt + 1), 2000 * 2 ** attempt);
          else setLoadedProfile({ userId, profile: data });
        });
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [userId]);
  const profile = loadedProfile && loadedProfile.userId === userId ? loadedProfile.profile : null;

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? authErrorMessage(error) : null };
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { full_name: name.trim() }, emailRedirectTo: callbackUrl() },
    });
    if (error) return { error: authErrorMessage(error), needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<Result> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: resetUrl() });
    return { error: error ? authErrorMessage(error) : null };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<Result> => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? authErrorMessage(error) : null };
  }, []);

  const exchangeCode = useCallback(async (code: string) => {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return { error: error ? authErrorMessage(error) : null, errorCode: error?.code ?? null };
  }, []);

  const value = useMemo(
    () => ({
      session,
      profile,
      initializing,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      exchangeCode,
    }),
    [
      session,
      profile,
      initializing,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      exchangeCode,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
