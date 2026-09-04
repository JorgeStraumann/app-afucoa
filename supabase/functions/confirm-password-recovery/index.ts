import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const DEFAULT_ORIGINS = [
  'https://jorgestraumann.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

type AdminClient = ReturnType<typeof createClient>

function allowedOrigins() {
  return new Set([
    ...DEFAULT_ORIGINS,
    ...(Deno.env.get('RECOVERY_ALLOWED_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean),
  ])
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin')
  const allowed = !origin || allowedOrigins().has(origin)
  return {
    'access-control-allow-origin': allowed && origin ? origin : DEFAULT_ORIGINS[0],
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
  }
}

function json(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) })
}

async function readJson(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) return {}
  const decoder = new TextDecoder()
  let size = 0
  let text = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 8192) { await reader.cancel(); return {} }
      text += decoder.decode(value, { stream: true })
    }
    return JSON.parse(text + decoder.decode())
  } catch { return {} }
  finally { reader.releaseLock() }
}

function normalizeDocument(value: unknown) {
  return String(value || '').replace(/\D/g, '').slice(0, 12)
}

function clientAddress(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown'
}

function validPassword(password: string) {
  return password.length >= 12
    && password.length <= 72
    && /[a-záéíóúüñ]/.test(password)
    && /[A-ZÁÉÍÓÚÜÑ]/.test(password)
    && /\d/.test(password)
    && /[^\p{L}\p{N}\s]/u.test(password)
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hmac(value: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  return hex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)))
}

async function takeLimit(
  client: AdminClient,
  scope: string,
  subjectHash: string,
  limit: number,
  windowSeconds: number,
  blockSeconds: number,
) {
  const { data, error } = await client.rpc('take_password_recovery_rate_limit', {
    p_scope: scope,
    p_subject_hash: subjectHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
    p_block_seconds: blockSeconds,
  })
  if (error) throw new Error('rate_limit_unavailable')
  return data === true
}

async function finishAtNeutralTime(startedAt: number) {
  const jitter = crypto.getRandomValues(new Uint16Array(1))[0] % 101
  const wait = 250 + jitter - (Date.now() - startedAt)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

Deno.serve(async (request) => {
  const startedAt = Date.now()
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  const origin = request.headers.get('origin')
  if (origin && !allowedOrigins().has(origin)) return json(request, { error: 'origin_not_allowed' }, 403)

  try {
    if (Number(request.headers.get('content-length') || 0) > 8192) {
      await finishAtNeutralTime(startedAt)
      return json(request, { error: 'invalid_code' }, 400)
    }

    const body = await readJson(request)
    const document = normalizeDocument(body?.document_number)
    const code = String(body?.code || '').replace(/\s/g, '')
    const newPassword = String(body?.new_password || '')
    if (!validPassword(newPassword)) {
      await finishAtNeutralTime(startedAt)
      return json(request, { error: 'invalid_password' }, 400)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl !== 'https://imiplnspvmsrsuikulwm.supabase.co' || !serverKey) throw new Error('server_configuration_missing')
    const client = createClient(supabaseUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const ipHash = await hmac(`confirm-ip:${clientAddress(request)}`, serverKey)
    const globalHash = await hmac('confirm-global', serverKey)
    const identityHash = await hmac(`confirm-identity:${document || 'invalid'}`, serverKey)
    const globalAllowed = await takeLimit(client, 'confirm_global', globalHash, 100, 60 * 60, 60 * 60)
    const [ipAllowed, identityAllowed] = globalAllowed ? await Promise.all([
      takeLimit(client, 'confirm_ip', ipHash, 20, 15 * 60, 30 * 60),
      takeLimit(client, 'confirm_identity', identityHash, 10, 15 * 60, 30 * 60),
    ]) : [false, false]
    if (!globalAllowed || !ipAllowed || !identityAllowed || document.length < 6 || !/^\d{8}$/.test(code)) {
      await finishAtNeutralTime(startedAt)
      return json(request, { error: 'invalid_code' }, 400)
    }

    const { data: profile } = await client.from('profiles')
      .select('id,auth_user_id')
      .eq('document_number', document)
      .eq('status', 'activo')
      .maybeSingle()
    if (!profile?.auth_user_id) {
      await finishAtNeutralTime(startedAt)
      return json(request, { error: 'invalid_code' }, 400)
    }

    const { data: recovery } = await client.from('password_recovery_codes')
      .select('id')
      .eq('profile_id', profile.id)
      .is('consumed_at', null)
      .is('invalidated_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!recovery?.id) {
      await finishAtNeutralTime(startedAt)
      return json(request, { error: 'invalid_code' }, 400)
    }

    const candidateHash = await hmac(`${recovery.id}:${code}`, serverKey)
    const { data: result, error: consumeError } = await client.rpc('consume_password_recovery_code', {
      p_profile_id: profile.id,
      p_recovery_id: recovery.id,
      p_candidate_hash: candidateHash,
    })
    if (consumeError) throw new Error('recovery_consume_failed')
    if (result !== 'ok') {
      await finishAtNeutralTime(startedAt)
      return json(request, { error: 'invalid_code' }, 400)
    }

    const { error: updateError } = await client.auth.admin.updateUserById(profile.auth_user_id, {
      password: newPassword,
    })
    if (updateError) throw new Error('password_update_failed')

    await finishAtNeutralTime(startedAt)
    return json(request, { ok: true })
  } catch {
    // No se registran cédula, código, contraseña, IP ni secretos.
    console.error('password_recovery_confirm_failed')
    await finishAtNeutralTime(startedAt)
    return json(request, { error: 'temporarily_unavailable' }, 503)
  }
})
