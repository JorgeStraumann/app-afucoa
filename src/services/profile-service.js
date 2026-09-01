import { appMode, requireSupabase } from './supabase.js';

export async function fetchMyProfile() {
  if (appMode !== 'supabase') return null;
  const { data, error } = await requireSupabase().rpc('get_my_profile');
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export async function updateMyContact({ email, phone }) {
  const { data, error } = await requireSupabase().rpc('update_my_contact', {
    p_email: email || null,
    p_phone: phone || null,
  });
  if (error) throw error;
  return data;
}
