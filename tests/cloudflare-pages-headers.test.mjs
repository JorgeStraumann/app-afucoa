import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  CLOUDFLARE_HEADERS_MODES,
  loadProductionSecurityPolicy,
  materializeCloudflarePagesHeaders,
} from '../scripts/lib/cloudflare-pages-headers.mjs';

const policy = await loadProductionSecurityPolicy(
  new URL('../config/production-security-headers.json', import.meta.url),
);
const prodOrigin = 'https://rywdochyzhgfaymrmxek.supabase.co';

function build(mode = CLOUDFLARE_HEADERS_MODES.TEMPORARY) {
  return materializeCloudflarePagesHeaders(policy, {
    supabaseOrigin: prodOrigin,
    publicBase: '/',
    mode,
  });
}

test('foundation materializa CSP estricta y headers de seguridad sin HSTS', () => {
  const output = build();
  assert.match(output, /Content-Security-Policy: default-src 'none'/);
  assert.match(output, new RegExp(`connect-src 'self' ${prodOrigin.replaceAll('.', '\\.')};`));
  assert.doesNotMatch(output, /connect-src[^\n]*(?:\*|unsafe-inline|unsafe-eval)/);
  assert.match(output, /X-Content-Type-Options: nosniff/);
  assert.match(output, /Referrer-Policy: no-referrer/);
  assert.match(output, /Permissions-Policy: camera=\(\), microphone=\(\)/);
  assert.match(output, /X-Frame-Options: DENY/);
  assert.match(output, /X-Robots-Tag: noindex/);
  assert.doesNotMatch(output, /Strict-Transport-Security/);
});

test('modo dominio canónico conserva exactamente la política HSTS versionada', () => {
  const output = build(CLOUDFLARE_HEADERS_MODES.CANONICAL);
  assert.match(output, /Strict-Transport-Security: max-age=31536000; includeSubDomains/);
  assert.doesNotMatch(output, /X-Robots-Tag: noindex/);
});

test('cache separa shell, manifest, worker y assets hashed', () => {
  const output = build();
  assert.match(output, /\/\n  Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(output, /\/index\.html\n  Cache-Control: no-cache, no-store, must-revalidate/);
  assert.match(output, /\/manifest\.webmanifest\n  Cache-Control: public, max-age=0, must-revalidate/);
  assert.match(output, /\/push-sw\.js\n  Cache-Control: no-cache, no-store, must-revalidate\n  Service-Worker-Allowed: \//);
  assert.match(output, /\/assets\/\*\n  Cache-Control: public, max-age=31536000, immutable/);
});

test('foundation no contiene placeholders ni referencias DEV/staging', () => {
  const output = build();
  for (const forbidden of ['{{', '}}', 'imiplnspvmsrsuikulwm', 'jorgestraumann.github.io', '/app-afucoa/', 'localhost']) {
    assert.ok(!output.toLowerCase().includes(forbidden.toLowerCase()));
  }
});

test('el adaptador es build-only y no contamina public/staging', async () => {
  await assert.rejects(
    readFile(new URL('../public/_headers', import.meta.url), 'utf8'),
    (error) => error?.code === 'ENOENT',
  );
});

test('modo HSTS, origen y base deben declararse de forma válida', () => {
  assert.throws(() => materializeCloudflarePagesHeaders(policy, {
    supabaseOrigin: prodOrigin,
    publicBase: '/',
  }), /modo HSTS explícito/);
  assert.throws(() => materializeCloudflarePagesHeaders(policy, {
    supabaseOrigin: 'https://imiplnspvmsrsuikulwm.supabase.co',
    publicBase: '/app-afucoa/',
    mode: CLOUDFLARE_HEADERS_MODES.TEMPORARY,
  }), /base raíz/);
});
