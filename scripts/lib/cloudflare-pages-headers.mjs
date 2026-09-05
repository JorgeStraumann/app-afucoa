import { readFile } from 'node:fs/promises';

export const CLOUDFLARE_HEADERS_MODES = Object.freeze({
  TEMPORARY: 'temporary-hostname',
  CANONICAL: 'canonical-domain',
});

const HSTS_HEADER = 'Strict-Transport-Security';

function fail(message) {
  throw new Error(`Cloudflare Pages headers: ${message}`);
}

function replacePlaceholders(value, { supabaseOrigin, publicBase }) {
  return value
    .replaceAll('{{SUPABASE_PROD_ORIGIN}}', supabaseOrigin)
    .replaceAll('{{AFUCOA_PUBLIC_BASE}}', publicBase);
}

function assertHeaderValue(name, value) {
  if (typeof value !== 'string' || !value.trim()) fail(`${name} debe tener un valor no vacío.`);
  if (/\r|\n/.test(value)) fail(`${name} contiene un salto de línea.`);
}

function assertCsp(csp, supabaseOrigin) {
  if (csp.includes('{{') || csp.includes('}}')) fail('CSP conserva placeholders sin resolver.');
  if (/\b(?:unsafe-inline|unsafe-eval)\b/.test(csp)) fail('CSP contiene una directiva insegura.');
  const connect = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith('connect-src '));
  if (connect !== `connect-src 'self' ${supabaseOrigin}`) {
    fail("connect-src debe contener exclusivamente 'self' y Supabase PROD.");
  }
}

function routeBlock(route, headers) {
  if (typeof route !== 'string' || !route.startsWith('/') || /\r|\n/.test(route)) {
    fail(`ruta inválida: ${route}`);
  }
  const lines = [route];
  for (const [name, value] of Object.entries(headers)) {
    assertHeaderValue(name, value);
    lines.push(`  ${name}: ${value}`);
  }
  return lines.join('\n');
}

export function materializeCloudflarePagesHeaders(policy, options) {
  const { supabaseOrigin, publicBase, mode } = options;
  if (!Object.values(CLOUDFLARE_HEADERS_MODES).includes(mode)) fail('modo HSTS explícito inválido o ausente.');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(supabaseOrigin)) fail('origen Supabase PROD inválido.');
  if (publicBase !== '/') fail('el foundation PROD de Cloudflare debe usar base raíz /.');
  if (policy?.environment !== 'production-only' || policy?.applyToStaging !== false) {
    fail('la política debe ser exclusivamente PROD y no aplicable a staging.');
  }

  const globalHeaders = {};
  for (const [name, template] of Object.entries(policy.headers || {})) {
    if (name === HSTS_HEADER && mode === CLOUDFLARE_HEADERS_MODES.TEMPORARY) continue;
    globalHeaders[name] = replacePlaceholders(template, { supabaseOrigin, publicBase });
  }
  if (mode === CLOUDFLARE_HEADERS_MODES.CANONICAL
      && globalHeaders[HSTS_HEADER] !== 'max-age=31536000; includeSubDomains') {
    fail('la política HSTS canónica fue alterada.');
  }
  if (mode === CLOUDFLARE_HEADERS_MODES.TEMPORARY) globalHeaders['X-Robots-Tag'] = 'noindex';
  assertCsp(globalHeaders['Content-Security-Policy'], supabaseOrigin);

  const blocks = [routeBlock('/*', globalHeaders)];
  for (const rule of policy.cacheRules || []) {
    const headers = Object.fromEntries(Object.entries(rule.headers || {}).map(([name, value]) => [
      name,
      replacePlaceholders(value, { supabaseOrigin, publicBase }),
    ]));
    for (const route of rule.match || []) {
      blocks.push(routeBlock(replacePlaceholders(route, { supabaseOrigin, publicBase }), headers));
    }
  }

  return `${blocks.join('\n\n')}\n`;
}

export async function loadProductionSecurityPolicy(url) {
  return JSON.parse(await readFile(url, 'utf8'));
}

