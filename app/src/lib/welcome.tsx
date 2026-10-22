import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// The welcome screen shows on the first launch and again after signing out, until the visitor
// chooses "Explore the catalog" or "Sign in". Remembered on this phone only.
const STORAGE_KEY = 'taitit.welcomeSeen';

type WelcomeValue = {
  /** False until the stored choice has been read (the splash stays up meanwhile). */
  ready: boolean;
  /** The welcome screen should open (for visitors who aren't signed in). */
  show: boolean;
  /** The visitor moved on: don't show it again. */
  dismiss: () => void;
  /** Show it again (after signing out). */
  reset: () => void;
};

const WelcomeContext = createContext<WelcomeValue | null>(null);

export function WelcomeProvider({ children }: { children: ReactNode }) {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then(
      (v) => setSeen(v === '1'),
      () => setSeen(true), // storage unreadable: go straight to the catalog
    );
  }, []);

  const dismiss = useCallback(() => {
    setSeen(true);
    AsyncStorage.setItem(STORAGE_KEY, '1').catch(() => {});
  }, []);

  const reset = useCallback(() => {
    setSeen(false);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ ready: seen !== null, show: seen === false, dismiss, reset }),
    [seen, dismiss, reset],
  );
  return <WelcomeContext.Provider value={value}>{children}</WelcomeContext.Provider>;
}

export function useWelcome(): WelcomeValue {
  const value = useContext(WelcomeContext);
  if (!value) throw new Error('useWelcome must be used inside WelcomeProvider');
  return value;
}
