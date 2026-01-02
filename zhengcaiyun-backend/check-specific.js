const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkSpecificProducts() {
    console.log('🔍 检查特定商品的权限检测结果...\n');

    // 查找硒鼓和墨水相关商品
    const keywords = ['硒鼓', '墨', '扫地', '洗衣'];

    for (const keyword of keywords) {
        const products = await prisma.productDraft.findMany({
            where: {
                title: { contains: keyword }
            },
            select: {
                title: true,
                categoryPath: true,
                permissionStatus: true
            }
        });

        if (products.length > 0) {
            console.log(`\n📦 关键词"${keyword}"相关商品:`);
            products.forEach(p => {
                console.log(`  标题: ${p.title.substring(0, 60)}`);
                console.log(`  AI分析类目: ${p.categoryPath || '(未分析)'}`);
                console.log(`  权限状态: ${p.permissionStatus || '(未检测)'}`);
                console.log('');
            });
        }
    }

    // 用户权限
    console.log('\n👤 用户拥有的一级类目权限:');
    const permissions = await prisma.userCategoryPermission.findMany({
        where: { licenseKey: '6GSM-24JW-XTRW-RRUG-SFEB' }
    });
    permissions.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.level1Category}`);
    });

    await prisma.$disconnect();
}

checkSpecificProducts().catch(console.error);
