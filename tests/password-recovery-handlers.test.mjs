// Executes the production handlers. Only Supabase I/O, mail delivery and timeouts
// are replaced; cryptographic generation/HMAC and validation are the real code.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { stripTypeScriptTypes } from 'node:module';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

const runtimeConfigSource = (await readFile(
  new URL('../supabase/functions/_shared/runtime-config.ts', import.meta.url), 'utf8',
)).replace(/^export /gm, '');
const sources = Object.fromEntries(await Promise.all(['request', 'confirm'].map(async (name) => {
  const source = await readFile(new URL(`../supabase/functions/${name}-password-recovery/index.ts`, import.meta.url), 'utf8');
  return [name, stripTypeScriptTypes(`${runtimeConfigSource}\n${source.replace(/^import .*\r?\n/gm, '')}`, { mode: 'strip' })];
})));
const password = 'Ficticia-Solo-Test-2026!';
const origin = 'https://jorgestraumann.github.io';

function fixture(options = {}) {
  const profile = { id: 'profile-dev', auth_user_id: 'auth-dev', document_number: '10000001', status: 'activo', email: 'dev@example.test', ...options.profile };
  const rows = [], mail = [], changes = [], logs = [], pending = [], counters = new Map();
  const env = { AFUCOA_ENV: 'dev', AFUCOA_ALLOWED_ORIGINS: origin,
    SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'only-a-synthetic-test-secret',
    RESEND_API_KEY: 'only-a-synthetic-provider-key', RECOVERY_EMAIL_FROM: 'AFUCOA <test@example.test>', ...options.env };
  const client = {
    from(table) {
      const filters = []; let patch;
      const query = {
        select() { return query; }, eq(k,v) { filters.push(r => r[k] === v); return query; },
        is(k,v) { filters.push(r => r[k] === v); return query; },
        order() { return query; }, limit() { return query; },
        update(value) { patch = value; return query; },
        async maybeSingle() {
          const items = (table === 'profiles' ? [profile] : [...rows].reverse()).filter(r => filters.every(f => f(r)));
          return { data: items[0] ?? null, error: null };
        },
        then(resolve) {
          for (const row of rows.filter(r => filters.every(f => f(r)))) Object.assign(row, patch);
          resolve({ error: null });
        },
      };
      return query;
    },
    async rpc(name, p) {
      if (name === 'take_password_recovery_rate_limit') {
        const key = p.p_scope + p.p_subject_hash;
        const count = (counters.get(key) || 0) + 1; counters.set(key, count);
        return { data: options.blockScope !== p.p_scope && count <= p.p_limit, error: null };
      }
      if (name === 'register_password_recovery_code') {
        for (const row of rows) if (!row.consumed_at && !row.invalidated_at) row.invalidated_at = 'now';
        rows.push({ id: p.p_recovery_id, profile_id: p.p_profile_id, auth_user_id: profile.auth_user_id,
          code_hash: p.p_code_hash, expires_at: p.p_expires_at, attempts: 0, max_attempts: 5,
          consumed_at: null, invalidated_at: null, delivery_status: 'pending' });
        return { data: true, error: null };
      }
      if (name === 'consume_password_recovery_code') {
        const row = rows.find(r => r.id === p.p_recovery_id && r.profile_id === p.p_profile_id);
        let result = 'invalid';
        if (row && !row.consumed_at && !row.invalidated_at && row.delivery_status === 'sent'
            && profile.status === 'activo' && row.auth_user_id === profile.auth_user_id) {
          if (Date.parse(row.expires_at) <= Date.now()) { row.invalidated_at='now'; result='expired'; }
          else if (row.code_hash !== p.p_candidate_hash) {
            row.attempts++;
            if (row.attempts >= 5) { row.invalidated_at='now'; result='locked'; }
          } else { row.consumed_at='now'; result='ok'; }
        }
        return { data: result, error: null };
      }
      throw new Error('Unexpected RPC');
    },
    auth: { admin: { async updateUserById(id, value) {
      if (options.authFailure) return { error: new Error('fake Auth failure') };
      changes.push({ id, ...value }); return { error: null };
    } } },
  };
  const handlers = {};
  for (const name of ['request', 'confirm']) {
    const context = vm.createContext({
      createClient: () => client, crypto: webcrypto, URL, Request, Response, TextEncoder, TextDecoder, AbortController,
      setTimeout: (fn, ms) => { if (ms < 10_000) fn(); return 0; }, clearTimeout() {},
      console: { error: value => logs.push(value) },
      Deno: { env: { get: key => env[key] }, serve: fn => { handlers[name] = fn; } },
      EdgeRuntime: { waitUntil: promise => pending.push(promise) },
      fetch: async (url, init) => {
        assert.equal(url, 'https://api.resend.com/emails');
        mail.push(JSON.parse(init.body));
        return new Response('{}', { status: options.mailFailure ? 500 : 200 });
      },
    });
    vm.runInContext(sources[name], context);
  }
  async function call(name, body, headers = {}) {
    const response = await handlers[name](new Request('https://example.test', {
      method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
    }));
    await Promise.all(pending.splice(0));
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  async function issue() {
    const response = await call('request', { document_number: '10000001' });
    return { response, code: mail.at(-1)?.text.match(/es (\d{8})\./)?.[1], row: rows.at(-1) };
  }
  const confirm = code => call('confirm', { document_number: '10000001', code, new_password: password });
  return { issue, confirm, call, handlers, profile, rows, mail, changes, logs };
}

test('neutral para existente, inexistente, inactivo, sin correo y proveedor sin configurar', async () => {
  const normal = fixture(); const result = await normal.issue();
  for (const f of [fixture({profile:{status:'inactivo'}}), fixture({profile:{email:null}}), fixture({env:{RESEND_API_KEY:undefined}})]) {
    assert.deepEqual((await f.issue()).response.body, result.response.body);
    assert.equal(f.mail.length, 0);
  }
  assert.deepEqual((await normal.call('request', {document_number:'99999999'})).body, result.response.body);
  assert.equal(Object.hasOwn(result.response.body, 'code'), false);
});

test('correo, HMAC y cambio correcto; reutilización rechazada', async () => {
  const f = fixture(); const {code,row}=await f.issue();
  assert.match(code, /^\d{8}$/); assert.match(row.code_hash, /^[a-f0-9]{64}$/);
  assert.equal(row.delivery_status, 'sent');
  assert.equal((await f.confirm(code)).status,200);
  assert.deepEqual(f.changes.map(x=>x.id), ['auth-dev']);
  assert.equal(f.changes[0].password,password);
  assert.equal((await f.confirm(code)).status,400);
  assert.equal(f.changes.length,1);
});

test('invalidación anterior y cinco intentos; correcto tras bloqueo rechazado', async () => {
  const f=fixture(); const first=await f.issue(); const second=await f.issue();
  assert.ok(first.row.invalidated_at);
  const wrong=second.code==='00000000'?'11111111':'00000000';
  for(let i=0;i<5;i++) assert.equal((await f.confirm(wrong)).status,400);
  assert.equal(second.row.attempts,5); assert.ok(second.row.invalidated_at);
  assert.equal((await f.confirm(second.code)).status,400); assert.equal(f.changes.length,0);
});

test('expiración e identidad Auth cambiada no modifican contraseña', async () => {
  for (const mode of ['expired','changed']) {
    const f=fixture(); const {code,row}=await f.issue();
    if(mode==='expired') row.expires_at=new Date(Date.now()-1000).toISOString();
    else f.profile.auth_user_id='different-auth';
    assert.equal((await f.confirm(code)).status,400); assert.equal(f.changes.length,0);
  }
});

test('rate limiting por identidad, IP y global impide el envío', async () => {
  for(const blockScope of ['request_identity','request_ip','request_global']) {
    const f=fixture({blockScope}); assert.equal((await f.issue()).response.status,200);
    assert.equal(f.mail.length,0);
  }
  const f=fixture(); for(let i=0;i<4;i++) await f.issue();
  assert.equal(f.mail.length,3);
});

test('correo fallido invalida; fallo de Auth no permite reusar el código', async () => {
  const failMail=fixture({mailFailure:true}); const m=await failMail.issue();
  assert.equal(m.row.delivery_status,'failed'); assert.ok(m.row.invalidated_at);
  const failAuth=fixture({authFailure:true}); const a=await failAuth.issue();
  assert.equal((await failAuth.confirm(a.code)).status,503);
  assert.equal((await failAuth.confirm(a.code)).status,400);
  assert.deepEqual(failAuth.logs,['password_recovery_confirm_failed']);
});

test('CORS, cuerpo inválido y política de contraseña', async () => {
  const f=fixture();
  for(const name of ['request','confirm']) {
    const response=await f.handlers[name](new Request('https://example.test',{method:'OPTIONS',headers:{origin}}));
    assert.equal(response.status,204); assert.equal(response.headers.get('access-control-allow-origin'),origin);
    assert.equal(response.headers.get('vary'),'Origin');
    const rejected=await f.call(name,{}, {origin:'https://evil.invalid'});
    assert.equal(rejected.status,403);assert.equal(rejected.headers.get('access-control-allow-origin'),null);
    const missingOrigin=await f.handlers[name](new Request('https://example.test',{method:'OPTIONS'}));
    assert.equal(missingOrigin.status,403);
  }
  const {code}=await f.issue();
  assert.equal((await f.call('confirm',{document_number:'10000001',code,new_password:'weak'})).status,400);
  assert.equal(f.changes.length,0);
  assert.equal((await f.call('request',{document_number:'x'.repeat(5000)})).status,200);
});

test('configuración inválida falla cerrada sin filtrar secretos', async () => {
  for (const env of [
    { AFUCOA_ENV: undefined },
    { AFUCOA_ALLOWED_ORIGINS: undefined },
    { SUPABASE_URL: undefined },
    { SUPABASE_SERVICE_ROLE_KEY: undefined },
  ]) {
    const f=fixture({env});
    for (const name of ['request','confirm']) {
      const response=await f.call(name,{document_number:'10000001'});
      assert.equal(response.status,503);
      assert.deepEqual(response.body,{error:'temporarily_unavailable'});
      assert.doesNotMatch(JSON.stringify(response.body),/synthetic-test-secret|synthetic-provider-key/);
    }
    assert.equal(f.mail.length,0);
  }
});

test('POST server-to-server sin Origin conserva el contrato y los límites', async () => {
  const f=fixture();
  const response=await f.handlers.request(new Request('https://example.test',{
    method:'POST','headers':{'content-type':'application/json'},body:JSON.stringify({document_number:'10000001'}),
  }));
  await response.json();
  assert.equal(response.status,200);
  assert.equal(response.headers.get('access-control-allow-origin'),null);
});
