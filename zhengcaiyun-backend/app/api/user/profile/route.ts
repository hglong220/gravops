import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

type ProfileResponse = {
  id: string
  username: string
  phone: string | null
  companyName: string | null
  creditCode: string | null
  legalName: string | null
}

function toProfileResponse(user: {
  id: string
  email: string
  phone: string | null
  companyName: string | null
  creditCode: string | null
  name: string | null
}): ProfileResponse {
  return {
    id: user.id,
    username: user.email,
    phone: user.phone,
    companyName: user.companyName,
    creditCode: user.creditCode,
    legalName: user.name
  }
}

export async function GET(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      companyName: true,
      creditCode: true,
      name: true
    }
  })

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })
  return NextResponse.json(toProfileResponse(user))
}

export async function PATCH(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const companyName = typeof body?.companyName === 'string' ? body.companyName.trim() : undefined
  const creditCode = typeof body?.creditCode === 'string' ? body.creditCode.trim() : undefined
  const legalName = typeof body?.legalName === 'string' ? body.legalName.trim() : undefined

  const data: { companyName?: string | null; creditCode?: string | null; name?: string | null } = {}

  if (companyName !== undefined) {
    if (companyName && companyName.length > 80) {
      return NextResponse.json({ error: '公司名称过长' }, { status: 400 })
    }
    data.companyName = companyName || null
  }

  if (creditCode !== undefined) {
    if (creditCode && creditCode.length > 40) {
      return NextResponse.json({ error: '统一社会信用代码过长' }, { status: 400 })
    }
    data.creditCode = creditCode || null
  }

  if (legalName !== undefined) {
    if (legalName && legalName.length > 40) {
      return NextResponse.json({ error: '法人姓名过长' }, { status: 400 })
    }
    data.name = legalName || null
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data,
    select: {
      id: true,
      email: true,
      phone: true,
      companyName: true,
      creditCode: true,
      name: true
    }
  })

  return NextResponse.json(toProfileResponse(user))
}

