import { appMode } from '../services/supabase.js';
import { fetchMyProfile } from '../services/profile-service.js';
import { getAuthSession, onAuthStateChange, signOut as authSignOut } from '../services/auth-service.js';

const SESSION_KEY = 'afucoa_v2_demo_session';
let currentSession = null;
let unsubscribeAuth = null;

export function getSession() { return currentSession; }
export function getAppMode() { return appMode; }
export function isAdminSession() { return ['admin', 'superadmin'].includes(currentSession?.profile?.role); }

export async function bootstrapSession() {
  if (appMode === 'demo') {
    try { currentSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { currentSession = null; }
    return currentSession;
  }

  const authSession = await getAuthSession();
  try {
    currentSession = authSession ? await buildRealSession(authSession) : null;
  } catch {
    currentSession = null;
    await authSignOut().catch(() => {});
  }
  unsubscribeAuth?.();
  unsubscribeAuth = onAuthStateChange(async (session) => {
    try {
      currentSession = session ? await buildRealSession(session) : null;
    } catch {
      currentSession = null;
      await authSignOut().catch(() => {});
    }
    window.dispatchEvent(new CustomEvent('afucoa:session-changed'));
  });
  return currentSession;
}


export async function startRealSession(authResult) {
  const authSession = authResult?.session || authResult;
  if (!authSession) throw new Error('Supabase no devolvió una sesión válida.');
  try {
    currentSession = await buildRealSession(authSession);
  } catch (error) {
    currentSession = null;
    await authSignOut().catch(() => {});
    throw error;
  }
  return currentSession;
}

export function startDemoSession(documentNumber) {
  const session = {
    documentNumber,
    demo: true,
    createdAt: new Date().toISOString(),
    profile: {
      role: 'superadmin',
      first_name: 'Jorge',
      last_name: 'Carrara',
      member_number: '1925',
      status: 'activo',
    },
  };
  currentSession = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function refreshProfile() {
  if (appMode !== 'supabase' || !currentSession) return currentSession;
  currentSession.profile = await fetchMyProfile();
  return currentSession;
}

export async function endSession() {
  try {
    if (appMode === 'demo') localStorage.removeItem(SESSION_KEY);
    else await authSignOut();
  } finally {
    currentSession = null;
  }
}

async function buildRealSession(authSession) {
  const profile = await fetchMyProfile();
  if (!profile || profile.status !== 'activo') {
    throw new Error('La cuenta no está habilitada. Contactá a AFUCOA.');
  }
  return {
    demo: false,
    auth: authSession,
    user: authSession.user,
    profile,
  };
}
