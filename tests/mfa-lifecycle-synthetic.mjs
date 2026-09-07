import assert from 'node:assert/strict';
import { createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const ALLOWED_PROJECTS = new Set(['imiplnspvmsrsuikulwm', 'rywdochyzhgfaymrmxek']);
const projectRef = process.env.AFUCOA_MFA_LIVE_PROJECT_REF || '';
const expectedConfirmation = process.env.AFUCOA_MFA_LIVE_CONFIRM || '';
const supabaseUrl = process.env.SUPABASE_URL || '';
const serverKey = process.env.SUPABASE_SECRET_KEY || '';

if (!ALLOWED_PROJECTS.has(projectRef)) throw new Error('AFUCOA_MFA_LIVE_PROJECT_REF no autorizado.');
if (expectedConfirmation !== projectRef) throw new Error('Falta confirmación exacta del project ref LIVE.');
if (supabaseUrl !== `https://${projectRef}.supabase.co`) throw new Error('SUPABASE_URL no coincide con el project ref confirmado.');
if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(serverKey)) {
  throw new Error('Falta una SUPABASE_SECRET_KEY válida en el entorno local seguro.');
}

const secretBearer = `Bearer ${serverKey}`;
const secretKeyFetch = async (input, init = {}) => {
  const headers = new Headers(init.headers);
  if (headers.get('authorization') === secretBearer) headers.delete('authorization');
  return fetch(input, { ...init, headers });
};

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: secretKeyFetch },
};
const adminClient = createClient(supabaseUrl, serverKey, clientOptions);
const created = [];
const runSuffix = Date.now().toString().slice(-10);
let transientSecrets = [];
let transientPasswords = [];
let edgeSecretRuntimeValidated = false;

function strongPassword() {
  return `Aa1!${randomBytes(30).toString('base64url')}`;
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(value).replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('El secret TOTP sintético no usa Base32 válido.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
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

function userClient() {
  // The privileged key remains only in this server-side process. Once signed
  // in, supabase-js sends the user's JWT as Authorization, so RLS/AAL apply.
  return createClient(supabaseUrl, serverKey, clientOptions);
}

async function requireProfile(client, role) {
  const { data, error } = await client.rpc('get_my_profile');
  assert.equal(error, null);
  assert.equal(data?.[0]?.role, role);
  return data[0];
}

async function assurance(client, currentLevel, nextLevel) {
  const { data, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  assert.equal(error, null);
  assert.equal(data.currentLevel, currentLevel);
  assert.equal(data.nextLevel, nextLevel);
}

async function privilegedDenied(client) {
  const { error } = await client.rpc('admin_update_request', {
    p_request_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.match(String(error?.message || ''), /not_authorized/i);
}

async function privilegedAuthorized(client) {
  const { error } = await client.rpc('admin_update_request', {
    p_request_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.match(String(error?.message || ''), /request_not_found/i);
}

async function currentAccessToken(client) {
  const { data, error } = await client.auth.getSession();
  assert.equal(error, null);
  assert.ok(data?.session?.access_token);
  return data.session.access_token;
}

async function invokeEdge(name, accessToken, body) {
  return fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      apikey: serverKey,
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      origin: 'https://jorgestraumann.github.io',
    },
    body: JSON.stringify(body),
  });
}

async function validateDevEdgeSecretRuntime(identity, client, aal1Token) {
  if (projectRef !== 'imiplnspvmsrsuikulwm') return;
  const aal1Push = await invokeEdge('send-notification-push', aal1Token, {
    notification_id: '00000000-0000-0000-0000-000000000000',
  });
  assert.equal(aal1Push.status, 403);

  const aal2Token = await currentAccessToken(client);
  const [pushConfig, aal2Push, recoveryRequest, recoveryConfirm] = await Promise.all([
    invokeEdge('push-config', aal2Token, {}),
    invokeEdge('send-notification-push', aal2Token, {
      notification_id: '00000000-0000-0000-0000-000000000000',
    }),
    invokeEdge('request-password-recovery', aal2Token, { document_number: identity.documentNumber }),
    invokeEdge('confirm-password-recovery', aal2Token, {
      document_number: identity.documentNumber,
      code: '00000000',
      new_password: strongPassword(),
    }),
  ]);
  assert.equal(pushConfig.status, 200);
  assert.equal(aal2Push.status, 404);
  assert.equal(recoveryRequest.status, 200);
  assert.equal(recoveryConfirm.status, 400);
  edgeSecretRuntimeValidated = true;
}

async function enrollAndVerify(client) {
  const { data: enrolled, error: enrollError } = await client.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: 'AFUCOA Fase 3H sintético',
  });
  assert.equal(enrollError, null);
  assert.ok(enrolled?.id && enrolled?.totp?.secret);
  transientSecrets.push(enrolled.totp.secret);
  const { data: challenged, error: challengeError } = await client.auth.mfa.challenge({ factorId: enrolled.id });
  assert.equal(challengeError, null);
  const { error: verifyError } = await client.auth.mfa.verify({
    factorId: enrolled.id,
    challengeId: challenged.id,
    code: totp(enrolled.totp.secret),
  });
  assert.equal(verifyError, null);
  await assurance(client, 'aal2', 'aal2');
  return { factorId: enrolled.id, secret: enrolled.totp.secret };
}

async function challengeAndVerify(client, factorId, secret) {
  const { data: challenged, error: challengeError } = await client.auth.mfa.challenge({ factorId });
  assert.equal(challengeError, null);
  const { error: verifyError } = await client.auth.mfa.verify({
    factorId,
    challengeId: challenged.id,
    code: totp(secret),
  });
  assert.equal(verifyError, null);
  await assurance(client, 'aal2', 'aal2');
}

async function createSynthetic(role, ordinal) {
  const documentNumber = `99999${runSuffix}${ordinal}`;
  const email = `${documentNumber}@auth.afucoa.local`;
  const password = strongPassword();
  transientPasswords.push(password);
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { synthetic_test: 'phase3h' },
  });
  if (authError) throw authError;
  const authUserId = authData.user.id;
  created.push({ authUserId, profileId: null, email, role, client: null });
  const { data: profile, error: profileError } = await adminClient.from('profiles').insert({
    auth_user_id: authUserId,
    role,
    first_name: 'Synthetic',
    last_name: role === 'admin' ? 'Admin Phase3H' : 'Superadmin Phase3H',
    document_number: documentNumber,
    member_number: `SYN-MFA-${role.toUpperCase()}-${runSuffix}`,
    status: 'activo',
    migration_source: 'phase3h_synthetic',
    migration_external_id: `${role}-${runSuffix}`,
  }).select('id').single();
  if (profileError) throw profileError;
  created.at(-1).profileId = profile.id;
  created.at(-1).password = password;
  created.at(-1).documentNumber = documentNumber;
  return created.at(-1);
}

