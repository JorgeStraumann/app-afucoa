import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const DIST = path.resolve('dist');
const EXPECTED_PROJECT_REF = 'imiplnspvmsrsuikulwm';
const EXPECTED_BASE = process.env.AFUCOA_PUBLIC_BASE || '/app-afucoa/';

async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory)) {
    const fullPath = path.join(directory, entry);
    if ((await stat(fullPath)).isDirectory()) result.push(...await filesUnder(fullPath));
    else result.push(fullPath);
  }
  return result;
}

function fail(message) {
  console.error(`Artefacto staging inválido: ${message}`);
  process.exit(1);
}

const files = await filesUnder(DIST);
const index = await readFile(path.join(DIST, 'index.html'), 'utf8');
const manifest = JSON.parse(await readFile(path.join(DIST, 'manifest.webmanifest'), 'utf8'));
const textFiles = files.filter((file) => /\.(?:html|js|css|json|webmanifest|map)$/i.test(file));
const contents = (await Promise.all(textFiles.map((file) => readFile(file, 'utf8')))).join('\n');

if (!index.includes(`${EXPECTED_BASE}assets/`)) fail(`index.html no usa la base ${EXPECTED_BASE}.`);
if (!index.includes(`${EXPECTED_BASE}manifest.webmanifest`)) fail('el manifest no respeta la base pública.');
if (manifest.start_url !== './') fail('manifest.start_url debe ser relativo.');
if (!contents.includes(`${EXPECTED_PROJECT_REF}.supabase.co`)) fail('el bundle no apunta al proyecto DEV permitido.');
if (/sb_secret|service_role|VAPID_PRIVATE_KEY|RESEND_API_KEY/i.test(contents)) {
  fail('el artefacto contiene una clave privilegiada o un rol privilegiado.');
}
if (/-----BEGIN (?:[A-Z]+ )*PRIVATE KEY-----|\bre_[A-Za-z0-9]{24,}/.test(contents)) {
  fail('el artefacto contiene material privado o una clave de correo.');
}
for (const token of contents.matchAll(/eyJ[A-Za-z0-9_-]+\.([A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
  let payload;
  try { payload = JSON.parse(Buffer.from(token[1], 'base64url').toString('utf8')); } catch { continue; }
  if (payload.role === 'service_role') fail('el artefacto contiene un JWT privilegiado.');
}
if (files.some((file) => file.endsWith('.map'))) fail('el artefacto contiene source maps.');
const worker = await readFile(path.join(DIST, 'push-sw.js'), 'utf8');
if (!worker.includes("addEventListener('push'") || !worker.includes("addEventListener('notificationclick'")) fail('falta el Service Worker push.');
if (!contents.includes(`${EXPECTED_BASE}`) || !contents.includes('push-sw.js')) fail('falta registro del Service Worker con base pública.');

console.log(JSON.stringify({
  ok: true,
  project_ref: EXPECTED_PROJECT_REF,
  public_base: EXPECTED_BASE,
  files: files.length,
  source_maps: 0,
  privileged_key_exposed: false,
}));
