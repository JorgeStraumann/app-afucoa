import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Execute the production modules, replacing only their imports/browser shell.
export async function loadModule(relativePath, dependencies, exports) {
  const source = (await readFile(new URL('../../' + relativePath, import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/import\.meta\.env\.VITE_AUTH_ALIAS_DOMAIN/g, 'undefined')
    .replace(/^export /gm, '');
  return vm.runInNewContext(`${source}\n;({${exports.join(',')}})`, {
    setTimeout, clearTimeout, console, ...dependencies,
  }, { filename: relativePath });
}

export async function loadSession(dependencies) {
  return loadModule('src/store/session.js', {
    appMode: 'supabase',
    CustomEvent: class { constructor(type) { this.type = type; } },
    window: { dispatchEvent() {} },
    reconcilePushSubscription: async () => ({state:'unavailable'}),
    ...dependencies,
  }, ['bootstrapSession', 'startRealSession', 'getSession', 'refreshProfile', 'endSession', 'isAdminSession']);
}

export async function loadAuth(client) {
  return loadModule('src/services/auth-service.js', {
    appMode: 'supabase', supabase: client, requireSupabase: () => client,
  }, ['onAuthStateChange', 'getAuthSession', 'signInWithDocument', 'signOut']);
}

export async function loadProfile(client) {
  return loadModule('src/services/profile-service.js', {
    appMode: 'supabase', requireSupabase: () => client,
  }, ['fetchMyProfile', 'updateMyContact']);
}
