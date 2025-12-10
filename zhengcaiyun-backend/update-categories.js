const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const licenseKey = '6GSM-24JW-XTRW-RRUG-SFEB';

    // 清除旧的类目权限
    await p.userCategoryPermission.deleteMany({
        where: { licenseKey }
    });

    // 您的真实类目权限（从政采云截图，与官方类目树一致）
    const categories = [
        '办公用品',
        '办公设备',
        '日用百货',
        '计算机设备',
        '劳动保护用品',
        '灯具商品',
        '五金工具',
    ];

    for (const cat of categories) {
        await p.userCategoryPermission.create({
            data: {
                licenseKey,
                level1Category: cat,
                subCategories: '[]'
            }
        });
        console.log('已添加类目:', cat);
    }

    console.log('\n总计:', categories.length, '个类目权限');
    await p.$disconnect();
}

main().catch(console.error);
