import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { createClient } from '@supabase/supabase-js';

const PROJECT_REF = 'rywdochyzhgfaymrmxek';
const PROD_ORIGIN = 'https://afucoa-v2-prod.pages.dev';
const SYNTHETIC_SOURCE = 'phase_final_recovery_prod_synthetic';
const PUBLIC_RESPONSE = {
  ok: true,
  message: 'Si la cuenta está habilitada, recibirás un código en breve.',
};
const url = process.env.SUPABASE_URL || '';
const serverKey = process.env.SUPABASE_SECRET_KEY || '';
const recipient = process.env.RECOVERY_TEST_RECIPIENT || '';
const confirmation = process.env.AFUCOA_RECOVERY_PROD_LIVE_CONFIRM || '';

if (url !== `https://${PROJECT_REF}.supabase.co`) throw new Error('SUPABASE_URL no corresponde a PROD.');
if (confirmation !== PROJECT_REF) throw new Error('Falta confirmacion exacta del project ref PROD.');
if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(serverKey)) throw new Error('Falta una Secret API Key PROD valida.');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error('Falta el inbox de prueba local.');

const secretBearer = `Bearer ${serverKey}`;
const secretKeyFetch = async (resource, init = {}) => {
  const headers = new Headers(init.headers);
  if (headers.get('authorization') === secretBearer) headers.delete('authorization');
  return fetch(resource, { ...init, headers });
};
const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  global: { fetch: secretKeyFetch },
};
const adminDb = createClient(url, serverKey, clientOptions);
const state = { identity: null, clients: [], cleaned: false, cleaning: false };

function strongPassword() {
  return `Aa1!${randomBytes(30).toString('base64url')}`;
}

function hash(value) {
  return createHmac('sha256', serverKey).update(value).digest('hex');
}

function userClient() {
  const client = createClient(url, serverKey, clientOptions);
  state.clients.push(client);
  return client;
}

async function login(email, password, expectedSuccess) {
  const client = userClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (expectedSuccess) {
    assert.equal(error, null);
    assert.ok(data?.session?.access_token);
  } else {
    assert.ok(error);
    assert.equal(data?.session, null);
  }
  return client;
}

