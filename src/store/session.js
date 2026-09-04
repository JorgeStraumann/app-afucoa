import { appMode } from '../services/supabase.js';
import { fetchMyProfile } from '../services/profile-service.js';
import { getAuthSession, onAuthStateChange, signOut as authSignOut } from '../services/auth-service.js';

const SESSION_KEY = 'afucoa_v2_demo_session';
let currentSession = null;
let unsubscribeAuth = null;
let latestAuthSession = null;
let generation = 0;
let profileFlight = null;
let signingOut = null;

function clearRealSession() {
  generation += 1;
  latestAuthSession = null;
  currentSession = null;
  profileFlight = null;
}

function sessionChanged() {
  window.dispatchEvent(new CustomEvent('afucoa:session-changed'));
}

function cancelled() {
  return Object.assign(new Error('La sesión cambió. Volvé a iniciar sesión.'), { code: 'SESSION_CHANGED' });
}

async function closeRealSession() {
  if (signingOut) return signingOut;
  // Invalidate work BEFORE awaiting Auth, so a late profile cannot resurrect it.
  clearRealSession();
  signingOut = Promise.resolve().then(() => authSignOut());
  try { await signingOut; }
  finally { signingOut = null; sessionChanged(); }
}

async function loadProfile(expectedGeneration) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (generation !== expectedGeneration) throw cancelled();
    try {
      // A successful empty response is different from an RPC/network error.
      return await fetchMyProfile();
    } catch (cause) {
      if (generation !== expectedGeneration) throw cancelled();
      if (attempt === 2) {
        throw Object.assign(new Error('No pudimos verificar el perfil. Tu acceso se conserva; intentá nuevamente.'), {
          code: 'PROFILE_UNAVAILABLE', cause,
        });
      }
      await new Promise(resolve => setTimeout(resolve, [150, 400][attempt]));
    }
  }
}

async function synchronizeSession(authSession, { refresh = false } = {}) {
  if (signingOut || !authSession?.user?.id) throw cancelled();
  if (latestAuthSession?.user.id !== authSession.user.id) clearRealSession();
  latestAuthSession = authSession;
  if (currentSession) {
    currentSession = { ...currentSession, auth: authSession, user: authSession.user };
  }
  // Explicit login, restoration and SIGNED_IN share one request/retry chain.
  if (profileFlight?.generation === generation) return profileFlight.promise;
  if (currentSession && !refresh) return currentSession;

  const expectedGeneration = generation;
  const flight = { generation: expectedGeneration, promise: null };
  flight.promise = Promise.resolve().then(async () => {
    const profile = await loadProfile(expectedGeneration);
    if (generation !== expectedGeneration) throw cancelled();
    if (!profile || profile.status !== 'activo') {
      // Only a successful, current profile response confirms a disabled account.
      await closeRealSession().catch(() => {});
      throw Object.assign(new Error('La cuenta no está habilitada. Contactá a AFUCOA.'), { code: 'ACCOUNT_DISABLED' });
    }
    currentSession = {
      demo: false, auth: latestAuthSession, user: latestAuthSession.user, profile,
    };
    return currentSession;
  }).finally(() => {
    if (profileFlight === flight) profileFlight = null;
  });
  profileFlight = flight;
  return flight.promise;
}

async function handleAuthStateChange(event, _snapshot) {
  if (signingOut) return;
  if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY'].includes(event)) return;
  const observedGeneration = generation;
  let authSession;
  try {
    // Events are deferred outside the Auth lock. Reconcile with the SDK instead
    // of applying an old queued snapshot after logout or a newer login.
    authSession = await getAuthSession();
  } catch { return; } // An outage is not proof that the user signed out.
  if (signingOut || generation !== observedGeneration) return;
  if (!authSession) {
    if (event === 'SIGNED_OUT') { clearRealSession(); sessionChanged(); }
    return;
  }
  const previousUser = currentSession?.user?.id;
  const previousRole = currentSession?.profile?.role;
  try {
    await synchronizeSession(authSession, { refresh: event === 'USER_UPDATED' });
    // Refreshing tokens/repeated SIGNED_IN must not remount a form being saved.
    if (previousUser !== currentSession?.user?.id || previousRole !== currentSession?.profile?.role) sessionChanged();
  } catch {
    // The loader closes Auth ONLY for ACCOUNT_DISABLED; transport/RPC errors
    // retain the SDK tokens and any last validated profile. Never sign out here.
  }
}

export function getSession() { return currentSession; }
export function getAppMode() { return appMode; }
export function isAdminSession() { return ['admin', 'superadmin'].includes(currentSession?.profile?.role); }

export async function bootstrapSession() {
  if (appMode === 'demo') {
    try { currentSession = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); }
    catch { currentSession = null; }
    return currentSession;
  }

  unsubscribeAuth?.();
  unsubscribeAuth = onAuthStateChange(handleAuthStateChange);
  const observedGeneration = generation;
  try {
    const authSession = await getAuthSession();
    if (authSession && observedGeneration === generation) await synchronizeSession(authSession);
  } catch { /* Retry on the next Auth event or explicit login; keep Auth intact. */ }
  return currentSession;
}


export async function startRealSession(authResult) {
  const authSession = authResult?.session || authResult;
  if (!authSession) throw new Error('Supabase no devolvió una sesión válida.');
  const currentAuth = await getAuthSession();
  if (!currentAuth || currentAuth.user.id !== authSession.user.id) throw cancelled();
  return synchronizeSession(currentAuth);
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
  return synchronizeSession(latestAuthSession, { refresh: true });
}

export async function endSession() {
  if (appMode === 'demo') {
    localStorage.removeItem(SESSION_KEY);
    currentSession = null;
    return;
  }
  await closeRealSession();
}
