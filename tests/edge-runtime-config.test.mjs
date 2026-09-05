import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const runtimeSource = (await readFile(
  new URL('supabase/functions/_shared/runtime-config.ts', root), 'utf8',
)).replace(/^export /gm, '');
const pushHttpSource = (await readFile(
  new URL('supabase/functions/_shared/push-http.ts', root), 'utf8',
)).replace(/^import .*;?\r?\n/gm, '').replace(/^export /gm, '');
const api = vm.runInNewContext(
  `${runtimeSource}\n${pushHttpSource}\n;({loadRuntimeConfig,requestOriginAllowed,corsHeaders,preflight})`,
  { URL, Request, Response, Set, Object, Error, JSON, createClient: () => ({}) },
);

const secret = 'synthetic-server-secret-never-log';
const base = {
  AFUCOA_ENV: 'dev',
  AFUCOA_ALLOWED_ORIGINS: 'https://dev.example.test',
  SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: secret,
};

function config(overrides = {}) {
  const values = { ...base, ...overrides };
  return api.loadRuntimeConfig((name) => values[name]);
}

function rejected(overrides) {
  assert.throws(() => config(overrides), (error) => {
    assert.equal(error.message, 'runtime_configuration_invalid');
    assert.doesNotMatch(error.message, /synthetic|server-secret|supabase\.co/);
    return true;
  });
}

test('AFUCOA_ENV ausente o inválido falla cerrado', () => {
  rejected({ AFUCOA_ENV: undefined });
  rejected({ AFUCOA_ENV: 'staging' });
});

test('origins ausentes, wildcard, path y entradas vacías se rechazan', () => {
  rejected({ AFUCOA_ALLOWED_ORIGINS: undefined });
  rejected({ AFUCOA_ALLOWED_ORIGINS: '*' });
  rejected({ AFUCOA_ALLOWED_ORIGINS: 'https://app.example.test/path' });
  rejected({ AFUCOA_ALLOWED_ORIGINS: 'https://one.example.test,,https://two.example.test' });
});

test('SUPABASE_URL ausente, HTTP o ajena a Supabase falla cerrado', () => {
  rejected({ SUPABASE_URL: undefined });
  rejected({ SUPABASE_URL: 'http://abcdefghijklmnopqrst.supabase.co' });
  rejected({ SUPABASE_URL: 'https://database.example.test' });
  rejected({ SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co/rest/v1' });
});

test('service-role ausente falla cerrado y no es enumerable', () => {
  rejected({ SUPABASE_SERVICE_ROLE_KEY: undefined });
  const loaded = config();
  assert.equal(loaded.serviceRoleKey, secret);
  assert.doesNotMatch(JSON.stringify(loaded), /synthetic-server-secret-never-log/);
});

test('prod rechaza HTTP, localhost y loopback', () => {
  rejected({ AFUCOA_ENV: 'prod', AFUCOA_ALLOWED_ORIGINS: 'http://prod.example.test' });
  rejected({ AFUCOA_ENV: 'prod', AFUCOA_ALLOWED_ORIGINS: 'https://localhost' });
  rejected({ AFUCOA_ENV: 'prod', AFUCOA_ALLOWED_ORIGINS: 'https://127.0.0.1' });
});

test('prod rechaza staging GitHub y project ref DEV', () => {
  rejected({ AFUCOA_ENV: 'prod', AFUCOA_ALLOWED_ORIGINS: 'https://jorgestraumann.github.io' });
  rejected({ AFUCOA_ENV: 'prod', SUPABASE_URL: 'https://imiplnspvmsrsuikulwm.supabase.co' });
});

test('prod acepta solamente configuración HTTPS explícita y separada', () => {
  const loaded = config({
    AFUCOA_ENV: 'prod',
    AFUCOA_ALLOWED_ORIGINS: 'https://app.afucoa.example',
    SUPABASE_URL: 'https://zyxwvutsrqponmlkjihg.supabase.co',
  });
  assert.equal(loaded.env, 'prod');
  assert.equal(loaded.supabaseUrl, 'https://zyxwvutsrqponmlkjihg.supabase.co');
});

test('dev permite localhost solo si está declarado explícitamente', () => {
  const local = config({ AFUCOA_ALLOWED_ORIGINS: 'http://localhost:5173' });
  assert.equal(api.requestOriginAllowed(new Request('https://edge.test', {
    method: 'POST', headers: { origin: 'http://localhost:5173' },
  }), local), true);
  assert.equal(api.requestOriginAllowed(new Request('https://edge.test', {
    method: 'POST', headers: { origin: 'http://localhost:4173' },
  }), local), false);
});

test('origin permitido recibe CORS exacto y Vary Origin', () => {
  const loaded = config();
  const request = new Request('https://edge.test', {
    method: 'OPTIONS', headers: { origin: 'https://dev.example.test' },
  });
  const response = api.preflight(request, loaded);
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://dev.example.test');
  assert.equal(response.headers.get('vary'), 'Origin');
});

test('origin no permitido devuelve 403 sin fallback ni reflexión', async () => {
  const loaded = config();
  const response = api.preflight(new Request('https://edge.test', {
    method: 'OPTIONS', headers: { origin: 'https://evil.example' },
  }), loaded);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
  assert.deepEqual(JSON.parse(await response.text()), { error: 'forbidden' });
});

test('server-to-server sin Origin admite POST pero no OPTIONS', () => {
  const loaded = config();
  assert.equal(api.requestOriginAllowed(new Request('https://edge.test', { method: 'POST' }), loaded), true);
  assert.equal(api.preflight(new Request('https://edge.test', { method: 'POST' }), loaded), null);
  assert.equal(api.preflight(new Request('https://edge.test', { method: 'OPTIONS' }), loaded).status, 403);
});

test('origins se normalizan sin aceptar path, query o fragment', () => {
  const loaded = config({ AFUCOA_ALLOWED_ORIGINS: 'HTTPS://DEV.EXAMPLE.TEST/' });
  assert.equal(loaded.allowedOrigins.has('https://dev.example.test'), true);
  rejected({ AFUCOA_ALLOWED_ORIGINS: 'https://dev.example.test?x=1' });
  rejected({ AFUCOA_ALLOWED_ORIGINS: 'https://dev.example.test#fragment' });
});
