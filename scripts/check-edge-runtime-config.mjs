import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const functionsDir = path.join(root, 'supabase', 'functions');
const runtimeConfigPath = path.join(functionsDir, '_shared', 'runtime-config.ts');
const expectedFunctions = [
  'request-password-recovery',
  'confirm-password-recovery',
  'push-config',
  'send-notification-push',
];

function fail(message) {
  throw new Error(`Configuración Edge inválida: ${message}`);
}

async function typescriptFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await typescriptFiles(fullPath));
    else if (entry.isFile() && entry.name.endsWith('.ts')) output.push(fullPath);
  }
  return output;
}

const manifest = JSON.parse(await readFile(path.join(functionsDir, 'PRODUCTION_FUNCTIONS.json'), 'utf8'));
if (manifest.schemaVersion !== 1) fail('schemaVersion de inventario no soportada.');
if (JSON.stringify(manifest.functions) !== JSON.stringify(expectedFunctions)) {
  fail('el inventario PROD no contiene exactamente las cuatro funciones permitidas.');
}
if (manifest.functions.some((name) => /(?:dev|seed|test)/i.test(name))) {
  fail('el inventario PROD contiene una función auxiliar DEV/test.');
}
for (const name of expectedFunctions) {
  const entrypoint = path.join(functionsDir, name, 'index.ts');
  await readFile(entrypoint, 'utf8').catch(() => fail(`falta entrypoint para ${name}.`));
}

const forbiddenRuntimeValues = [
  'imiplnspvmsrsuikulwm',
  'https://jorgestraumann.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
];
const files = await typescriptFiles(functionsDir);
for (const file of files) {
  const source = await readFile(file, 'utf8');
  const relative = path.relative(functionsDir, file).replaceAll('\\', '/');
  if (file !== runtimeConfigPath) {
    for (const value of forbiddenRuntimeValues) {
      if (source.includes(value)) fail(`${relative} contiene un hardcode DEV: ${value}.`);
    }
  }
  if (/(?:\|\||\?\?)\s*['"]https?:\/\//.test(source)) {
    fail(`${relative} contiene un fallback URL silencioso.`);
  }
  if (/DEFAULT_ORIGINS|RECOVERY_ALLOWED_ORIGINS/.test(source)) {
    fail(`${relative} conserva configuración CORS heredada.`);
  }
}

const runtimeSource = await readFile(runtimeConfigPath, 'utf8');
for (const token of ['AFUCOA_ENV', 'AFUCOA_ALLOWED_ORIGINS', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
  if (!runtimeSource.includes(token)) fail(`runtime-config no valida ${token}.`);
}
if (!runtimeSource.includes("env === 'prod'")
  || !runtimeSource.includes('DEV_PROJECT_REF')
  || !runtimeSource.includes('DEV_STAGING_ORIGIN')) {
  fail('runtime-config no contiene rechazos explícitos de configuración DEV en PROD.');
}

const recoverySources = await Promise.all([
  'request-password-recovery', 'confirm-password-recovery',
].map((name) => readFile(path.join(functionsDir, name, 'index.ts'), 'utf8')));
if (recoverySources.some((source) => !source.includes("../_shared/runtime-config.ts"))) {
  fail('alguna función de recuperación no consume runtime-config compartida.');
}
const pushHttp = await readFile(path.join(functionsDir, '_shared', 'push-http.ts'), 'utf8');
if (!pushHttp.includes("./runtime-config.ts")) fail('Web Push no consume runtime-config compartida.');

console.log(JSON.stringify({
  ok: true,
  productionFunctions: manifest.functions.length,
  devFunctionsAllowed: 0,
  executableEdgeFiles: files.length,
  hardcodedDevDefaults: 0,
  sharedRuntimeConfig: true,
}));
