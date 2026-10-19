import { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import type { Database } from '@taitit/shared';
import { supabase } from '@/lib/supabase';
import { authErrorMessage } from './messages';
import type { BusinessKey } from './business';
import { forgetSignUpBusiness, pendingSignUpBusiness, rememberSignUpBusiness } from './pendingBusiness';

export type Profile = Database['public']['Tables']['profiles']['Row'];

/** Orders need an account approved by TAITIT (admins can always order). The server checks the same rule. */
export const canOrder = (profile: Profile | null) =>
  profile?.role === 'admin' || profile?.status === 'approved';

type Result = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  /** The profile could not be loaded (no connection); reloadProfile() tries again. */
  profileFailed: boolean;
  /** True until the stored session has been read on startup. */
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<Result>;
  /** needsConfirmation: the account exists but the email link must be opened first. */
  signUp: (
    name: string,
    email: string,
    password: string,
    business: Record<string, string | null>,
  ) => Promise<Result & { needsConfirmation: boolean }>;
  /** Loads the profile again (after the user edits it). */
  reloadProfile: () => void;
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
  const [loadedProfile, setLoadedProfile] = useState<{
    userId: string;
    profile: Profile | null;
    failed: boolean;
  } | null>(null);
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
  // Reloaded when the app comes back to the foreground: an approval by TAITIT shows without a restart.
  const [profileRefresh, setProfileRefresh] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      (state) => state === 'active' && setProfileRefresh((n) => n + 1),
    );
    return () => sub.remove();
  }, []);
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
          else if (error)
            // Still failing: keep the profile already shown (a refresh on a bad connection must not
            // wipe it); with none yet, report the failure so screens can offer to retry.
            setLoadedProfile((prev) =>
              prev && prev.userId === userId && prev.profile ? prev : { userId, profile: null, failed: true },
            );
          else setLoadedProfile({ userId, profile: data, failed: false });
        });
    load(0);
    return () => {
      cancelled = true;
      clearTimeout(retry);
    };
  }, [userId, profileRefresh]);
  const current = loadedProfile && loadedProfile.userId === userId ? loadedProfile : null;
  const profile = current?.profile ?? null;
  const profileFailed = !!current?.failed;

  const signIn = useCallback(async (email: string, password: string): Promise<Result> => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error ? authErrorMessage(error) : null };
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string, business: Record<string, string | null>) => {
      // The business details go with the sign-up; the database copies them into the profile.
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim(), ...business }, emailRedirectTo: callbackUrl() },
      });
      if (error) return { error: authErrorMessage(error), needsConfirmation: false };
      // Also kept on the phone: a repeated sign-up of an unconfirmed email may not pass them on.
      await rememberSignUpBusiness(email, business);
      return { error: null, needsConfirmation: !data.session };
    },
    [],
  );
  const reloadProfile = useCallback(() => setProfileRefresh((n) => n + 1), []);

  // Business details typed at sign-up but missing from the account (repeated sign-up, see
  // pendingBusiness.ts): saved into the empty fields after sign-in, then forgotten on this phone.
  const email = session?.user.email;
  useEffect(() => {
    if (!profile || !email || !userId) return;
    let cancelled = false;
    void (async () => {
      const pending = await pendingSignUpBusiness(email);
      if (!pending || cancelled) return;
      const missing: Partial<Record<BusinessKey, string>> = Object.fromEntries(
        Object.entries(pending).filter(([key, value]) => value && !profile[key as BusinessKey]?.trim()),
      );
      if (Object.keys(missing).length) {
        const { error } = await supabase.from('profiles').update(missing).eq('id', userId);
        if (error || cancelled) return; // kept: tried again on the next profile load
        setProfileRefresh((n) => n + 1);
      }
      await forgetSignUpBusiness(email);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, email, userId]);

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
      profileFailed,
      initializing,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      exchangeCode,
      reloadProfile,
    }),
    [
      session,
      profile,
      profileFailed,
      initializing,
      signIn,
      signUp,
      signOut,
      sendPasswordReset,
      updatePassword,
      exchangeCode,
      reloadProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
