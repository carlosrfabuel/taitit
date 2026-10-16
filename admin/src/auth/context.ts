import { createContext, use } from 'react';

export type AuthStatus = 'loading' | 'signedOut' | 'forbidden' | 'error' | 'admin';

export type AuthValue = {
  status: AuthStatus;
  email: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  retry: () => void;
};

export const AuthContext = createContext<AuthValue | null>(null);

export const NOT_ADMIN_MESSAGE = 'Esta cuenta no tiene acceso al panel.';

export function useAuth() {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>');
  return value;
}
