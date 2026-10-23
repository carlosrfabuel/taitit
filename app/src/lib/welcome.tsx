import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// The start screen opens on every launch while nobody is signed in (2026-10-23, the user's choice:
// account apps show it to signed-out visitors, signed-in opticians go straight to the catalog), and
// again after signing out. "Explore the catalog" or "Sign in" moves past it for the rest of that run.
type WelcomeValue = {
  /** The start screen should open (for visitors who aren't signed in). */
  show: boolean;
  /** The visitor moved on: not again until the next launch or a sign-out. */
  dismiss: () => void;
  /** Show it again (after signing out). */
  reset: () => void;
};

const WelcomeContext = createContext<WelcomeValue | null>(null);

export function WelcomeProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState(false);
  const dismiss = useCallback(() => setSeen(true), []);
  const reset = useCallback(() => setSeen(false), []);
  const value = useMemo(() => ({ show: !seen, dismiss, reset }), [seen, dismiss, reset]);
  return <WelcomeContext.Provider value={value}>{children}</WelcomeContext.Provider>;
}

export function useWelcome(): WelcomeValue {
  const value = useContext(WelcomeContext);
  if (!value) throw new Error('useWelcome must be used inside WelcomeProvider');
  return value;
}
