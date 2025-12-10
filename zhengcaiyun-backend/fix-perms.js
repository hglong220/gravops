const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // 删除旧权限
    await p.userCategoryPermission.deleteMany({});

    // 使用官方一级类目名称
    await p.userCategoryPermission.create({
        data: {
            licenseKey: 'TEST-QHAI-1234567890',
            level1Category: '五金/工具',
            subCategories: '[]'
        }
    });

    await p.userCategoryPermission.create({
        data: {
            licenseKey: 'TEST-QHAI-1234567890',
            level1Category: '办公设备',
            subCategories: '[]'
        }
    });

    console.log('已重建类目权限: 五金/工具, 办公设备');
    await p.$disconnect();
}

main();