async function login(identity) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({ email: identity.email, password: identity.password });
  assert.equal(error, null);
  assert.ok(data?.session?.access_token);
  identity.client = client;
  return { client, session: data.session };
}

async function exerciseRole(role, ordinal) {
  const identity = await createSynthetic(role, ordinal);
  let loginState = await login(identity);
  const aal1Token = loginState.session.access_token;
  await assurance(loginState.client, 'aal1', 'aal1');
  await requireProfile(loginState.client, role);
  await privilegedDenied(loginState.client);

  const factor = await enrollAndVerify(loginState.client);
  await privilegedAuthorized(loginState.client);
  if (role === 'admin') await validateDevEdgeSecretRuntime(identity, loginState.client, aal1Token);
  await loginState.client.auth.signOut({ scope: 'local' });

  loginState = await login(identity);
  await assurance(loginState.client, 'aal1', 'aal2');
  await privilegedDenied(loginState.client);
  await challengeAndVerify(loginState.client, factor.factorId, factor.secret);
  await privilegedAuthorized(loginState.client);
  return { identity, loginState, factor };
}

async function exerciseLifecycle(exercise) {
  const { identity, loginState } = exercise;
  const { error: inactiveError } = await adminClient.from('profiles').update({ status: 'inactivo' }).eq('id', identity.profileId);
  assert.equal(inactiveError, null);
  await privilegedDenied(loginState.client);

  const { error: revokeError } = await adminClient.auth.admin.signOut(loginState.session.access_token, 'global');
  assert.equal(revokeError, null);
  const refreshed = await loginState.client.auth.refreshSession();
  assert.ok(refreshed.error || !refreshed.data?.session);
  await loginState.client.auth.signOut({ scope: 'local' }).catch(() => {});

  const { error: activeError } = await adminClient.from('profiles').update({ status: 'activo' }).eq('id', identity.profileId);
  assert.equal(activeError, null);
  const relogin = await login(identity);
  await assurance(relogin.client, 'aal1', 'aal2');
  await privilegedDenied(relogin.client);
  await challengeAndVerify(relogin.client, exercise.factor.factorId, exercise.factor.secret);
  await privilegedAuthorized(relogin.client);
  await relogin.client.auth.signOut({ scope: 'local' });
}

async function cleanup() {
  for (const identity of created) await identity.client?.auth.signOut({ scope: 'local' }).catch(() => {});
  for (const identity of [...created].reverse()) {
    if (identity.profileId) {
      const { error } = await adminClient.from('profiles').delete().eq('id', identity.profileId);
      if (error) throw error;
    }
    const { error } = await adminClient.auth.admin.deleteUser(identity.authUserId);
    if (error && error.status !== 404) throw error;
    identity.password = null;
  }
}

let result;
try {
  const admin = await exerciseRole('admin', 1);
  const superadmin = await exerciseRole('superadmin', 2);
  await exerciseLifecycle(admin);
  result = {
    ok: true,
    project_ref: projectRef,
    identities_created: 2,
    roles: {
      admin: { aal1_denied: true, aal2_pass: true, relogin_challenge: true, lifecycle: true },
      superadmin: { aal1_denied: true, aal2_pass: true, relogin_challenge: true },
    },
    edge_secret_key_runtime: projectRef === 'imiplnspvmsrsuikulwm' ? edgeSecretRuntimeValidated : 'not_applicable',
  };
} finally {
  try {
    await cleanup();
  } finally {
    transientSecrets = [];
    transientPasswords = [];
  }
}

console.log(JSON.stringify({ ...result, cleanup_requested: true }));
