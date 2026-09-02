import { loadEnv } from 'vite';

const EXPECTED_PROJECT_REF = 'imiplnspvmsrsuikulwm';
const EXPECTED_URL = `https://${EXPECTED_PROJECT_REF}.supabase.co`;
const env = { ...loadEnv('staging', process.cwd(), ''), ...process.env };

function fail(message) {
  console.error(`Staging inválido: ${message}`);
  process.exit(1);
}

function jwtRole(value) {
  if (!value.startsWith('eyJ')) return null;
  try {
    const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
    return payload.role || null;
  } catch {
    return 'invalid';
  }
}

if (env.VITE_AFUCOA_MODE !== 'supabase') fail('VITE_AFUCOA_MODE debe ser supabase.');
if (env.VITE_SUPABASE_URL?.replace(/\/$/, '') !== EXPECTED_URL) {
  fail(`VITE_SUPABASE_URL debe apuntar exclusivamente a ${EXPECTED_PROJECT_REF}.`);
}

const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
if (!publishableKey) fail('falta VITE_SUPABASE_PUBLISHABLE_KEY.');
if (publishableKey.startsWith('sb_secret_') || publishableKey.startsWith('sb_service_role_')) {
  fail('se recibió una clave secreta o service_role en una variable pública.');
}

const legacyRole = jwtRole(publishableKey);
if (!publishableKey.startsWith('sb_publishable_') && legacyRole !== 'anon') {
  fail('la clave configurada no es publishable ni una anon legacy válida.');
}

const forbiddenPublicNames = Object.keys(env).filter((name) => /^VITE_.*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY)/i.test(name));
if (forbiddenPublicNames.length) fail('hay nombres de variables VITE_* reservados para secretos.');
if (env.SUPABASE_SERVICE_ROLE_KEY || env.AFUCOA_SUPABASE_SERVICE_ROLE_KEY) {
  fail('el build de staging no debe recibir claves server-side.');
}

const base = env.AFUCOA_PUBLIC_BASE || '/app-afucoa/';
if (!base.startsWith('/') || !base.endsWith('/')) fail('AFUCOA_PUBLIC_BASE debe comenzar y terminar con /.');

console.log(JSON.stringify({
  ok: true,
  mode: 'supabase',
  project_ref: EXPECTED_PROJECT_REF,
  publishable_key: 'configured',
  public_base: base,
  privileged_key_exposed: false,
}));
