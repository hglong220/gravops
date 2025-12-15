import { NextRequest, NextResponse } from 'next/server'

import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/licenses/reset-devices
 * Reset (unbind) all activated devices for a license owned by current user.
 */
export async function POST(request: NextRequest) {
  const auth = getAuthUser(request)
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const licenseId = typeof body?.licenseId === 'string' ? body.licenseId.trim() : ''
  const licenseKey = typeof body?.licenseKey === 'string' ? body.licenseKey.trim() : ''

  if (!licenseId && !licenseKey) {
    return NextResponse.json({ error: 'Missing licenseId or licenseKey' }, { status: 400 })
  }

  const license = await prisma.license.findFirst({
    where: {
      userId: auth.userId,
      ...(licenseId ? { id: licenseId } : { key: licenseKey })
    },
    include: { devices: true }
  })

  if (!license) {
    return NextResponse.json({ error: 'License not found' }, { status: 404 })
  }

  await prisma.device.deleteMany({ where: { licenseId: license.id } })

  return NextResponse.json({
    success: true,
    license: {
      id: license.id,
      key: license.key,
      maxDevices: license.maxDevices,
      currentDevices: 0
    }
  })
}

