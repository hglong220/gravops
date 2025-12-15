import { NextRequest, NextResponse } from 'next/server'

import { enforceRateLimit, getClientIp } from '@/lib/rate-limit'
import { generateSixDigitCode, storePhoneCode } from '@/lib/phone-verification'
import { isValidChinaPhone, normalizeChinaPhone } from '@/lib/phone'
import { sendVerificationCodeSms } from '@/lib/sms'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const phoneRaw = typeof body?.phone === 'string' ? body.phone.trim() : ''
    const phone = normalizeChinaPhone(phoneRaw)

    if (!isValidChinaPhone(phone)) {
      return NextResponse.json({ error: '手机号格式不正确' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const limitMax = process.env.RATE_LIMIT_AUTH_SEND_CODE_MAX
      ? parseInt(process.env.RATE_LIMIT_AUTH_SEND_CODE_MAX, 10)
      : 5
    const limitWindowMs = process.env.RATE_LIMIT_AUTH_SEND_CODE_WINDOW_MS
      ? parseInt(process.env.RATE_LIMIT_AUTH_SEND_CODE_WINDOW_MS, 10)
      : 10 * 60 * 1000

    const rl = await enforceRateLimit(request, {
      prefix: 'auth_send_code',
      id: `${ip}:${phone}`,
      max: limitMax,
      windowMs: limitWindowMs
    })
    if (rl) return rl

    const ttlMs = process.env.AUTH_CODE_TTL_MS ? parseInt(process.env.AUTH_CODE_TTL_MS, 10) : 5 * 60 * 1000

    const code = generateSixDigitCode()
    await storePhoneCode({ phone, purpose: 'register', code, ttlMs })

    const sendResult = await sendVerificationCodeSms({ phone, code, purpose: 'register' })
    if (!sendResult.ok) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ success: true, debugCode: code, warning: sendResult.error })
      }
      return NextResponse.json({ error: '短信服务暂不可用，请联系管理员' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[AuthSendCode] error:', error)
    return NextResponse.json({ error: '发送失败' }, { status: 500 })
  }
}
