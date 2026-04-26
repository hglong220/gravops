const { PrismaClient } = require('@prisma/client')

const LICENSE_KEY = process.env.SMOKE_LICENSE_KEY || 'ZCAI-SMOKE-TEST-0001'
const companyName = process.argv.slice(2).join(' ').trim()

if (!companyName) {
  console.error('Usage: node scripts/bind-smoke-license-company.js <companyName>')
  process.exit(1)
}

const prisma = new PrismaClient()

async function main() {
  const license = await prisma.license.update({
    where: { key: LICENSE_KEY },
    data: { companyName }
  })

  console.log(JSON.stringify({
    ok: true,
    licenseKey: license.key,
    companyName: license.companyName
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
