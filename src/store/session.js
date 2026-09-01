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
  currentSession = authSession ? await buildRealSession(authSession) : null;
  unsubscribeAuth?.();
  unsubscribeAuth = onAuthStateChange(async (session) => {
    currentSession = session ? await buildRealSession(session) : null;
    window.dispatchEvent(new CustomEvent('afucoa:session-changed'));
  });
  return currentSession;
}


export async function startRealSession(authResult) {
  const authSession = authResult?.session || authResult;
  if (!authSession) throw new Error('Supabase no devolvió una sesión válida.');
  currentSession = await buildRealSession(authSession);
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
  if (appMode === 'demo') localStorage.removeItem(SESSION_KEY);
  else await authSignOut();
  currentSession = null;
}

async function buildRealSession(authSession) {
  const profile = await fetchMyProfile();
  return {
    demo: false,
    auth: authSession,
    user: authSession.user,
    profile,
  };
}
