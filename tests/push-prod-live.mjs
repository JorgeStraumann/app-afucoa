import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'rywdochyzhgfaymrmxek';
const PROD_ORIGIN = 'https://afucoa-v2-prod.pages.dev';
const SYNTHETIC_SOURCE = 'phase3i_push_prod_synthetic';
const url = process.env.SUPABASE_URL || '';
const serverKey = process.env.SUPABASE_SECRET_KEY || '';
const confirmation = process.env.AFUCOA_PUSH_PROD_LIVE_CONFIRM || '';

if (url !== `https://${PROJECT_REF}.supabase.co`) throw new Error('SUPABASE_URL no corresponde a PROD.');
if (confirmation !== PROJECT_REF) throw new Error('Falta confirmación exacta de PROD para el test LIVE.');
if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(serverKey)) throw new Error('Falta una Secret API Key PROD válida.');

const secretBearer = `Bearer ${serverKey}`;
const secretKeyFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (headers.get('authorization') === secretBearer) headers.delete('authorization');
  return fetch(input, { ...init, headers });
};
const options = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: secretKeyFetch },
};
const adminDb = createClient(url, serverKey, options);
const state = {
  identities: [],
  adminClient: null,
  adminFactorId: null,
  adminTotp: null,
  notificationId: null,
  notificationIds: [],
  cleaned: false,
  cleaning: false,
};

function strongPassword() {
  return `Aa1!${randomBytes(30).toString('base64url')}`;
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(value).replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('TOTP sintético inválido.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 30_000);
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(message).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

function copySecret(value) {
  const copied = spawnSync('clip.exe', { input: value, encoding: 'utf8', windowsHide: true });
  if (copied.status !== 0) throw new Error('No se pudo cargar el dato temporal en el portapapeles.');
}

function clearClipboard() {
  spawnSync('clip.exe', { input: '', encoding: 'utf8', windowsHide: true });
}

function userClient() {
  return createClient(url, serverKey, options);
}

async function invoke(name, token, body = {}, origin = PROD_ORIGIN) {
  return fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      origin,
    },
    body: JSON.stringify(body),
  });
}

async function login(identity) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: identity.email,
    password: identity.password,
  });
  assert.equal(error, null);
  assert.ok(data?.session?.access_token);
  return { client, session: data.session };
}

async function currentToken(client) {
  const { data, error } = await client.auth.getSession();
  assert.equal(error, null);
  assert.ok(data?.session?.access_token);
  return data.session.access_token;
}

async function enrollAdminMfa(client) {
  const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'AFUCOA Phase 3I synthetic',
  });
  assert.equal(enrollError, null);
  assert.ok(enrolled?.id && enrolled?.totp?.secret);
  state.adminFactorId = enrolled.id;
  state.adminTotp = enrolled.totp.secret;
  const { data: challenged, error: challengeError } = await client.auth.mfa.challenge({ factorId: enrolled.id });
  assert.equal(challengeError, null);
  const { error: verifyError } = await client.auth.mfa.verify({
    factorId: enrolled.id,
    challengeId: challenged.id,
    code: totp(state.adminTotp),
  });
  assert.equal(verifyError, null);
  const assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  assert.equal(assurance.error, null);
  assert.equal(assurance.data.currentLevel, 'aal2');
}

async function ensureAdminAal2() {
  let client = state.adminClient;
  let assurance = client ? await client.auth.mfa.getAuthenticatorAssuranceLevel() : { error: true };
  if (!client || assurance.error) {
    const identity = state.identities.find((item) => item.role === 'admin');
    ({ client } = await login(identity));
    state.adminClient = client;
    assurance = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  }
  if (assurance.data.currentLevel !== 'aal2') {
    const challenged = await client.auth.mfa.challenge({ factorId: state.adminFactorId });
    assert.equal(challenged.error, null);
    const verified = await client.auth.mfa.verify({
      factorId: state.adminFactorId,
      challengeId: challenged.data.id,
      code: totp(state.adminTotp),
    });
    assert.equal(verified.error, null);
  }
  return client;
}

async function removeStaleSyntheticData() {
  const profiles = await adminDb.from('profiles').select('id,auth_user_id').eq('migration_source', SYNTHETIC_SOURCE);
  if (profiles.error) throw profiles.error;
  for (const profile of profiles.data || []) {
    const recipients = await adminDb.from('notification_recipients').select('notification_id').eq('profile_id', profile.id);
    if (recipients.error) throw recipients.error;
    const notificationIds = [...new Set((recipients.data || []).map((item) => item.notification_id))];
    if (notificationIds.length) {
      const notifications = await adminDb.from('notifications').delete().in('id', notificationIds);
      if (notifications.error) throw notifications.error;
    }
    const devices = await adminDb.from('push_devices').delete().eq('profile_id', profile.id);
    if (devices.error) throw devices.error;
    const deleted = await adminDb.from('profiles').delete().eq('id', profile.id);
    if (deleted.error) throw deleted.error;
    if (profile.auth_user_id) await adminDb.auth.admin.deleteUser(profile.auth_user_id).catch(() => {});
  }
}

