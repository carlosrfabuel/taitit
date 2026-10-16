import { createClient } from '@supabase/supabase-js';
import type { Database } from '@taitit/shared';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;
if (!url || !key) throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_KEY (see admin/.env).');

// Publishable key only: every admin action is checked by the database (RLS + is_admin()),
// so the login guard in the panel is convenience, not the security boundary.
export const supabase = createClient<Database>(url, key);
