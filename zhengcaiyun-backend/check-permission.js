const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function checkPermission() {
    const licenseKey = 'TEST-QHAI-STTS-2024-DEMO'

    const license = await prisma.license.findUnique({
        where: { key: licenseKey }
    })

    if (!license) {
        console.log('License不存在')
        return
    }

    console.log('License ID:', license.id)

    const permission = await prisma.userCategoryPermission.findFirst({
        where: { licenseId: license.id }
    })

    if (permission) {
        console.log('✅ 有类目权限:', permission.level1Categories)
    } else {
        console.log('❌ 无类目权限，需要创建')

        // 为这个License创建权限
        const newPerm = await prisma.userCategoryPermission.create({
            data: {
                licenseId: license.id,
                level1Categories: JSON.stringify(['家具', '办公设备/耗材', '日用百货', '五金/工具', '计算机设备及软件'])
            }
        })
        console.log('✅ 已创建权限:', newPerm.level1Categories)
    }
}

checkPermission()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect())
