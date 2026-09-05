const VALID_ENVS = new Set(['dev', 'prod'])
const DEV_PROJECT_REF = 'imiplnspvmsrsuikulwm'
const DEV_STAGING_ORIGIN = 'https://jorgestraumann.github.io'

const CORS_BASE_HEADERS = {
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-max-age': '86400',
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'vary': 'Origin',
}

function invalidConfig() {
  return new Error('runtime_configuration_invalid')
}

function validSupabaseUrl(value) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.port || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash
      || !/^[a-z0-9][a-z0-9-]*\.supabase\.co$/.test(url.hostname)) throw invalidConfig()
    return url
  } catch {
    throw invalidConfig()
  }
}

function validOrigin(value) {
  if (!value || value.includes('*')) throw invalidConfig()
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.port && !/^\d+$/.test(url.port)
      || url.username || url.password || url.pathname !== '/' || url.search || url.hash
      || url.origin === 'null') throw invalidConfig()
    return url
  } catch {
    throw invalidConfig()
  }
}

function isLoopback(hostname) {
  return hostname === 'localhost' || hostname.endsWith('.localhost')
    || /^127(?:\.\d{1,3}){3}$/.test(hostname) || hostname === '[::1]'
}

export function loadRuntimeConfig(getEnv = (name) => Deno.env.get(name)) {
  const env = String(getEnv('AFUCOA_ENV') || '').trim().toLowerCase()
  const supabaseUrlValue = String(getEnv('SUPABASE_URL') || '').trim()
  const serviceRoleKey = String(getEnv('SUPABASE_SERVICE_ROLE_KEY') || '').trim()
  const originsValue = String(getEnv('AFUCOA_ALLOWED_ORIGINS') || '').trim()
  if (!VALID_ENVS.has(env) || !supabaseUrlValue || !serviceRoleKey || !originsValue) throw invalidConfig()

  const supabaseUrl = validSupabaseUrl(supabaseUrlValue)
  const rawOrigins = originsValue.split(',').map((value) => value.trim())
  if (!rawOrigins.length || rawOrigins.some((value) => !value)) throw invalidConfig()

  const origins = rawOrigins.map(validOrigin)
  if (env === 'prod') {
    if (supabaseUrl.hostname === `${DEV_PROJECT_REF}.supabase.co`) throw invalidConfig()
    for (const origin of origins) {
      if (origin.protocol !== 'https:' || isLoopback(origin.hostname)
        || origin.origin === DEV_STAGING_ORIGIN) throw invalidConfig()
    }
  }

  const allowedOrigins = new Set(origins.map((origin) => origin.origin))
  if (allowedOrigins.size !== origins.length) throw invalidConfig()

  const config = { env, supabaseUrl: supabaseUrl.origin, allowedOrigins }
  Object.defineProperty(config, 'serviceRoleKey', {
    value: serviceRoleKey,
    enumerable: false,
    writable: false,
  })
  return Object.freeze(config)
}

export function requestOriginAllowed(request, config) {
  const origin = request.headers.get('origin')
  if (!origin) return request.method !== 'OPTIONS'
  return config.allowedOrigins.has(origin)
}

export function corsHeaders(request, config = null) {
  const headers = { ...CORS_BASE_HEADERS }
  const origin = request.headers.get('origin')
  if (config && origin && config.allowedOrigins.has(origin)) {
    headers['access-control-allow-origin'] = origin
  }
  return headers
}
