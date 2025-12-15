import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const licenseKey = typeof body?.licenseKey === 'string' ? body.licenseKey.trim() : ''
  if (!licenseKey) return NextResponse.json({ error: '缺少授权码' }, { status: 400 })

  const license = await prisma.license.findUnique({
    where: { key: licenseKey }
  })

  if (!license) return NextResponse.json({ error: '授权码不存在' }, { status: 404 })

  if (new Date() > license.expiresAt) {
    return NextResponse.json({ error: '授权已过期' }, { status: 400 })
  }

  if (license.status !== 'active') {
    return NextResponse.json({ error: `授权状态异常：${license.status}` }, { status: 400 })
  }

  if (license.userId && license.userId !== auth.userId) {
    return NextResponse.json({ error: '该授权码已绑定到其他账号' }, { status: 403 })
  }

  const updated = license.userId
    ? license
    : await prisma.license.update({
        where: { id: license.id },
        data: { userId: auth.userId }
      })

  return NextResponse.json({
    success: true,
    license: {
      id: updated.id,
      key: updated.key,
      companyName: updated.companyName,
      plan: updated.plan,
      status: updated.status,
      expiresAt: updated.expiresAt.getTime()
    }
  })
}

