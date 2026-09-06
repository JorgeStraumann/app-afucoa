import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { verifyProductionRelease } from './lib/production-pipeline.mjs';

function argument(name, { optional = false } = {}) {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || !process.argv[index + 1]) {
    if (optional) return null;
    throw new Error(`falta --${name}.`);
  }
  return process.argv[index + 1];
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function assertHeader(response, name, pattern) {
  const value = response.headers.get(name) || '';
  if (!pattern.test(value)) throw new Error(`${name} ausente o inválido en ${response.url}.`);
}

function safeRequestLabel(url) {
  const parsed = new URL(url);
  return `${parsed.origin}${parsed.pathname}`;
}

async function get(url, options = {}, { attempts = 4, timeoutMs = 15_000 } = {}) {
  const label = safeRequestLabel(url);
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(timeoutMs),
        ...options,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
  }
  const reason = lastError?.cause?.code || lastError?.name || 'request_failed';
  throw new Error(`falló GET ${label} tras ${attempts} intentos (${reason}).`);
}

async function smoke({ origin, manifestPath, releaseSha, deploymentId }) {
  const expected = new URL('https://afucoa-v2-prod.pages.dev');
  const actual = new URL(origin);
  if (actual.origin !== expected.origin || actual.pathname !== '/' || actual.search || actual.hash) {
    throw new Error('el origin canónico no coincide con AFUCOA V2 PROD.');
  }

  const root = await get(origin);
  if (root.url !== `${origin}/`) throw new Error('el origin canónico redirigió fuera de sí mismo.');
  assertHeader(root, 'strict-transport-security', /max-age=31536000;\s*includeSubDomains/i);
  assertHeader(root, 'content-security-policy', /default-src 'none'/i);
  assertHeader(root, 'content-security-policy', /connect-src 'self' https:\/\/rywdochyzhgfaymrmxek\.supabase\.co/i);
  assertHeader(root, 'x-content-type-options', /^nosniff$/i);
  assertHeader(root, 'referrer-policy', /^no-referrer$/i);
  assertHeader(root, 'x-frame-options', /^DENY$/i);
  assertHeader(root, 'cache-control', /no-(?:cache|store)/i);
  if (/noindex/i.test(root.headers.get('x-robots-tag') || '')) throw new Error('el origin canónico publica X-Robots-Tag noindex.');
  const rootBytes = Buffer.from(await root.arrayBuffer());
  const html = rootBytes.toString('utf8');

  const manifestResponse = await get(`${origin}/manifest.webmanifest`);
  assertHeader(manifestResponse, 'cache-control', /max-age=0/i);
  assertHeader(manifestResponse, 'cache-control', /must-revalidate/i);
  const webManifest = JSON.parse(await manifestResponse.text());
  if (webManifest.start_url !== './') throw new Error('manifest.start_url no es relativo.');

  const worker = await get(`${origin}/push-sw.js`);
  assertHeader(worker, 'service-worker-allowed', /^\/$/);
  assertHeader(worker, 'cache-control', /no-(?:cache|store)/i);
  const workerText = await worker.text();
  if (!workerText.includes("addEventListener('push'") || !workerText.includes("addEventListener('notificationclick'")) {
    throw new Error('push-sw.js no contiene los listeners esperados.');
  }

  const publicText = `${html}\n${workerText}\n${JSON.stringify(webManifest)}`;
  for (const forbidden of ['imiplnspvmsrsuikulwm', 'jorgestraumann.github.io', '/app-afucoa/', 'localhost', '127.0.0.1']) {
    if (publicText.toLowerCase().includes(forbidden.toLowerCase())) throw new Error(`se detectó referencia prohibida: ${forbidden}.`);
  }
  if (/sb_secret_|service_role|SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|RESEND_API_KEY/i.test(publicText)) {
    throw new Error('se detectó material privilegiado en contenido público.');
  }
  if (/\.map(?:["'?#]|$)|sourceMappingURL/i.test(publicText)) throw new Error('se detectó referencia a source maps.');

  let manifestSha256 = null;
  let verifiedFiles = 0;
  if (manifestPath) {
    const release = await verifyProductionRelease({
      manifestPath,
      distDirectory: argument('dist'),
      expectedReleaseSha: releaseSha,
    });
    manifestSha256 = release.manifestSha256;
    for (const file of release.manifest.files) {
      if (file.path === '_headers') continue;
      const response = file.path === 'index.html'
        ? root
        : await get(`${origin}/${file.path.split('/').map(encodeURIComponent).join('/')}`);
      const bytes = file.path === 'index.html'
        ? rootBytes
        : Buffer.from(await response.arrayBuffer());
      if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) {
        throw new Error(`el origin no sirve el byte exacto de ${file.path}.`);
      }
      if (file.path.startsWith('assets/')) assertHeader(response, 'cache-control', /immutable/i);
      verifiedFiles += 1;
    }
  }

  const publishableKey = process.env.AFUCOA_PROD_PUBLISHABLE_KEY;
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(publishableKey || '')) {
    throw new Error('falta la publishable key PROD para el smoke read-only.');
  }
  const authSettings = await get('https://rywdochyzhgfaymrmxek.supabase.co/auth/v1/settings', {
    headers: { apikey: publishableKey },
  });
  await authSettings.arrayBuffer();

  return {
    ok: true,
    canonical_origin: origin,
    release_sha: releaseSha || null,
    deployment_id: deploymentId || null,
    manifest_sha256: manifestSha256,
    artifact_files_verified: verifiedFiles,
    http_200: true,
    https: true,
    hsts: true,
    csp: true,
    service_worker_allowed: '/',
    noindex: false,
    dev_references: 0,
    source_maps: 0,
    privileged_material: false,
    supabase_prod_reachable: true,
    login_attempted: false,
    checked_at: new Date().toISOString(),
  };
}

try {
  const options = {
    origin: argument('origin').replace(/\/$/, ''),
    manifestPath: argument('manifest', { optional: true }),
    releaseSha: argument('release-sha', { optional: true }),
    deploymentId: argument('deployment-id', { optional: true }),
  };
  const attempts = Number(argument('attempts', { optional: true }) || 1);
  let result;
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      result = await smoke(options);
      break;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  if (!result) throw lastError;
  const output = argument('output', { optional: true });
  if (output) await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' });
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(`Smoke PROD falló: ${error?.message || 'error desconocido'}`);
  process.exit(1);
}
