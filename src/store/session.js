import { appMode } from '../services/supabase.js';
import { fetchMyProfile } from '../services/profile-service.js';
import { getAuthSession, onAuthStateChange, signOut as authSignOut } from '../services/auth-service.js';
import { getMfaStatus } from '../services/mfa-service.js';
import { reconcilePushSubscription } from '../services/push-service.js';

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

function isPrivilegedProfile(profile) {
  return ['admin', 'superadmin'].includes(profile?.role);
}

async function resolveMfaState(profile) {
  if (!isPrivilegedProfile(profile)) {
    return { required: false, mode: 'not_required', currentLevel: 'aal1', nextLevel: 'aal1', factorId: null };
  }
  try {
    const status = await getMfaStatus();
    return { ...status, required: status.currentLevel !== 'aal2' };
  } catch {
    // A transient Auth/MFA error is not a disabled account. Keep the Auth
    // session, fail closed for Administration, and expose a retry-only gate.
    return { required: true, mode: 'unavailable', currentLevel: 'aal1', nextLevel: null, factorId: null };
  }
}

async function synchronizeSession(authSession, { refresh = false, refreshMfa = false } = {}) {
  if (signingOut || !authSession?.user?.id) throw cancelled();
  if (latestAuthSession?.user.id !== authSession.user.id) clearRealSession();
  latestAuthSession = authSession;
  if (currentSession) {
    currentSession = { ...currentSession, auth: authSession, user: authSession.user };
  }
  // Explicit login, restoration and SIGNED_IN share one request/retry chain.
  if (profileFlight?.generation === generation) return profileFlight.promise;
  if (currentSession && refreshMfa && !refresh) {
    const expectedGeneration = generation;
    const mfa = await resolveMfaState(currentSession.profile);
    if (generation !== expectedGeneration) throw cancelled();
    currentSession = { ...currentSession, auth: latestAuthSession, user: latestAuthSession.user, mfa };
    return currentSession;
  }
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
    // An existing browser subscription survives logout. Reconcile it before
    // exposing the new app session so a shared browser cannot keep the old owner.
    await reconcilePushSubscription(profile.id);
    if (generation !== expectedGeneration) throw cancelled();
    const mfa = await resolveMfaState(profile);
    if (generation !== expectedGeneration) throw cancelled();
    currentSession = {
      demo: false, auth: latestAuthSession, user: latestAuthSession.user, profile, mfa,
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
  if (!['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT', 'TOKEN_REFRESHED', 'USER_UPDATED', 'PASSWORD_RECOVERY', 'MFA_CHALLENGE_VERIFIED'].includes(event)) return;
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
  const previousMfaMode = currentSession?.mfa?.mode;
  const previousAal = currentSession?.mfa?.currentLevel;
  try {
    await synchronizeSession(authSession, {
      refresh: event === 'USER_UPDATED',
      refreshMfa: event === 'TOKEN_REFRESHED' || event === 'MFA_CHALLENGE_VERIFIED',
    });
    // Refreshing tokens/repeated SIGNED_IN must not remount a form being saved.
    if (previousUser !== currentSession?.user?.id
      || previousRole !== currentSession?.profile?.role
      || previousMfaMode !== currentSession?.mfa?.mode
      || previousAal !== currentSession?.mfa?.currentLevel) sessionChanged();
  } catch {
    // The loader closes Auth ONLY for ACCOUNT_DISABLED; transport/RPC errors
    // retain the SDK tokens and any last validated profile. Never sign out here.
  }
}

export function getSession() { return currentSession; }
export function getAppMode() { return appMode; }
export function isMfaRequiredSession() { return Boolean(currentSession?.mfa?.required); }
export function isAdminSession() {
  if (currentSession?.demo) return ['admin', 'superadmin'].includes(currentSession?.profile?.role);
  return isPrivilegedProfile(currentSession?.profile) && currentSession?.mfa?.currentLevel === 'aal2';
}

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
    mfa: { required: false, mode: 'not_required', currentLevel: 'aal2', nextLevel: 'aal2', factorId: null },
  };
  currentSession = session;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export async function refreshProfile() {
  if (appMode !== 'supabase' || !currentSession) return currentSession;
  return synchronizeSession(latestAuthSession, { refresh: true });
}

export async function refreshMfaSession() {
  if (appMode !== 'supabase' || !currentSession) return currentSession;
  const authSession = await getAuthSession();
  if (!authSession) throw cancelled();
  return synchronizeSession(authSession, { refreshMfa: true });
}

export async function endSession() {
  if (appMode === 'demo') {
    localStorage.removeItem(SESSION_KEY);
    currentSession = null;
    return;
  }
  await closeRealSession();
}
