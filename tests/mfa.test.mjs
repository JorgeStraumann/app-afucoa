import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { loadModule, loadSession } from './helpers/session-harness.mjs';

const root = new URL('../', import.meta.url);
const authSession = { user: { id: 'auth-synthetic' }, access_token: 'opaque-token' };

async function mfaService(mfa) {
  const client = { auth: { mfa } };
  return loadModule('src/services/mfa-service.js', { requireSupabase: () => client }, [
    'getMfaStatus', 'beginTotpEnrollment', 'verifyTotp', 'cancelUnverifiedTotp', 'publicMfaError',
  ]);
}

async function sessionFor(profile, mfaStatus) {
  let status = mfaStatus;
  const api = await loadSession({
    fetchMyProfile: async () => profile,
    getAuthSession: async () => authSession,
    onAuthStateChange: () => () => {},
    authSignOut: async () => {},
    getMfaStatus: async () => status,
  });
  await api.startRealSession(authSession);
  return { api, setMfa: (value) => { status = value; } };
}

const ready = { currentLevel: 'aal2', nextLevel: 'aal2', mode: 'ready', factorId: 'factor-1' };
const challenge = { currentLevel: 'aal1', nextLevel: 'aal2', mode: 'challenge', factorId: 'factor-1' };
const enrollment = { currentLevel: 'aal1', nextLevel: 'aal1', mode: 'enrollment', factorId: null };

test('socio AAL1 continúa permitido sin gate MFA', async () => {
  const { api } = await sessionFor({ id: 'p-socio', role: 'socio', status: 'activo' }, challenge);
  assert.equal(api.isMfaRequiredSession(), false);
  assert.equal(api.isAdminSession(), false);
  assert.equal(api.getSession().mfa.mode, 'not_required');
});

for (const role of ['admin', 'superadmin']) {
  test(`${role} AAL1 queda bloqueado y requiere challenge`, async () => {
    const { api } = await sessionFor({ id: `p-${role}`, role, status: 'activo' }, challenge);
    assert.equal(api.isMfaRequiredSession(), true);
    assert.equal(api.isAdminSession(), false);
    assert.equal(api.getSession().mfa.mode, 'challenge');
  });

  test(`${role} AAL2 queda habilitado`, async () => {
    const { api } = await sessionFor({ id: `p-${role}`, role, status: 'activo' }, ready);
    assert.equal(api.isMfaRequiredSession(), false);
    assert.equal(api.isAdminSession(), true);
  });
}

test('profile lookup mínimo funciona en AAL1 y factor ausente obliga enrollment', async () => {
  let lookups = 0;
  const api = await loadSession({
    fetchMyProfile: async () => { lookups += 1; return { id: 'p-admin', role: 'admin', status: 'activo' }; },
    getAuthSession: async () => authSession,
    onAuthStateChange: () => () => {},
    authSignOut: async () => {},
    getMfaStatus: async () => enrollment,
  });
  await api.startRealSession(authSession);
  assert.equal(lookups, 1);
  assert.equal(api.getSession().mfa.mode, 'enrollment');
  assert.equal(api.isAdminSession(), false);
});

test('AAL2 desbloquea y refresh/browser reopen conserva política fail-closed', async () => {
  const fixture = await sessionFor({ id: 'p-admin', role: 'admin', status: 'activo' }, challenge);
  fixture.setMfa(ready);
  await fixture.api.refreshMfaSession();
  assert.equal(fixture.api.isAdminSession(), true);
  fixture.setMfa(challenge);
  await fixture.api.refreshMfaSession();
  assert.equal(fixture.api.isAdminSession(), false);
  assert.equal(fixture.api.getSession().mfa.mode, 'challenge');
});

