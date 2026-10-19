import { createClient } from '@supabase/supabase-js';
import type { Database } from '@taitit/shared';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_KEY (see admin/.env).');

// Publishable key only: every admin action is checked by the database (RLS + is_admin()),
// so the login guard in the panel is convenience, not the security boundary.
// detectSessionInUrl off: the panel signs in with a password only and never reads sessions from
// links. The public /confirmed page receives the app's confirmation links (?code=…); they belong to
// the phone. (This client's implicit flow would not exchange such a code anyway; this keeps it so.)
export const supabase = createClient<Database>(url, key, { auth: { detectSessionInUrl: false } });
