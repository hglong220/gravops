const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function createTestLicense() {
    // 生成一个简单的License Key
    const licenseKey = 'TEST-QHAI-STTS-2024-DEMO'
    const companyName = '青海世天建设工程有限公司'

    // 检查是否已存在
    const existing = await prisma.license.findUnique({
        where: { key: licenseKey }
    })

    if (existing) {
        console.log('License已存在:', existing.key)
        console.log('绑定公司:', existing.companyName || '未绑定')
        return
    }

    // 创建新的License
    const license = await prisma.license.create({
        data: {
            key: licenseKey,
            companyName: companyName,
            plan: 'professional',
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 一年后过期
            status: 'active',
            maxDevices: 5
        }
    })

    console.log('✅ 创建成功!')
    console.log('License Key:', license.key)
    console.log('公司名称:', license.companyName)
    console.log('请使用这个Key激活插件')
}

createTestLicense()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
