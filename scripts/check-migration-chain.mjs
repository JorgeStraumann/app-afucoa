import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(root, 'supabase', 'migrations');
const manifestPath = path.join(migrationsDir, 'MANIFEST.json');
const obsoleteFiles = new Set([
  '202608310001_list_visible_proposals.sql',
  '202608310002_fix_membership_token_ambiguity.sql',
]);
const expectedChain = [
  ['20260901012911', 'afucoa_v2_schema'],
  ['20260901013024', 'afucoa_v2_security_core_fixed'],
  ['20260901013043', 'afucoa_v2_security_rls_part1'],
  ['20260901013059', 'afucoa_v2_security_rls_part2'],
  ['20260901013115', 'afucoa_v2_storage'],
  ['20260901013137', 'afucoa_v2_admin_backend'],
  ['20260901013205', 'afucoa_v2_security_hardening_01'],
  ['20260901013226', 'afucoa_v2_performance_hardening_01'],
  ['20260901020856', 'list_visible_proposals'],
  ['20260901021400', 'fix_membership_token_ambiguity'],
  ['20260902013551', 'profiles_id_default_uuid'],
  ['20260903200438', 'secure_password_recovery'],
  ['20260904001121', 'recovery_concurrency_hardening'],
  ['20260904002017', 'recovery_lock_clock'],
  ['20260904023548', 'web_push_dev'],
  ['20260904024725', 'web_push_active_device_limit'],
  ['20260905002735', 'reconcile_existing_push_subscription'],
];

function fail(message) {
  throw new Error(`Cadena de migraciones inválida: ${message}`);
}

function normalizeSql(value) {
  return value.replace(/\r\n?/g, '\n').replace(/\n*$/, '') + '\n';
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1) fail('schemaVersion de manifiesto no soportada.');
if (manifest.source?.projectRef !== 'imiplnspvmsrsuikulwm'
  || manifest.source?.table !== 'supabase_migrations.schema_migrations'
  || manifest.source?.mode !== 'read-only') {
  fail('la fuente histórica del manifiesto no coincide con DEV read-only.');
}
if (manifest.migrations?.length !== expectedChain.length) {
  fail(`se esperaban exactamente ${expectedChain.length} entradas canónicas.`);
}
const manifestedChain = manifest.migrations.map(({ version, name }) => [version, name]);
if (JSON.stringify(manifestedChain) !== JSON.stringify(expectedChain)) {
  fail('las versiones/nombres no coinciden con la cadena canónica esperada.');
}

const diskFiles = (await readdir(migrationsDir))
  .filter((file) => file.endsWith('.sql'))
  .sort();
const expectedFiles = manifest.migrations.map((migration) => migration.file);

if (diskFiles.some((file) => obsoleteFiles.has(file))) {
  fail('persisten versiones 20260831 obsoletas.');
}
if (diskFiles.length !== 17) fail(`se encontraron ${diskFiles.length} archivos SQL; se esperaban 17.`);
if (JSON.stringify(diskFiles) !== JSON.stringify([...expectedFiles].sort())) {
  fail('los archivos SQL no coinciden exactamente con el manifiesto.');
}

const versions = new Set();
const names = new Set();
let previousVersion = null;

for (const migration of manifest.migrations) {
  const { version, name, file, sha256: expectedHash } = migration;
  if (!/^\d{14}$/.test(version)) fail(`versión inválida: ${version}.`);
  if (!/^[a-z0-9_]+$/.test(name)) fail(`nombre inválido: ${name}.`);
  if (file !== `${version}_${name}.sql`) fail(`archivo inesperado para ${version}: ${file}.`);
  if (versions.has(version)) fail(`versión duplicada: ${version}.`);
  if (names.has(file)) fail(`archivo duplicado: ${file}.`);
  if (previousVersion !== null && BigInt(version) <= BigInt(previousVersion)) {
    fail(`orden no ascendente entre ${previousVersion} y ${version}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) fail(`checksum inválido en manifiesto: ${file}.`);

  const sql = await readFile(path.join(migrationsDir, file), 'utf8');
  const actualHash = sha256(normalizeSql(sql));
  if (actualHash !== expectedHash) {
    fail(`checksum no coincide para ${file}; esperado ${expectedHash}, actual ${actualHash}.`);
  }

  versions.add(version);
  names.add(file);
  previousVersion = version;
}

const storageSql = normalizeSql(await readFile(
  path.join(migrationsDir, '20260901013115_afucoa_v2_storage.sql'),
  'utf8',
));
for (const bucket of ['request-files', 'documents-private', 'public-media']) {
  if (!storageSql.includes(`'${bucket}'`)) fail(`falta el bucket ${bucket} en la migración Storage.`);
}
if (/\binsert\s+into\s+storage\.objects\b/i.test(storageSql) || /\bcopy\s+storage\.objects\b/i.test(storageSql)) {
  fail('la migración Storage intenta copiar objetos; solo debe crear buckets y políticas.');
}

console.log(JSON.stringify({
  ok: true,
  migrations: manifest.migrations.length,
  firstVersion: manifest.migrations[0].version,
  lastVersion: manifest.migrations.at(-1).version,
  checksums: '17/17',
  obsoleteVersions: 0,
  storageBuckets: 3,
  storageObjectsCopied: false,
}));
