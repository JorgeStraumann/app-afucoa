import { appMode, requireSupabase } from './supabase.js';

export async function createMembershipProof() {
  if (appMode !== 'supabase') return { demo: true, token: null, expires_at: null };
  const { data, error } = await requireSupabase().rpc('create_membership_verification_token');
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function verifyMembershipToken(token) {
  const { data, error } = await requireSupabase().rpc('verify_membership_token', { p_token: token });
  if (error) throw error;
  return Array.isArray(data) ? data[0] ?? null : data;
}
