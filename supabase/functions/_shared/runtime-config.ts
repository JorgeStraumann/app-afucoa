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

function invalidConfig(reason = 'invalid') {
  return new Error(`runtime_configuration_invalid:${reason}`)
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
  const secretKeysValue = String(getEnv('SUPABASE_SECRET_KEYS') || '').trim()
  const secretKeyName = String(getEnv('AFUCOA_SECRET_KEY_NAME') || 'default').trim()
  const originsValue = String(getEnv('AFUCOA_ALLOWED_ORIGINS') || '').trim()
  if (!VALID_ENVS.has(env)) throw invalidConfig('environment')
  if (!supabaseUrlValue) throw invalidConfig('supabase_url_missing')
  if (!secretKeysValue) throw invalidConfig('secret_keys_missing')
  if (!originsValue) throw invalidConfig('origins_missing')

  let secretKey
  try {
    const secretKeys = JSON.parse(secretKeysValue)
    if (!/^[A-Za-z0-9_-]+$/.test(secretKeyName)) throw invalidConfig('secret_key_name')
    if (!Object.prototype.hasOwnProperty.call(secretKeys ?? {}, secretKeyName)) {
      throw invalidConfig('secret_key_selected_missing')
    }
    if (typeof secretKeys[secretKeyName] !== 'string') throw invalidConfig('secret_key_selected_type')
    secretKey = secretKeys[secretKeyName].trim()
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('runtime_configuration_invalid:secret_key_default_')) {
      throw error
    }
    throw invalidConfig('secret_keys_json')
  }
  if (!secretKey.startsWith('sb_secret_')) throw invalidConfig('secret_key_selected_prefix')
  if (!/^sb_secret_[A-Za-z0-9_-]+$/.test(secretKey)) throw invalidConfig('secret_key_selected_format')

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
  Object.defineProperty(config, 'secretKey', {
    value: secretKey,
    enumerable: false,
    writable: false,
  })
  return Object.freeze(config)
}

export function secretKeyClientOptions(secretKey, baseFetch = fetch) {
  const secretBearer = `Bearer ${secretKey}`
  return {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (input, init = {}) => {
        const headers = new Headers(init.headers)
        // Secret API keys are opaque API keys, not JWTs. supabase-js clients
        // may add the API key as a Bearer fallback; remove only that exact
        // fallback and retain real user JWTs used by authenticated requests.
        if (headers.get('authorization') === secretBearer) headers.delete('authorization')
        return baseFetch(input, { ...init, headers })
      },
    },
  }
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
