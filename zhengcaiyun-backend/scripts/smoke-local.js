const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000'
const USERNAME = process.env.SMOKE_USERNAME || 'smoke_user'
const PASSWORD = process.env.SMOKE_PASSWORD || 'SmokeTest123'
const PHONE = process.env.SMOKE_PHONE || '13900000000'
const COMPANY = process.env.SMOKE_COMPANY || 'Smoke Test Company'
const LICENSE_KEY = process.env.SMOKE_LICENSE_KEY || 'ZCAI-SMOKE-TEST-0001'
const PRODUCT_URL = process.env.SMOKE_PRODUCT_URL || 'https://item.jd.com/100012043978.html'

const prisma = new PrismaClient()

async function requestJson(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${text}`)
  }
  return data
}

async function ensureSmokeData() {
  const password = await bcrypt.hash(PASSWORD, 10)
  const user = await prisma.user.upsert({
    where: { email: USERNAME },
    update: {
      phone: PHONE,
      password,
      name: 'Smoke Test',
      companyName: COMPANY
    },
    create: {
      email: USERNAME,
      phone: PHONE,
      password,
      name: 'Smoke Test',
      companyName: COMPANY
    }
  })

  const license = await prisma.license.upsert({
    where: { key: LICENSE_KEY },
    update: {
      userId: user.id,
      companyName: COMPANY,
      plan: 'enterprise',
      status: 'active',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxDevices: 10,
      monthlyQuota: 999999
    },
    create: {
      key: LICENSE_KEY,
      userId: user.id,
      companyName: COMPANY,
      plan: 'enterprise',
      status: 'active',
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      maxDevices: 10,
      monthlyQuota: 999999
    }
  })

  return { user, license }
}

async function main() {
  const { user, license } = await ensureSmokeData()

  const health = await requestJson('/api/health')
  if (!health.ok) throw new Error(`health check failed: ${JSON.stringify(health)}`)

  const pluginSession = await requestJson('/api/plugin/session', {
    method: 'POST',
    body: JSON.stringify({
      licenseKey: license.key,
      companyName: license.companyName,
      deviceId: `smoke-${Date.now()}`
    })
  })
  if (!pluginSession.valid || !pluginSession.token) {
    throw new Error(`plugin session failed: ${JSON.stringify(pluginSession)}`)
  }

  const copy = await requestJson('/api/plugin/copy', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pluginSession.token}` },
    body: JSON.stringify({
      url: PRODUCT_URL,
      hint: {
        title: 'Smoke Test Product',
        price: '99.00',
        images: [],
        detailImages: [],
        attributes: {
          brand: 'SmokeBrand',
          model: 'SmokeModel'
        }
      }
    })
  })
  if (!copy.success || !copy.draft?.id) {
    throw new Error(`copy failed: ${JSON.stringify(copy)}`)
  }

  const publish = await requestJson('/api/publish', {
    method: 'POST',
    headers: { Authorization: `Bearer ${pluginSession.token}` },
    body: JSON.stringify({ draftId: copy.draft.id })
  })
  if (!publish.success || publish.publishData?.type !== 'ZCY_PUBLISH') {
    throw new Error(`publish prepare failed: ${JSON.stringify(publish)}`)
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl: BASE_URL,
    userId: user.id,
    licenseKey: license.key,
    draftId: copy.draft.id,
    publishType: publish.publishData.type
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
