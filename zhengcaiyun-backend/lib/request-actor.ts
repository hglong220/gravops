import { NextRequest } from 'next/server'

import { getAuthUser, type AuthUser } from '@/lib/auth'
import { getPluginLicenseFromRequest } from '@/lib/plugin-auth'

export type RequestActor =
  | { kind: 'user'; userId: string; email: string }
  | { kind: 'plugin'; userId: string | null; licenseId: string; licenseKey: string }

export async function getActorFromRequest(
  request: NextRequest
): Promise<RequestActor | null> {
  const user: AuthUser | null = getAuthUser(request)
  if (user) return { kind: 'user', userId: user.userId, email: user.email }

  const plugin = await getPluginLicenseFromRequest(request)
  if (!plugin) return null

  return {
    kind: 'plugin',
    userId: plugin.license.userId ?? null,
    licenseId: plugin.license.id,
    licenseKey: plugin.license.key
  }
}

