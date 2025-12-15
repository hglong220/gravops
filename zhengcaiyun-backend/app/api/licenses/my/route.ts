import { NextRequest, NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { getAuthUser } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const licenses = await prisma.license.findMany({
    where: { userId: auth.userId },
    orderBy: { expiresAt: 'desc' },
    include: { devices: true }
  })

  return NextResponse.json({
    licenses: licenses.map((l) => ({
      id: l.id,
      key: l.key,
      companyName: l.companyName,
      plan: l.plan,
      status: l.status,
      expiresAt: l.expiresAt.getTime(),
      maxDevices: l.maxDevices,
      currentDevices: l.devices.length
    }))
  })
}