async function assertProdEmpty() {
  const profiles = await adminDb.from('profiles').select('id', { count: 'exact', head: true });
  assert.equal(profiles.error, null);
  assert.equal(profiles.count, 0, 'PROD contiene profiles ajenos al test; se aborta.');
  const users = await adminDb.auth.admin.listUsers({ page: 1, perPage: 50 });
  assert.equal(users.error, null);
  assert.equal(users.data.users.length, 0, 'PROD contiene Auth users ajenos al test; se aborta.');
}

async function createIdentity(role, ordinal) {
  const suffix = `${Date.now()}${ordinal}`;
  const documentNumber = `98${suffix}`;
  const email = `${documentNumber}@auth.afucoa.local`;
  const password = strongPassword();
  const created = await adminDb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic_test: 'phase3i_push_prod' },
  });
  if (created.error) throw created.error;
  const identity = { role, email, password, documentNumber, authUserId: created.data.user.id, profileId: null };
  state.identities.push(identity);
  const profile = await adminDb.from('profiles').insert({
    auth_user_id: identity.authUserId,
    role,
    first_name: 'Synthetic',
    last_name: role === 'admin' ? 'Push Admin' : 'Push Member',
    document_number: documentNumber,
    member_number: `SYN-PUSH-${role.toUpperCase()}-${suffix}`,
    status: 'activo',
    migration_source: SYNTHETIC_SOURCE,
    migration_external_id: `${role}-${suffix}`,
  }).select('id').single();
  if (profile.error) throw profile.error;
  identity.profileId = profile.data.id;
  return identity;
}