test('cuenta inactiva permanece separada de MFA', async () => {
  let mfaCalls = 0;
  const api = await loadSession({
    fetchMyProfile: async () => ({ id: 'p-admin', role: 'admin', status: 'inactivo' }),
    getAuthSession: async () => authSession,
    onAuthStateChange: () => () => {},
    authSignOut: async () => {},
    getMfaStatus: async () => { mfaCalls += 1; return ready; },
  });
  await assert.rejects(api.startRealSession(authSession), { code: 'ACCOUNT_DISABLED' });
  assert.equal(mfaCalls, 0);
  assert.equal(api.getSession(), null);
});

test('servicio oficial distingue enrollment/challenge/ready y verifica TOTP', async () => {
  const calls = [];
  const mfa = {
    getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null }),
    listFactors: async () => ({ data: { totp: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }], all: [] }, error: null }),
    challenge: async ({ factorId }) => { calls.push(['challenge', factorId]); return { data: { id: 'challenge-1' }, error: null }; },
    verify: async (input) => { calls.push(['verify', input]); return { data: { access_token: 'updated' }, error: null }; },
  };
  const service = await mfaService(mfa);
  assert.deepEqual(JSON.parse(JSON.stringify(await service.getMfaStatus())), challenge);
  await service.verifyTotp({ factorId: 'factor-1', code: '123456' });
  assert.deepEqual(calls[0], ['challenge', 'factor-1']);
  assert.equal(calls[1][1].challengeId, 'challenge-1');
  await assert.rejects(service.verifyTotp({ factorId: 'factor-1', code: 'not-a-code' }), /invalid_mfa_code/);
});

test('enrollment limpia solo factores TOTP no verificados y no persiste el secreto', async () => {
  const removed = [];
  const service = await mfaService({
    listFactors: async () => ({ data: { all: [
      { id: 'stale', factor_type: 'totp', status: 'unverified' },
      { id: 'verified', factor_type: 'totp', status: 'verified' },
    ], totp: [{ id: 'verified', factor_type: 'totp', status: 'verified' }] }, error: null }),
    unenroll: async ({ factorId }) => { removed.push(factorId); return { error: null }; },
    enroll: async () => ({ data: { id: 'new-factor', totp: { secret: 'TRANSIENT', uri: 'otpauth://totp/example' } }, error: null }),
  });
  const result = await service.beginTotpEnrollment();
  assert.deepEqual(removed, ['stale']);
  assert.equal(result.factorId, 'new-factor');

  const [serviceSource, pageSource] = await Promise.all([
    readFile(new URL('src/services/mfa-service.js', root), 'utf8'),
    readFile(new URL('src/pages/mfa/mfa.js', root), 'utf8'),
  ]);
  assert.doesNotMatch(serviceSource + pageSource, /localStorage|sessionStorage|indexedDB/i);
  assert.match(pageSource, /pendingEnrollment = null/);
  assert.match(pageSource, /QRCode\.toCanvas/);
});

test('router exige gate antes de cualquier pantalla y AAL2 para rutas admin', async () => {
  const app = await readFile(new URL('src/app.js', root), 'utf8');
  assert.match(app, /registerRoute\('\/mfa'.*mfaGate: true/);
  assert.match(app, /session\?\.mfa\?\.required && path !== '\/mfa'/);
  assert.match(app, /route\.adminOnly && !isAdminSession\(\)/);
  const store = await readFile(new URL('src/store/session.js', root), 'utf8');
  assert.match(store, /isPrivilegedProfile\(currentSession\?\.profile\) && currentSession\?\.mfa\?\.currentLevel === 'aal2'/);
});

test('guard central impide bypass SECURITY DEFINER, RLS directo y Storage', async () => {
  const migration = await readFile(new URL('supabase/migrations/20260906182340_privileged_aal2_enforcement.sql', root), 'utf8');
  assert.match(migration, /create or replace function public\.is_privileged_aal2\(\)[\s\S]*security definer/);
  assert.match(migration, /p\.role in \('admin', 'superadmin'\)[\s\S]*p\.status = 'activo'/);
  assert.match(migration, /auth\.jwt\(\) ->> 'aal', 'aal1'\) = 'aal2'/);
  assert.match(migration, /create or replace function public\.is_admin\(\)[\s\S]*select public\.is_privileged_aal2\(\)/);
  assert.doesNotMatch(migration, /create or replace function public\.get_my_profile/);

  const names = (await readdir(new URL('supabase/migrations/', root))).filter((name) => name.endsWith('.sql')).sort();
  const historical = (await Promise.all(names.slice(0, -1).map((name) => readFile(new URL(`supabase/migrations/${name}`, root), 'utf8')))).join('\n');
  const privilegedPolicies = [...historical.matchAll(/create policy ([a-z0-9_]+)[\s\S]*?;/gi)]
    .map((match) => match[0])
    .filter((sql) => /admin/i.test(sql));
  assert.ok(privilegedPolicies.length >= 25);
  assert.ok(privilegedPolicies.every((sql) => /public\.is_admin\(\)/i.test(sql)));
  assert.match(historical, /security definer[\s\S]*public\.is_admin\(\)/i);
  assert.match(historical, /on storage\.objects[\s\S]*public\.is_admin\(\)/i);
});

