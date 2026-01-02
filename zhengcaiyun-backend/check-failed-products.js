const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkFailedProducts() {
    console.log('🔍 检查未通过权限检测的商品...\n');

    // 查找所有invalid的商品
    const products = await prisma.productDraft.findMany({
        where: {
            permissionStatus: 'invalid'
        },
        select: {
            id: true,
            title: true,
            categoryPath: true,
            permissionStatus: true,
            permissionCheckedAt: true
        },
        orderBy: {
            permissionCheckedAt: 'desc'
        }
    });

    console.log(`📊 找到 ${products.length} 个无权限商品：\n`);

    products.forEach((p, i) => {
        console.log(`${i + 1}. ${p.title.substring(0, 60)}`);
        console.log(`   类目路径: ${p.categoryPath || '(未设置)'}`);
        console.log(`   检测时间: ${p.permissionCheckedAt ? new Date(p.permissionCheckedAt).toLocaleString('zh-CN') : '(未检测)'}`);
        console.log('');
    });

    // 查找用户权限
    console.log('👤 用户权限类目:');
    const permissions = await prisma.userCategoryPermission.findMany({
        where: { licenseKey: '6GSM-24JW-XTRW-RRUG-SFEB' }
    });

    const categories = permissions.map(p => p.level1Category);
    console.log(categories.join(', '));

    await prisma.$disconnect();
}

checkFailedProducts().catch(console.error);
