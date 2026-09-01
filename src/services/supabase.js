import { createClient } from '@supabase/supabase-js';

const mode = import.meta.env.VITE_AFUCOA_MODE || 'demo';
const url = import.meta.env.VITE_SUPABASE_URL || '';
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
  || '';

export const isSupabaseConfigured = mode === 'supabase' && Boolean(url && publishableKey);
export const appMode = isSupabaseConfigured ? 'supabase' : 'demo';

export const supabase = isSupabaseConfigured
  ? createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) throw new Error('Supabase no está configurado. Definí VITE_AFUCOA_MODE=supabase y las variables VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.');
  return supabase;
}
