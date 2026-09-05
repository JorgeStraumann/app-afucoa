import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const policyText = await readFile(new URL('config/production-security-headers.json', root), 'utf8');
const policy = JSON.parse(policyText);
const headers = policy.headers;

function directives(csp) {
  return new Map(csp.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const [name, ...values] = part.split(/\s+/);
    return [name, values];
  }));
}

test('existe una política de headers exclusiva de PROD y parametrizada', () => {
  assert.equal(policy.schemaVersion, 1);
  assert.equal(policy.environment, 'production-only');
  assert.equal(policy.applyToStaging, false);
  assert.equal(policy.originVariable, 'AFUCOA_PROD_ORIGIN');
  assert.equal(policy.supabaseOriginPlaceholder, '{{SUPABASE_PROD_ORIGIN}}');
});

test('CSP contiene todas las directivas estrictas requeridas', () => {
  const csp = directives(headers['Content-Security-Policy']);
  const expected = [
    'default-src', 'script-src', 'style-src', 'img-src', 'font-src', 'connect-src',
    'worker-src', 'manifest-src', 'object-src', 'base-uri', 'frame-ancestors', 'form-action',
  ];
  for (const name of expected) assert.ok(csp.has(name), `falta ${name}`);
  assert.deepEqual(csp.get('default-src'), ["'none'"]);
  assert.deepEqual(csp.get('script-src'), ["'self'"]);
  assert.deepEqual(csp.get('style-src'), ["'self'"]);
  assert.deepEqual(csp.get('img-src'), ["'self'"]);
  assert.deepEqual(csp.get('font-src'), ["'self'"]);
  assert.deepEqual(csp.get('connect-src'), ["'self'", '{{SUPABASE_PROD_ORIGIN}}']);
  assert.deepEqual(csp.get('worker-src'), ["'self'"]);
  assert.deepEqual(csp.get('manifest-src'), ["'self'"]);
  assert.deepEqual(csp.get('object-src'), ["'none'"]);
  assert.deepEqual(csp.get('base-uri'), ["'self'"]);
  assert.deepEqual(csp.get('frame-ancestors'), ["'none'"]);
  assert.deepEqual(csp.get('form-action'), ["'self'"]);
  assert.ok(csp.has('upgrade-insecure-requests'));
});

test('CSP no admite wildcard, unsafe-eval ni inline sin excepción', () => {
  const csp = directives(headers['Content-Security-Policy']);
  for (const name of ['script-src', 'connect-src']) assert.ok(!csp.get(name).includes('*'));
  assert.ok(!policyText.includes("'unsafe-eval'"));
  assert.ok(!policyText.includes("'unsafe-inline'"));
  assert.deepEqual(policy.inlineStyleExceptions, []);
});

test('embedding, MIME sniffing, referrer, permisos y HSTS quedan definidos', () => {
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
  assert.match(headers['Permissions-Policy'], /microphone=\(\)/);
  assert.match(headers['Strict-Transport-Security'], /^max-age=\d+/);
  assert.equal(policy.applyToStaging, false);
});

test('política no contiene referencias DEV, staging o localhost', () => {
  for (const forbidden of ['imiplnspvmsrsuikulwm', 'jorgestraumann.github.io', '/app-afucoa/', 'localhost', '127.0.0.1']) {
    assert.ok(!policyText.toLowerCase().includes(forbidden.toLowerCase()));
  }
});

test('cache diferencia shell HTML, worker, manifest y assets con hash', () => {
  const rules = new Map(policy.cacheRules.map((rule) => [rule.id, rule]));
  assert.match(rules.get('html-shell').headers['Cache-Control'], /no-cache/);
  assert.match(rules.get('html-shell').headers['Cache-Control'], /must-revalidate/);
  assert.match(rules.get('service-worker').headers['Cache-Control'], /no-cache/);
  assert.equal(rules.get('service-worker').headers['Service-Worker-Allowed'], '{{AFUCOA_PUBLIC_BASE}}');
  assert.match(rules.get('web-manifest').headers['Cache-Control'], /max-age=0/);
  assert.equal(rules.get('hashed-assets').requiresContentHash, true);
  assert.match(rules.get('hashed-assets').headers['Cache-Control'], /max-age=31536000/);
  assert.match(rules.get('hashed-assets').headers['Cache-Control'], /immutable/);
});

test('no existe workflow PROD activo y el template es inequívocamente no ejecutable', async () => {
  const workflows = await readdir(new URL('.github/workflows/', root));
  assert.deepEqual(workflows.filter((name) => /prod(?:uction)?/i.test(name)), []);
  const template = await readFile(new URL('ops/templates/afucoa-v2-production-workflow.yml', root), 'utf8');
  assert.ok(template.startsWith('# TEMPLATE - NOT EXECUTED BY GITHUB ACTIONS.'));
  for (const forbidden of ['imiplnspvmsrsuikulwm', 'jorgestraumann.github.io', 'localhost']) {
    assert.ok(!template.toLowerCase().includes(forbidden.toLowerCase()));
  }
});
