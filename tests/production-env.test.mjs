import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductionEnv } from '../scripts/lib/production-env.mjs';

const valid = Object.freeze({
  VITE_AFUCOA_MODE: 'supabase',
  VITE_SUPABASE_URL: 'https://prodartifacttest01.supabase.co',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_prod_artifact_ci_only_000000000001',
  VITE_AUTH_ALIAS_DOMAIN: 'auth.synthetic.internal',
  AFUCOA_PUBLIC_BASE: '/',
});

function rejected(overrides) {
  assert.throws(() => validateProductionEnv({ ...valid, ...overrides }), { name: 'ProductionConfigError' });
}

function serviceRoleJwt() {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'service_role' })}.synthetic`;
}

test('configuración PROD sintética válida y base raíz pasan sin exponer la key', () => {
  const config = validateProductionEnv(valid);
  assert.equal(config.mode, 'supabase');
  assert.equal(config.publicBase, '/');
  assert.equal(config.projectRef, 'prodartifacttest01');
  assert.equal(config.publishableKey, valid.VITE_SUPABASE_PUBLISHABLE_KEY);
  assert.equal(Object.keys(config).includes('publishableKey'), false);
});

test('VITE_AFUCOA_MODE es obligatorio y exactamente supabase', () => {
  rejected({ VITE_AFUCOA_MODE: undefined });
  rejected({ VITE_AFUCOA_MODE: 'demo' });
});

test('falta VITE_SUPABASE_URL falla cerrado', () => rejected({ VITE_SUPABASE_URL: undefined }));

test('URL DEV se rechaza expresamente', () => {
  rejected({ VITE_SUPABASE_URL: 'https://imiplnspvmsrsuikulwm.supabase.co' });
});

test('localhost y hosts ajenos a Supabase se rechazan', () => {
  rejected({ VITE_SUPABASE_URL: 'https://localhost' });
  rejected({ VITE_SUPABASE_URL: 'https://api.example.test' });
});

test('URL insegura, con credenciales, puerto, path, query o fragment se rechaza', () => {
  for (const value of [
    'http://prodartifacttest01.supabase.co',
    'https://user:password@prodartifacttest01.supabase.co',
    'https://prodartifacttest01.supabase.co:8443',
    'https://prodartifacttest01.supabase.co/rest/v1',
    'https://prodartifacttest01.supabase.co?x=1',
    'https://prodartifacttest01.supabase.co#fragment',
  ]) rejected({ VITE_SUPABASE_URL: value });
});

test('falta publishable key falla cerrado', () => rejected({ VITE_SUPABASE_PUBLISHABLE_KEY: undefined }));

test('secret key y service-role key se rechazan', () => {
  rejected({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_synthetic_forbidden_000000000000' });
  rejected({ VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_service_role_synthetic_forbidden_000000000000' });
});

test('JWT con role service_role se rechaza', () => {
  rejected({ VITE_SUPABASE_PUBLISHABLE_KEY: serviceRoleJwt() });
});

test('formatos que no son sb_publishable se rechazan', () => {
  rejected({ VITE_SUPABASE_PUBLISHABLE_KEY: 'not-a-publishable-key' });
});

test('cualquier nombre VITE_* privilegiado se rechaza', () => {
  for (const name of [
    'VITE_SUPABASE_SERVICE_ROLE_KEY',
    'VITE_APP_SECRET',
    'VITE_VAPID_PRIVATE_KEY',
    'VITE_RESEND_API_KEY',
  ]) rejected({ [name]: 'synthetic-forbidden' });
});

test('nombres privilegiados en archivos de entorno que cargaría Vite también se rechazan', () => {
  assert.throws(
    () => validateProductionEnv(valid, { additionalEnvs: [{ VITE_RESEND_TOKEN: 'synthetic-forbidden' }] }),
    { name: 'ProductionConfigError' },
  );
});

test('secretos server-side presentes en el proceso de build se rechazan', () => {
  for (const name of ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'VAPID_PRIVATE_KEY', 'RESEND_API_KEY']) {
    rejected({ [name]: 'synthetic-forbidden' });
  }
});

test('AFUCOA_PUBLIC_BASE es obligatoria y rechaza staging', () => {
  rejected({ AFUCOA_PUBLIC_BASE: undefined });
  rejected({ AFUCOA_PUBLIC_BASE: '/app-afucoa/' });
});

test('bases mal formadas, URLs, traversal, query y fragment se rechazan', () => {
  for (const value of ['prod/', '/prod', 'https://app.example/', '/../', '/prod//app/', '/prod/?x=1', '/prod/#x', '/%2e%2e/']) {
    rejected({ AFUCOA_PUBLIC_BASE: value });
  }
});

test('alias domain interno es obligatorio y no requiere dominio web público', () => {
  assert.equal(validateProductionEnv({ ...valid, VITE_AUTH_ALIAS_DOMAIN: 'auth.afucoa.local' }).aliasDomain, 'auth.afucoa.local');
  rejected({ VITE_AUTH_ALIAS_DOMAIN: undefined });
  rejected({ VITE_AUTH_ALIAS_DOMAIN: 'https://auth.example.test' });
  rejected({ VITE_AUTH_ALIAS_DOMAIN: 'invalid_domain' });
});
