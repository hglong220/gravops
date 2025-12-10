const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    // 创建测试 License
    const license = await p.license.create({
        data: {
            key: 'TEST-QHAI-1234567890',
            companyName: '测试公司',
            plan: 'pro',
            maxDevices: 5,
            maxUsers: 5,
            monthlyQuota: 1000,
            expiresAt: new Date('2026-12-31'),
            status: 'active'
        }
    });
    console.log('Created License:', license.key);

    // 创建类目权限（使用插件提取到的22个类目）
    const categories = [
        '五金/工具', '手动工具', '电动工具', '测量工具', '机械五金件', '五金配附件',
        '夹持类工具', '划线工具', '焊接设备', '农用工具', '电子电工工具', '机电五金',
        '夹持类工具', '工具包/箱/车', '工具组合套装', '其它五金工具', '气动工具',
        '汽修汽保工具', '管道工具', '液压工具', '防爆工具', '铆接工具'
    ];

    for (const cat of categories) {
        await p.userCategoryPermission.upsert({
            where: { licenseKey_level1Category: { licenseKey: license.key, level1Category: cat } },
            update: {},
            create: {
                licenseKey: license.key,
                level1Category: cat,
                subCategories: '[]'
            }
        });
    }
    console.log('Created', categories.length, 'category permissions');

    await p.$disconnect();
}

main().catch(console.error);