async function securityChecks() {
  const noJwt = await fetch(`${url}/functions/v1/push-config`, {
    method: 'POST', headers: { apikey: serverKey, origin: PROD_ORIGIN, 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(noJwt.status, 401);

  const socio = state.identities.find((item) => item.role === 'socio');
  const socioLogin = await login(socio);
  const socioConfig = await invoke('push-config', socioLogin.session.access_token);
  assert.equal(socioConfig.status, 200);
  const configBody = await socioConfig.json();
  assert.equal(configBody.enabled, true);
  assert.match(configBody.publicKey || '', /^[A-Za-z0-9_-]{80,}$/);
  assert.deepEqual(Object.keys(configBody).sort(), ['enabled', 'publicKey']);
  const socioSend = await invoke('send-notification-push', socioLogin.session.access_token, {
    notification_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.equal(socioSend.status, 403);
  const stagingDenied = await invoke('push-config', socioLogin.session.access_token, {}, 'https://jorgestraumann.github.io');
  assert.equal(stagingDenied.status, 403);
  const foreignDenied = await invoke('push-config', socioLogin.session.access_token, {}, 'https://evil.invalid');
  assert.equal(foreignDenied.status, 403);
  await socioLogin.client.auth.signOut({ scope: 'local' });

  const admin = state.identities.find((item) => item.role === 'admin');
  const adminLogin = await login(admin);
  const aal1Denied = await invoke('send-notification-push', adminLogin.session.access_token, {
    notification_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.equal(aal1Denied.status, 403);
  state.adminClient = adminLogin.client;
  await enrollAdminMfa(state.adminClient);
  const aal2Allowed = await invoke('send-notification-push', await currentToken(state.adminClient), {
    notification_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.equal(aal2Allowed.status, 404);
}

async function deviceSummary() {
  const socio = state.identities.find((item) => item.role === 'socio');
  const devices = await adminDb.from('push_devices').select('id,active,platform').eq('profile_id', socio.profileId);
  if (devices.error) throw devices.error;
  const active = (devices.data || []).filter((item) => item.active);
  return { registered: devices.data.length, active: active.length, platforms: active.map((item) => item.platform) };
}

async function createNotification(fresh = false) {
  if (state.notificationId && !fresh) return state.notificationId;
  const socio = state.identities.find((item) => item.role === 'socio');
  const notification = await adminDb.from('notifications').insert({
    type: 'sistema',
    title: 'AFUCOA PROD PUSH SYNTHETIC',
    body: 'Contenido sintético de Fase 3I.',
    target_path: '#/notificaciones',
  }).select('id').single();
  if (notification.error) throw notification.error;
  state.notificationId = notification.data.id;
  state.notificationIds.push(state.notificationId);
  const recipient = await adminDb.from('notification_recipients').insert({
    notification_id: state.notificationId,
    profile_id: socio.profileId,
  });
  if (recipient.error) throw recipient.error;
  return state.notificationId;
}

async function sendNotification(fresh = false) {
  const client = await ensureAdminAal2();
  const notificationId = await createNotification(fresh);
  const response = await invoke('send-notification-push', await currentToken(client), { notification_id: notificationId });
  const body = await response.json();
  assert.equal(response.status, 200);
  return { http: response.status, ...body };
}

async function ledgerSummary() {
  if (!state.notificationId) return { rows: 0, statuses: {}, attempts: [] };
  const result = await adminDb.from('notification_push_deliveries')
    .select('status,attempts').eq('notification_id', state.notificationId);
  if (result.error) throw result.error;
  const statuses = {};
  for (const row of result.data || []) statuses[row.status] = (statuses[row.status] || 0) + 1;
  return { rows: result.data.length, statuses, attempts: result.data.map((row) => row.attempts) };
}

async function cleanup() {
  if (state.cleaned || state.cleaning) return;
  state.cleaning = true;
  clearClipboard();
  await state.adminClient?.auth.signOut({ scope: 'local' }).catch(() => {});
  if (state.notificationIds.length) {
    const deleted = await adminDb.from('notifications').delete().in('id', state.notificationIds);
    if (deleted.error) throw deleted.error;
  }
  for (const identity of [...state.identities].reverse()) {
    if (identity.profileId) {
      const devices = await adminDb.from('push_devices').delete().eq('profile_id', identity.profileId);
      if (devices.error) throw devices.error;
      const profile = await adminDb.from('profiles').delete().eq('id', identity.profileId);
      if (profile.error) throw profile.error;
    }
    const user = await adminDb.auth.admin.deleteUser(identity.authUserId);
    if (user.error && user.error.status !== 404) throw user.error;
    identity.password = null;
  }
  state.adminTotp = null;
  const users = await adminDb.auth.admin.listUsers({ page: 1, perPage: 50 });
  const profiles = await adminDb.from('profiles').select('id', { count: 'exact', head: true });
  const devices = await adminDb.from('push_devices').select('id', { count: 'exact', head: true });
  const notifications = await adminDb.from('notifications').select('id', { count: 'exact', head: true });
  const deliveries = await adminDb.from('notification_push_deliveries').select('notification_id', { count: 'exact', head: true });
  assert.equal(users.error, null);
  assert.equal(profiles.error, null);
  assert.equal(devices.error, null);
  assert.equal(notifications.error, null);
  assert.equal(deliveries.error, null);
  assert.equal(users.data.users.length, 0);
  assert.equal(profiles.count, 0);
  assert.equal(devices.count, 0);
  assert.equal(notifications.count, 0);
  assert.equal(deliveries.count, 0);
  state.cleaned = true;
  state.cleaning = false;
  console.log(JSON.stringify({ event: 'cleanup_complete', auth_users: 0, profiles: 0, push_devices: 0, notifications: 0, deliveries: 0 }));
}

async function handle(command) {
  const socio = state.identities.find((item) => item.role === 'socio');
  const admin = state.identities.find((item) => item.role === 'admin');
  if (command === 'copy-socio-document') copySecret(socio.documentNumber);
  else if (command === 'copy-socio-email') copySecret(socio.email);
  else if (command === 'copy-socio-password') copySecret(socio.password);
  else if (command === 'copy-admin-email') copySecret(admin.email);
  else if (command === 'copy-admin-password') copySecret(admin.password);
  else if (command === 'copy-admin-totp') copySecret(totp(state.adminTotp));
  else if (command === 'devices') console.log(JSON.stringify({ event: 'devices', ...(await deviceSummary()) }));
  else if (command === 'send') console.log(JSON.stringify({ event: 'send', ...(await sendNotification()) }));
  else if (command === 'new-send') console.log(JSON.stringify({ event: 'new-send', ...(await sendNotification(true)) }));
  else if (command === 'retry') console.log(JSON.stringify({ event: 'retry', ...(await sendNotification()) }));
  else if (command === 'ledger') console.log(JSON.stringify({ event: 'ledger', ...(await ledgerSummary()) }));
  else if (command === 'cleanup' || command === 'abort') {
    await cleanup();
    process.exit(0);
  } else if (command === 'help') {
    console.log(JSON.stringify({ event: 'commands', commands: ['copy-socio-document', 'copy-socio-password', 'devices', 'send', 'new-send', 'retry', 'ledger', 'cleanup'] }));
  } else throw new Error('Comando LIVE desconocido.');
  if (command.startsWith('copy-')) console.log(JSON.stringify({ event: 'clipboard_ready', field: command.slice(5) }));
}

async function main() {
  await removeStaleSyntheticData();
  await assertProdEmpty();
  await createIdentity('socio', 1);
  await createIdentity('admin', 2);
  await securityChecks();
  console.log(JSON.stringify({
    event: 'ready',
    project_ref: PROJECT_REF,
    identities_created: 2,
    security: {
      no_jwt_denied: true,
      socio_aal1_push_config: true,
      socio_send_denied: true,
      admin_aal1_send_denied: true,
      admin_aal2_send_allowed: true,
      prod_origin_allowed: true,
      staging_and_foreign_origins_denied: true,
    },
  }));
  const terminal = createInterface({ input: process.stdin, crlfDelay: Infinity });
  terminal.on('line', async (line) => {
    terminal.pause();
    try { await handle(line.trim()); }
    catch (error) {
      console.error(JSON.stringify({ event: 'command_failed', message: error?.message || 'unknown' }));
    } finally { terminal.resume(); }
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => cleanup().finally(() => process.exit(1)));
}

main().catch(async (error) => {
  console.error(JSON.stringify({ event: 'startup_failed', message: error?.message || 'unknown' }));
  try { await cleanup(); } finally { process.exit(1); }
});