test('UI diferencia enrollment/challenge y usa errores públicos neutros', async () => {
  const page = await readFile(new URL('src/pages/mfa/mfa.js', root), 'utf8');
  assert.match(page, /Configurar verificación en dos pasos/);
  assert.match(page, /<h1>Verificación en dos pasos<\/h1>/);
  assert.doesNotMatch(page, /SMS|teléfono/i);
  const service = await mfaService({});
  assert.equal(service.publicMfaError(), 'No pudimos verificar el código. Revisalo e intentá nuevamente.');
});

test('runner LIVE es fail-closed, sintético, server-side y siempre solicita cleanup', async () => {
  const [runner, devWrapper, prodWrapper] = await Promise.all([
    readFile(new URL('tests/mfa-lifecycle-synthetic.mjs', root), 'utf8'),
    readFile(new URL('scripts/run-mfa-live-dev.ps1', root), 'utf8'),
    readFile(new URL('scripts/run-mfa-live-prod.ps1', root), 'utf8'),
  ]);
  assert.match(runner, /AFUCOA_MFA_LIVE_CONFIRM/);
  assert.match(runner, /SUPABASE_SECRET_KEY/);
  assert.doesNotMatch(runner, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(runner, /headers\.delete\('authorization'\)/);
  assert.match(runner, /finally\s*\{[\s\S]*await cleanup\(\)/);
  assert.match(runner, /deleteUser\(identity\.authUserId\)/);
  assert.match(runner, /migration_source: 'phase3h_synthetic'/);
  assert.match(runner, /signOut\(loginState\.session\.access_token, 'global'\)/);
  assert.doesNotMatch(runner, /console\.(log|info|warn|error)\([^\n]*(password|secret|serverKey)/i);
  assert.match(devWrapper, /AFUCOA_DEV_SECRET_KEY/);
  assert.match(devWrapper, /SUPABASE_SECRET_KEY = \$env:AFUCOA_DEV_SECRET_KEY/);
  assert.match(devWrapper, /AFUCOA_MFA_LIVE_PROJECT_REF = 'imiplnspvmsrsuikulwm'/);
  assert.doesNotMatch(devWrapper, /Write-Host|echo|Get-ChildItem\s+Env:/i);
  assert.match(prodWrapper, /AFUCOA_PROD_SECRET_KEY/);
  assert.match(prodWrapper, /SUPABASE_SECRET_KEY = \$env:AFUCOA_PROD_SECRET_KEY/);
  assert.match(prodWrapper, /AFUCOA_MFA_LIVE_PROJECT_REF = 'rywdochyzhgfaymrmxek'/);
  assert.doesNotMatch(prodWrapper, /AFUCOA_DEV_SECRET_KEY|Write-Host|echo|Get-ChildItem\s+Env:/i);
});
