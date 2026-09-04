import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4'

const PUBLIC_RESPONSE = {
  ok: true,
  message: 'Si la cuenta está habilitada, recibirás un código en breve.',
}
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
      if (size > 4096) { await reader.cancel(); return {} }
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

function secureCode() {
  const range = 100_000_000
  const ceiling = 0x1_0000_0000 - (0x1_0000_0000 % range)
  const values = new Uint32Array(1)
  do crypto.getRandomValues(values); while (values[0] >= ceiling)
  return String(values[0] % range).padStart(8, '0')
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
  const wait = 350 + jitter - (Date.now() - startedAt)
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
}

async function deliverCode(
  client: AdminClient,
  recoveryId: string,
  email: string,
  code: string,
) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RECOVERY_EMAIL_FROM')
  if (!apiKey || !from) return

  let sent = false
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'authorization': `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject: 'Código para recuperar tu acceso a AFUCOA',
        text: `Tu código de recuperación de AFUCOA es ${code}. Vence en 10 minutos y puede usarse una sola vez. Si no solicitaste este cambio, ignorá este mensaje.`,
        html: `<p>Tu código de recuperación de AFUCOA es:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Vence en 10 minutos y puede usarse una sola vez.</p><p>Si no solicitaste este cambio, ignorá este mensaje.</p>`,
      }),
    })
    clearTimeout(timer)
    sent = response.ok
  } catch {
    sent = false
  }

  await client.from('password_recovery_codes').update(sent
    ? { delivery_status: 'sent' }
    : { delivery_status: 'failed', invalidated_at: new Date().toISOString() }
  ).eq('id', recoveryId)
}

Deno.serve(async (request) => {
  const startedAt = Date.now()
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) })
  if (request.method !== 'POST') return json(request, { error: 'method_not_allowed' }, 405)
  const origin = request.headers.get('origin')
  if (origin && !allowedOrigins().has(origin)) return json(request, { error: 'origin_not_allowed' }, 403)

  try {
    if (Number(request.headers.get('content-length') || 0) > 4096) {
      await finishAtNeutralTime(startedAt)
      return json(request, PUBLIC_RESPONSE)
    }

    const body = await readJson(request)
    const document = normalizeDocument(body?.document_number)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serverKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (supabaseUrl !== 'https://imiplnspvmsrsuikulwm.supabase.co' || !serverKey) throw new Error('server_configuration_missing')

    const client = createClient(supabaseUrl, serverKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const ipHash = await hmac(`request-ip:${clientAddress(request)}`, serverKey)
    const globalHash = await hmac('request-global', serverKey)
    const identityHash = await hmac(`request-identity:${document || 'invalid'}`, serverKey)
    const globalAllowed = await takeLimit(client, 'request_global', globalHash, 100, 60 * 60, 60 * 60)
    const [ipAllowed, identityAllowed] = globalAllowed ? await Promise.all([
      takeLimit(client, 'request_ip', ipHash, 10, 15 * 60, 30 * 60),
      takeLimit(client, 'request_identity', identityHash, 3, 60 * 60, 60 * 60),
    ]) : [false, false]

    if (globalAllowed && ipAllowed && identityAllowed && document.length >= 6) {
      const { data: profile } = await client.from('profiles')
        .select('id,email,auth_user_id,status')
        .eq('document_number', document)
        .eq('status', 'activo')
        .maybeSingle()

      const email = String(profile?.email || '').trim()
      const mailConfigured = Boolean(Deno.env.get('RESEND_API_KEY') && Deno.env.get('RECOVERY_EMAIL_FROM'))
      if (profile?.auth_user_id && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && mailConfigured) {
        const recoveryId = crypto.randomUUID()
        const code = secureCode()
        const codeHash = await hmac(`${recoveryId}:${code}`, serverKey)
        const { data: registered, error } = await client.rpc('register_password_recovery_code', {
          p_recovery_id: recoveryId,
          p_profile_id: profile.id,
          p_code_hash: codeHash,
          p_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          p_request_ip_hash: ipHash,
        })
        if (error) throw new Error('recovery_registration_failed')
        if (registered === true) {
          const delivery = deliverCode(client, recoveryId, email, code)
          const runtime = (globalThis as typeof globalThis & {
            EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void }
          }).EdgeRuntime
          if (runtime?.waitUntil) runtime.waitUntil(delivery)
          else await delivery
        }
      }
    }
  } catch {
    // No se registran cédula, correo, IP, código ni secretos.
    console.error('password_recovery_request_failed')
  }

  await finishAtNeutralTime(startedAt)
  return json(request, PUBLIC_RESPONSE)
})
