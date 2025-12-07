const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function fixPermission() {
    const licenseKey = 'TEST-QHAI-STTS-2024-DEMO'

    const license = await prisma.license.findUnique({
        where: { key: licenseKey }
    })

    if (!license) {
        console.log('License不存在')
        return
    }

    console.log('License ID:', license.id)

    // 更新为正确的中文类目权限
    const permission = await prisma.userCategoryPermission.upsert({
        where: { licenseId: license.id },
        update: {
            market: '网上超市(青海网超)',
            level1Categories: JSON.stringify([
                '办公设备/耗材',  // 官方类目名称
                '日用百货',
                '计算机设备及软件',
                '劳动保护用品',
                '家居建材',  // 灯具在这个类目下
                '五金/工具'
            ])
        },
        create: {
            licenseId: license.id,
            market: '网上超市(青海网超)',
            level1Categories: JSON.stringify([
                '办公设备/耗材',
                '日用百货',
                '计算机设备及软件',
                '劳动保护用品',
                '家居建材',
                '五金/工具'
            ])
        }
    })

    console.log('✅ 权限已更新!')
    console.log('类目:', JSON.parse(permission.level1Categories))
}

fixPermission()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
