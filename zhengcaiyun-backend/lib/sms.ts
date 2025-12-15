export type SmsProvider = 'console' | 'webhook'

export type SendSmsResult = { ok: true } | { ok: false; error: string }

export async function sendVerificationCodeSms(opts: {
  phone: string
  code: string
  purpose: 'register'
}): Promise<SendSmsResult> {
  const provider = (process.env.SMS_PROVIDER ||
    (process.env.NODE_ENV === 'production' ? '' : 'console')) as string

  if (!provider || provider === 'disabled') {
    return { ok: false, error: 'SMS provider is not configured' }
  }

  if (provider === 'console') {
    console.log(`[SMS][${opts.purpose}] ${opts.phone} -> ${opts.code}`)
    return { ok: true }
  }

  if (provider === 'webhook') {
    const url = process.env.SMS_WEBHOOK_URL
    if (!url) return { ok: false, error: 'SMS_WEBHOOK_URL is not set' }

    const secret = process.env.SMS_WEBHOOK_SECRET

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-sms-secret': secret } : {})
      },
      body: JSON.stringify(opts)
    })

    if (!res.ok) {
      return { ok: false, error: `SMS webhook failed (${res.status})` }
    }

    return { ok: true }
  }

  return { ok: false, error: `Unsupported SMS_PROVIDER: ${provider}` }
}

