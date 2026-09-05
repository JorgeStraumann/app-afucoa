const DEV_PROJECT_REF = 'imiplnspvmsrsuikulwm';
const STAGING_BASE = '/app-afucoa/';
const PUBLISHABLE_KEY = /^sb_publishable_[A-Za-z0-9_-]{20,}$/;
const FORBIDDEN_PUBLIC_NAME = /^VITE_.*(?:SERVICE_ROLE|SECRET|PRIVATE_KEY|VAPID_PRIVATE|RESEND)/i;
const FORBIDDEN_SERVER_NAMES = new Set([
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SECRET_KEY',
  'VAPID_PRIVATE_KEY',
  'RESEND_API_KEY',
]);

export class ProductionConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProductionConfigError';
  }
}

function reject(message) {
  throw new ProductionConfigError(message);
}

function required(env, name) {
  const value = env[name];
  if (typeof value !== 'string' || !value.trim()) reject(`falta ${name}.`);
  if (value !== value.trim()) reject(`${name} contiene espacios externos.`);
  return value;
}

function validateSupabaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    reject('VITE_SUPABASE_URL no es una URL válida.');
  }

  if (url.protocol !== 'https:') reject('VITE_SUPABASE_URL debe usar HTTPS.');
  if (url.username || url.password) reject('VITE_SUPABASE_URL no admite credenciales.');
  const authority = value.match(/^https:\/\/([^/]+)/i)?.[1] || '';
  if (url.port || /:\d+$/.test(authority)) reject('VITE_SUPABASE_URL no admite puerto.');
  if (url.pathname !== '/' || url.search || url.hash) {
    reject('VITE_SUPABASE_URL debe contener solo el origin Supabase.');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname === '127.0.0.1' || hostname === '[::1]') {
    reject('VITE_SUPABASE_URL no admite localhost o loopback.');
  }
  const match = hostname.match(/^([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)\.supabase\.co$/);
  if (!match) reject('VITE_SUPABASE_URL debe usar un host válido *.supabase.co.');
  if (match[1] === DEV_PROJECT_REF) reject('VITE_SUPABASE_URL no puede apuntar al proyecto DEV.');

  return { url: url.origin, projectRef: match[1] };
}

function validatePublishableKey(value) {
  if (value.startsWith('sb_secret_') || value.startsWith('sb_service_role_')) {
    reject('VITE_SUPABASE_PUBLISHABLE_KEY recibió una clave privilegiada.');
  }
  if (value.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') reject('VITE_SUPABASE_PUBLISHABLE_KEY recibió un JWT service_role.');
    } catch (error) {
      if (error instanceof ProductionConfigError) throw error;
    }
    reject('VITE_SUPABASE_PUBLISHABLE_KEY debe usar el formato publishable actual.');
  }
  if (!PUBLISHABLE_KEY.test(value)) {
    reject('VITE_SUPABASE_PUBLISHABLE_KEY no tiene formato publishable válido.');
  }
}

function validateAliasDomain(value) {
  if (value.length > 253 || value.includes('://') || /[\/@:#?\\\s]/.test(value)) {
    reject('VITE_AUTH_ALIAS_DOMAIN no tiene sintaxis de dominio válida.');
  }
  const labels = value.split('.');
  if (labels.length < 2 || labels.some((label) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) {
    reject('VITE_AUTH_ALIAS_DOMAIN no tiene sintaxis de dominio válida.');
  }
  return value.toLowerCase();
}

function validatePublicBase(value) {
  if (value === STAGING_BASE) reject('AFUCOA_PUBLIC_BASE no puede usar la base conocida de staging.');
  if (!value.startsWith('/') || !value.endsWith('/') || value.includes('://')) {
    reject('AFUCOA_PUBLIC_BASE debe comenzar y terminar con / y no ser una URL.');
  }
  if (/[?#\\%]/.test(value)) reject('AFUCOA_PUBLIC_BASE contiene caracteres no permitidos.');
  const segments = value.split('/').slice(1, -1);
  if (segments.some((segment) => !segment || segment === '.' || segment === '..' || !/^[A-Za-z0-9._~-]+$/.test(segment))) {
    reject('AFUCOA_PUBLIC_BASE está mal formada.');
  }
  return value;
}

export function validateProductionEnv(env, { additionalEnvs = [] } = {}) {
  for (const source of [env, ...additionalEnvs]) {
    for (const name of Object.keys(source)) {
      if (FORBIDDEN_PUBLIC_NAME.test(name)) reject('se detectó un nombre VITE_* reservado para material privilegiado.');
      if (FORBIDDEN_SERVER_NAMES.has(name.toUpperCase()) && String(source[name] ?? '').trim()) {
        reject('el proceso de build no debe recibir secretos server-side.');
      }
    }
  }

  if (required(env, 'VITE_AFUCOA_MODE') !== 'supabase') {
    reject('VITE_AFUCOA_MODE debe ser exactamente supabase.');
  }
  const supabase = validateSupabaseUrl(required(env, 'VITE_SUPABASE_URL'));
  const publishableKey = required(env, 'VITE_SUPABASE_PUBLISHABLE_KEY');
  validatePublishableKey(publishableKey);
  const aliasDomain = validateAliasDomain(required(env, 'VITE_AUTH_ALIAS_DOMAIN'));
  const publicBase = validatePublicBase(required(env, 'AFUCOA_PUBLIC_BASE'));

  const config = {
    mode: 'supabase',
    supabaseUrl: supabase.url,
    projectRef: supabase.projectRef,
    aliasDomain,
    publicBase,
  };
  Object.defineProperty(config, 'publishableKey', { value: publishableKey, enumerable: false });
  return Object.freeze(config);
}

export const productionPolicy = Object.freeze({ DEV_PROJECT_REF, STAGING_BASE });
