const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCartridgeProducts() {
    console.log('🔍 检查硒鼓和墨水商品的分析结果...\n');

    // 查找硒鼓和墨水商品
    const products = await prisma.productDraft.findMany({
        where: {
            OR: [
                { title: { contains: '118A硒鼓' } },
                { title: { contains: 'GT51' } }
            ]
        },
        select: {
            id: true,
            title: true,
            categoryPath: true,
            permissionStatus: true,
            permissionCheckedAt: true
        }
    });

    console.log(`找到 ${products.length} 个商品：\n`);

    products.forEach((p, i) => {
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`商品 ${i + 1}:`);
        console.log(`标题: ${p.title.substring(0, 80)}...`);
        console.log(`AI分析的类目路径: ${p.categoryPath || '(未分析出路径)'}`);
        console.log(`权限状态: ${p.permissionStatus || '(未检测)'}`);
        console.log(`检测时间: ${p.permissionCheckedAt ? new Date(p.permissionCheckedAt).toLocaleString('zh-CN') : '(未检测)'}`);
        console.log('');
    });

    // 显示用户权限
    console.log('\n👤 用户拥有的一级类目权限:');
    const permissions = await prisma.userCategoryPermission.findMany({
        where: { licenseKey: '6GSM-24JW-XTRW-RRUG-SFEB' }
    });
    permissions.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.level1Category}`);
    });

    await prisma.$disconnect();
}

checkCartridgeProducts().catch(console.error);
