import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { loadEnv } from 'vite';
import { validateProductionEnv } from './lib/production-env.mjs';

const DIST = path.resolve('dist');
const TEXT_FILE = /\.(?:css|html|js|json|svg|txt|webmanifest|xml)$/i;

function fail(message) {
  console.error(`Artefacto PROD inválido: ${message}`);
  process.exit(1);
}

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    if ((await stat(fullPath)).isDirectory()) result.push(...await filesUnder(fullPath));
    else result.push(fullPath);
  }
  return result;
}

function privilegedJwt(contents) {
  for (const token of contents.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(token[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') return true;
    } catch {
      // An unrelated malformed token is handled by the other material checks.
    }
  }
  return false;
}

let config;
try {
  const viteEnv = loadEnv('production', process.cwd(), '');
  config = validateProductionEnv(process.env, { additionalEnvs: [viteEnv] });
} catch (error) {
  fail(error?.message || 'configuración de entorno rechazada.');
}

let files;
try {
  files = await filesUnder(DIST);
} catch {
  fail('no existe el directorio dist.');
}

for (const required of ['index.html', 'manifest.webmanifest', 'push-sw.js']) {
  if (!files.includes(path.join(DIST, required))) fail(`falta ${required}.`);
}
if (files.some((file) => file.endsWith('.map'))) fail('el artefacto contiene source maps.');

const index = await readFile(path.join(DIST, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(DIST, 'manifest.webmanifest'), 'utf8'));
const worker = await readFile(path.join(DIST, 'push-sw.js'), 'utf8');
const textFiles = files.filter((file) => TEXT_FILE.test(file));
const contents = (await Promise.all(textFiles.map((file) => readFile(file, 'utf8')))).join('\n');
const jsContents = (await Promise.all(files.filter((file) => file.endsWith('.js')).map((file) => readFile(file, 'utf8')))).join('\n');

if (!index.includes(`${config.publicBase}assets/`)) fail('index.html no respeta AFUCOA_PUBLIC_BASE para assets.');
if (!index.includes(`${config.publicBase}manifest.webmanifest`)) fail('index.html no respeta AFUCOA_PUBLIC_BASE para el manifest.');
if (manifest.start_url !== './') fail('manifest.start_url debe permanecer relativo a la base.');
if (!worker.includes("addEventListener('push'") || !worker.includes("addEventListener('notificationclick'")) {
  fail('push-sw.js no contiene el worker Web Push esperado.');
}
if (!jsContents.includes('push-sw.js') || !jsContents.includes('scope:')) {
  fail('el bundle no registra el Service Worker con scope explícito.');
}
const baseQuoted = [JSON.stringify(config.publicBase), `'${config.publicBase}'`];
if (!baseQuoted.some((quoted) => jsContents.includes(quoted))) {
  fail('el registro del Service Worker no contiene la base PROD configurada.');
}

const forbiddenReferences = [
  ['imiplnspvmsrsuikulwm', 'project ref DEV'],
  ['https://jorgestraumann.github.io', 'origen GitHub Pages staging'],
  ['/app-afucoa/', 'base staging'],
  ['localhost', 'localhost'],
  ['127.0.0.1', 'loopback'],
  ['AFUCOA_ENV=dev', 'runtime DEV'],
];
for (const [needle, label] of forbiddenReferences) {
  if (contents.toLowerCase().includes(needle.toLowerCase())) fail(`el artefacto contiene ${label}.`);
}

if (/sb_secret_|sb_service_role_|\bservice_role\b|SUPABASE_(?:SERVICE_ROLE|SECRET)_KEY|VAPID_PRIVATE_KEY|RESEND_API_KEY/i.test(contents)) {
  fail('el artefacto contiene nombres o patrones privilegiados.');
}
if (/VITE_[A-Z0-9_]*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|VAPID_PRIVATE|RESEND)/i.test(contents)) {
  fail('el artefacto contiene una variable VITE_* privilegiada.');
}
if (/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|\bre_[A-Za-z0-9]{24,}/.test(contents) || privilegedJwt(contents)) {
  fail('el artefacto contiene material privado, una clave de correo o un JWT privilegiado.');
}

const supabaseOrigins = new Set(
  [...contents.matchAll(/https:\/\/[a-z0-9-]+\.supabase\.co\/?/gi)].map((match) => new URL(match[0]).origin),
);
if (supabaseOrigins.size !== 1 || !supabaseOrigins.has(config.supabaseUrl)) {
  fail('el bundle debe contener exclusivamente la URL Supabase PROD configurada.');
}

const publishableKeys = new Set(contents.match(/sb_publishable_[A-Za-z0-9_-]+/g) || []);
if (publishableKeys.size !== 1 || !publishableKeys.has(config.publishableKey)) {
  fail('el bundle no contiene exclusivamente la publishable key configurada.');
}

console.log(JSON.stringify({
  ok: true,
  mode: 'production',
  project_ref: config.projectRef,
  public_base: config.publicBase,
  files: files.length,
  supabase_urls: 1,
  dev_references: 0,
  source_maps: 0,
  privileged_key_exposed: false,
}));
