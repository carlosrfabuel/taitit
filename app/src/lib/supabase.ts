// Before the client: PKCE needs SHA-256 (see webCryptoDigest.ts).
import './webCryptoDigest';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import type { Database } from '@taitit/shared';
import { secureSessionStorage } from './secureSessionStorage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_KEY. Copy app/.env.example to app/.env.',
  );
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: secureSessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Mobile: links are handled by the auth/callback route, not by reading window.location.
    detectSessionInUrl: false,
    // PKCE: email links return a one-time code that only this device can exchange.
    flowType: 'pkce',
  },
});

// Refresh tokens only while the app is in the foreground (Supabase's React Native guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