async function invoke(name, { method = 'POST', body, origin = PROD_ORIGIN } = {}) {
  const headers = { apikey: serverKey, origin };
  if (body !== undefined) headers['content-type'] = 'application/json';
  const startedAt = Date.now();
  const response = await fetch(`${url}/functions/v1/${name}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload = null;
  if (response.status !== 204) {
    try { payload = await response.json(); } catch { payload = null; }
  }
  return { response, payload, latencyMs: Date.now() - startedAt };
}

async function tableCount(table) {
  const result = await adminDb.from(table).select('*', { count: 'exact', head: true });
  if (result.error) throw result.error;
  return result.count;
}

async function authCount() {
  const result = await adminDb.auth.admin.listUsers({ page: 1, perPage: 50 });
  if (result.error) throw result.error;
  return result.data.users.length;
}

async function clearStaleSynthetic() {
  const stale = await adminDb.from('profiles').select('id,auth_user_id').eq('migration_source', SYNTHETIC_SOURCE);
  if (stale.error) throw stale.error;
  for (const profile of stale.data || []) {
    await adminDb.from('password_recovery_codes').delete().eq('profile_id', profile.id);
    const deleted = await adminDb.from('profiles').delete().eq('id', profile.id);
    if (deleted.error) throw deleted.error;
    if (profile.auth_user_id) await adminDb.auth.admin.deleteUser(profile.auth_user_id).catch(() => {});
  }
  if (await tableCount('profiles') === 0) {
    const limits = await adminDb.from('password_recovery_rate_limits').delete()
      .in('scope', ['request_ip', 'request_identity', 'confirm_ip', 'confirm_identity', 'request_global', 'confirm_global']);
    if (limits.error) throw limits.error;
  }
}

async function assertProdEmpty() {
  assert.equal(await authCount(), 0, 'PROD contiene Auth users ajenos al test.');
  for (const table of ['profiles', 'password_recovery_codes', 'password_recovery_rate_limits', 'push_devices', 'notifications', 'notification_push_deliveries']) {
    assert.equal(await tableCount(table), 0, `PROD contiene filas en ${table}.`);
  }
}

async function createIdentity() {
  const suffix = Date.now().toString().slice(-10);
  const documentNumber = `98${suffix}`;
  const email = `${documentNumber}@auth.afucoa.local`;
  const initialPassword = strongPassword();
  const newPassword = strongPassword();
  const created = await adminDb.auth.admin.createUser({
    email,
    password: initialPassword,
    email_confirm: true,
    user_metadata: { synthetic_test: SYNTHETIC_SOURCE },
  });
  if (created.error) throw created.error;
  state.identity = {
    authUserId: created.data.user.id,
    profileId: null,
    documentNumber,
    email,
    initialPassword,
    newPassword,
  };
  const profile = await adminDb.from('profiles').insert({
    auth_user_id: state.identity.authUserId,
    role: 'socio',
    first_name: 'Synthetic',
    last_name: 'Recovery',
    document_number: documentNumber,
    member_number: `SYN-REC-${suffix}`,
    email: recipient,
    status: 'activo',
    migration_source: SYNTHETIC_SOURCE,
    migration_external_id: `recovery-${suffix}`,
  }).select('id').single();
  if (profile.error) throw profile.error;
  state.identity.profileId = profile.data.id;
}

async function securityContract() {
  const preflight = await invoke('request-password-recovery', { method: 'OPTIONS' });
  assert.equal(preflight.response.status, 204);
  assert.equal(preflight.response.headers.get('access-control-allow-origin'), PROD_ORIGIN);

  const foreign = await invoke('request-password-recovery', {
    origin: 'https://example.invalid',
    body: { document_number: '00000000' },
  });
  assert.equal(foreign.response.status, 403);

  const wrongMethod = await invoke('confirm-password-recovery', { method: 'GET' });
  assert.equal(wrongMethod.response.status, 405);
}

async function requestRecoveryAndAssertNeutral() {
  const nonexistent = await invoke('request-password-recovery', {
    body: { document_number: '970000000001' },
  });
  const active = await invoke('request-password-recovery', {
    body: { document_number: state.identity.documentNumber },
  });
  assert.equal(nonexistent.response.status, 200);
  assert.equal(active.response.status, 200);
  assert.deepEqual(nonexistent.payload, PUBLIC_RESPONSE);
  assert.deepEqual(active.payload, PUBLIC_RESPONSE);
  assert.ok(Math.abs(nonexistent.latencyMs - active.latencyMs) < 1_500, 'La diferencia temporal practica excede el umbral.');

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const result = await adminDb.from('password_recovery_codes')
      .select('id,delivery_status,consumed_at,invalidated_at,expires_at')
      .eq('profile_id', state.identity.profileId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    if (result.data?.delivery_status === 'sent') return result.data;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error('El delivery de Recovery no llego a status=sent.');
}

async function readMaskedCode() {
  if (process.env.AFUCOA_RECOVERY_LOCAL_RELAY === '1') {
    const terminal = createInterface({ input, output });
    try {
      return (await terminal.question('Pega el codigo de 8 digitos recibido y presiona Enter: ')).trim();
    } finally {
      terminal.close();
    }
  }
  if (!input.isTTY || typeof input.setRawMode !== 'function') throw new Error('Se requiere una terminal interactiva para introducir el codigo.');
  output.write('Pega el codigo de 8 digitos recibido y presiona Enter: ');
  input.setRawMode(true);
  input.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003') {
          input.off('data', onData);
          input.setRawMode(false);
          reject(new Error('Prueba interrumpida.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          input.off('data', onData);
          input.setRawMode(false);
          input.pause();
          output.write('\n');
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length) {
            value = value.slice(0, -1);
            output.write('\b \b');
          }
        } else if (/\d/.test(character) && value.length < 8) {
          value += character;
          output.write('*');
        }
      }
    };
    input.on('data', onData);
  });
}

async function confirmSubject() {
  const terminal = createInterface({ input, output });
  try {
    const answer = await terminal.question('El asunto visible es "Codigo para recuperar tu acceso a AFUCOA"? Escribi SI: ');
    assert.equal(answer.trim().toUpperCase(), 'SI', 'No se confirmo el asunto del email.');
  } finally {
    terminal.close();
  }
}

async function insertCodeFixture(code, expiresAt) {
  const id = randomUUID();
  const inserted = await adminDb.from('password_recovery_codes').insert({
    id,
    profile_id: state.identity.profileId,
    auth_user_id: state.identity.authUserId,
    code_hash: hash(`${id}:${code}`),
    expires_at: expiresAt,
    max_attempts: 5,
    delivery_status: 'sent',
    request_ip_hash: hash(`fixture:${id}`),
  });
  if (inserted.error) throw inserted.error;
  return id;
}

async function confirmCode(code, password = state.identity.newPassword) {
  return invoke('confirm-password-recovery', {
    body: {
      document_number: state.identity.documentNumber,
      code,
      new_password: password,
    },
  });
}

async function recoveryStateMachine(realCode, recoveryRow) {
  assert.match(realCode, /^\d{8}$/);
  const success = await confirmCode(realCode);
  assert.equal(success.response.status, 200);
  assert.deepEqual(success.payload, { ok: true });

  const consumed = await adminDb.from('password_recovery_codes')
    .select('delivery_status,consumed_at,invalidated_at').eq('id', recoveryRow.id).single();
  assert.equal(consumed.error, null);
  assert.equal(consumed.data.delivery_status, 'sent');
  assert.ok(consumed.data.consumed_at);
  assert.equal(consumed.data.invalidated_at, null);

  await login(state.identity.email, state.identity.initialPassword, false);
  const newLogin = await login(state.identity.email, state.identity.newPassword, true);
  await newLogin.auth.signOut({ scope: 'local' });

  const reused = await confirmCode(realCode);
  assert.equal(reused.response.status, 400);
  assert.deepEqual(reused.payload, { error: 'invalid_code' });

  const fixtureCode = '31415926';
  const attemptId = await insertCodeFixture(fixtureCode, new Date(Date.now() + 10 * 60_000).toISOString());
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const incorrect = await confirmCode('27182818');
    assert.equal(incorrect.response.status, 400);
    assert.deepEqual(incorrect.payload, { error: 'invalid_code' });
  }
  const locked = await adminDb.from('password_recovery_codes')
    .select('attempts,max_attempts,invalidated_at').eq('id', attemptId).single();
  assert.equal(locked.error, null);
  assert.equal(locked.data.attempts, 5);
  assert.equal(locked.data.max_attempts, 5);
  assert.ok(locked.data.invalidated_at);

  const expiredCode = '16180339';
  const expiredId = await insertCodeFixture(expiredCode, new Date(Date.now() - 60_000).toISOString());
  const expired = await confirmCode(expiredCode);
  assert.equal(expired.response.status, 400);
  assert.deepEqual(expired.payload, { error: 'invalid_code' });
  const expiredRow = await adminDb.from('password_recovery_codes')
    .select('invalidated_at').eq('id', expiredId).single();
  assert.equal(expiredRow.error, null);
  assert.ok(expiredRow.data.invalidated_at);
}

async function rateLimitContract() {
  const subjectHash = hash(`rate-limit-fixture:${randomUUID()}`);
  const results = [];
  for (let hit = 0; hit < 4; hit += 1) {
    const result = await adminDb.rpc('take_password_recovery_rate_limit', {
      p_scope: 'confirm_identity',
      p_subject_hash: subjectHash,
      p_limit: 3,
      p_window_seconds: 3600,
      p_block_seconds: 3600,
    });
    if (result.error) throw result.error;
    results.push(result.data);
  }
  assert.deepEqual(results, [true, true, true, false]);
}

async function cleanup() {
  if (state.cleaned || state.cleaning) return;
  state.cleaning = true;
  for (const client of state.clients) await client.auth.signOut({ scope: 'local' }).catch(() => {});
  if (state.identity?.profileId) {
    await adminDb.from('password_recovery_codes').delete().eq('profile_id', state.identity.profileId);
    const profile = await adminDb.from('profiles').delete().eq('id', state.identity.profileId);
    if (profile.error) throw profile.error;
  }
  if (state.identity?.authUserId) {
    const user = await adminDb.auth.admin.deleteUser(state.identity.authUserId);
    if (user.error && user.error.status !== 404) throw user.error;
  }
  const limits = await adminDb.from('password_recovery_rate_limits').delete()
    .in('scope', ['request_ip', 'request_identity', 'confirm_ip', 'confirm_identity', 'request_global', 'confirm_global']);
  if (limits.error) throw limits.error;
  if (state.identity) {
    state.identity.initialPassword = null;
    state.identity.newPassword = null;
    state.identity.email = null;
    state.identity.documentNumber = null;
  }
  await assertProdEmpty();
  for (const bucket of ['documents-private', 'request-files', 'public-media']) {
    const listed = await adminDb.storage.from(bucket).list('', { limit: 1 });
    assert.equal(listed.error, null);
    assert.equal(listed.data.length, 0, `Storage ${bucket} no esta vacio.`);
  }
  state.cleaned = true;
  state.cleaning = false;
  console.log(JSON.stringify({ event: 'cleanup_complete', auth_users: 0, profiles: 0, recovery_codes: 0, rate_limits: 0, storage_objects: 0, business_data: 0 }));
}

async function main() {
  await clearStaleSynthetic();
  await assertProdEmpty();
  await createIdentity();
  const initialLogin = await login(state.identity.email, state.identity.initialPassword, true);
  await initialLogin.auth.signOut({ scope: 'local' });
  await securityContract();
  const recoveryRow = await requestRecoveryAndAssertNeutral();
  console.log(JSON.stringify({ event: 'delivery_accepted', provider: 'brevo', delivery_status: 'sent', public_response_neutral: true }));
  await confirmSubject();
  const realCode = await readMaskedCode();
  await recoveryStateMachine(realCode, recoveryRow);
  await rateLimitContract();
  console.log(JSON.stringify({ event: 'recovery_prod_e2e_pass', delivery: 'confirmed', password_changed: true, old_password_rejected: true, new_password_accepted: true, reused_code_rejected: true, incorrect_code_rejected: true, expired_code_rejected: true, rate_limits: 'pass' }));
  await cleanup();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => cleanup().finally(() => process.exit(1)));
}

main().catch(async (error) => {
  console.error(JSON.stringify({ event: 'recovery_prod_e2e_failed', message: error?.message || 'unknown' }));
  try { await cleanup(); } finally { process.exit(1); }
});
