const RECOVERY_SUBJECT = 'Código para recuperar tu acceso a AFUCOA'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type RecoveryEmailProvider = 'resend' | 'brevo'

type RecoveryEmailConfig = Readonly<{
  provider: RecoveryEmailProvider
  from: string
  fromEmail: string
  senderName: string
  sandbox: boolean
  apiKey: string
}>

function parseSender(value: string) {
  const display = value.match(/^\s*[^<>]+\s*<([^<>]+)>\s*$/)
  const email = String(display?.[1] || value).trim()
  return EMAIL_PATTERN.test(email) ? email : ''
}

export function loadRecoveryEmailConfig(
  environment: string,
  getEnv = (name: string) => Deno.env.get(name),
): RecoveryEmailConfig | null {
  const provider = String(getEnv('RECOVERY_EMAIL_PROVIDER') || '').trim().toLowerCase()
  if (provider !== 'resend' && provider !== 'brevo') return null
  if (environment === 'dev' && provider !== 'resend') return null
  if (environment === 'prod' && provider !== 'brevo') return null

  const from = String(getEnv('RECOVERY_EMAIL_FROM') || '').trim()
  const fromEmail = parseSender(from)
  const senderName = String(getEnv('RECOVERY_EMAIL_SENDER_NAME') || '').trim()
  const sandboxValue = String(getEnv('RECOVERY_EMAIL_SANDBOX') || '').trim().toLowerCase()
  const keyName = provider === 'resend' ? 'RESEND_API_KEY' : 'BREVO_API_KEY'
  const apiKey = String(getEnv(keyName) || '').trim()
  if (!from || !fromEmail || !apiKey || apiKey.length < 16) return null
  if (provider === 'brevo' && (!senderName || senderName.length > 80 || /[\r\n]/.test(senderName))) return null
  if (sandboxValue && sandboxValue !== 'drop') return null

  const config = {
    provider,
    from,
    fromEmail,
    senderName: senderName || 'AFUCOA',
    sandbox: sandboxValue === 'drop',
  } as RecoveryEmailConfig
  Object.defineProperty(config, 'apiKey', {
    value: apiKey,
    enumerable: false,
    writable: false,
  })
  return Object.freeze(config)
}

function recoveryContent(code: string) {
  return {
    subject: RECOVERY_SUBJECT,
    text: `Tu código de recuperación de AFUCOA es ${code}. Vence en 10 minutos y puede usarse una sola vez. Si no solicitaste este cambio, ignorá este mensaje.`,
    html: `<p>Tu código de recuperación de AFUCOA es:</p><p style="font-size:28px;font-weight:700;letter-spacing:4px">${code}</p><p>Vence en 10 minutos y puede usarse una sola vez.</p><p>Si no solicitaste este cambio, ignorá este mensaje.</p>`,
  }
}

export async function sendRecoveryEmail(
  config: RecoveryEmailConfig,
  recipient: string,
  code: string,
  signal?: AbortSignal,
) {
  if (!EMAIL_PATTERN.test(recipient) || !/^\d{8}$/.test(code)) return false
  const content = recoveryContent(code)

  if (config.provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal,
      headers: {
        authorization: `Bearer ${config.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: config.from,
        to: [recipient],
        subject: content.subject,
        text: content.text,
        html: content.html,
      }),
    })
    return response.ok
  }

  const body: Record<string, unknown> = {
    sender: { email: config.fromEmail, name: config.senderName },
    to: [{ email: recipient }],
    subject: content.subject,
    textContent: content.text,
    htmlContent: content.html,
  }
  // Brevo sandbox requires this request-only control and drops the message.
  // It is never included in normal production delivery requests.
  if (config.sandbox) body.headers = { 'X-Sib-Sandbox': 'drop' }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    signal,
    headers: {
      accept: 'application/json',
      'api-key': config.apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return response.status === 201
}
