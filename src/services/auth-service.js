import { appMode, requireSupabase, supabase } from './supabase.js';

const aliasDomain = import.meta.env.VITE_AUTH_ALIAS_DOMAIN || 'auth.afucoa.local';

export function normalizeDocument(value = '') {
  return String(value).replace(/\D/g, '');
}

export function documentToAuthEmail(documentNumber) {
  const normalized = normalizeDocument(documentNumber);
  if (normalized.length < 6) throw new Error('Ingresá una cédula válida.');
  return `${normalized}@${aliasDomain}`;
}

export async function signInWithDocument(documentNumber, password) {
  if (appMode !== 'supabase') return { demo: true, documentNumber: normalizeDocument(documentNumber) };
  const client = requireSupabase();
  const email = documentToAuthEmail(documentNumber);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(mapAuthError(error));
  return data;
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
}

export async function getAuthSession() {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => data.subscription.unsubscribe();
}

function mapAuthError(error) {
  const message = String(error?.message || '').toLowerCase();
  if (message.includes('invalid login credentials')) return 'Cédula o contraseña incorrectas.';
  if (message.includes('email not confirmed')) return 'La cuenta todavía no está habilitada.';
  return 'No pudimos iniciar sesión. Intentá nuevamente.';
}
