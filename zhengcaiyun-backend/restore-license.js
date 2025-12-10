const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // 恢复真实的 License: 青海世天建设工程有限公司
    const license = await p.license.upsert({
        where: { key: '6GSM-24JW-XTRW-RRUG-SFEB' },
        update: {},
        create: {
            key: '6GSM-24JW-XTRW-RRUG-SFEB',
            companyName: '青海世天建设工程有限公司',
            plan: 'pro',
            maxDevices: 5,
            maxUsers: 5,
            monthlyQuota: 1000,
            expiresAt: new Date('2026-01-07'),
            status: 'active'
        }
    });
    console.log('已恢复 License:', license.key, '->', license.companyName);

    // 为该 License 创建类目权限（五金/工具 是您当前在使用的）
    const categories = ['五金/工具'];

    for (const cat of categories) {
        await p.userCategoryPermission.upsert({
            where: {
                licenseKey_level1Category: {
                    licenseKey: license.key,
                    level1Category: cat
                }
            },
            update: {},
            create: {
                licenseKey: license.key,
                level1Category: cat,
                subCategories: '[]'
            }
        });
    }
    console.log('已创建类目权限:', categories.join(', '));

    await p.$disconnect();
}

main().catch(console.error);
