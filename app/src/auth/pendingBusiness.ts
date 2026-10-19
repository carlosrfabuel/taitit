import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BusinessKey } from './business';

// Business details typed at sign-up, kept on this phone until the first sign-in with that email.
// Needed because a repeated sign-up (the email was registered before but never confirmed) keeps the
// existing account and Supabase does not pass the new form on: without this, those details would
// be lost. After sign-in, the app saves them into the missing fields of the profile, then forgets them.

const KEY = 'taitit.pendingBusiness';
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;

type Pending = Partial<Record<BusinessKey, string | null>>;
type Store = Record<string, { details: Pending; at: number }>;

const norm = (email: string) => email.trim().toLowerCase();

async function load(): Promise<Store> {
  try {
    return JSON.parse((await AsyncStorage.getItem(KEY)) ?? '{}') as Store;
  } catch {
    return {};
  }
}

async function save(store: Store) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage unavailable: the details can still be added in Account
  }
}

/** Remembers the details typed at sign-up for this email (only if something was typed). */
export async function rememberSignUpBusiness(email: string, details: Pending, now = Date.now()) {
  if (!Object.values(details).some((v) => v && v.trim())) return;
  const store = await load();
  store[norm(email)] = { details, at: now };
  await save(store);
}

/** The details kept for this email, if any (and not older than 30 days). */
export async function pendingSignUpBusiness(email: string, now = Date.now()): Promise<Pending | null> {
  const entry = (await load())[norm(email)];
  return entry && now - entry.at < MAX_AGE ? entry.details : null;
}

export async function forgetSignUpBusiness(email: string) {
  const store = await load();
  if (!store[norm(email)]) return;
  delete store[norm(email)];
  await save(store);
}
