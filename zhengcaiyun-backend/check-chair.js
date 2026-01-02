const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkChairCategory() {
    // 查找办公椅商品
    const chair = await prisma.productDraft.findFirst({
        where: {
            title: { contains: '顾全办公椅' }
        },
        select: {
            id: true,
            title: true,
            brand: true,
            categoryPath: true,
            permissionStatus: true,
            permissionCheckedAt: true
        }
    });

    if (chair) {
        console.log('📋 办公椅商品信息:');
        console.log('  标题:', chair.title);
        console.log('  品牌:', chair.brand);
        console.log('  类目路径:', chair.categoryPath || '(未设置)');
        console.log('  权限状态:', chair.permissionStatus || '(未检测)');
        console.log('  检测时间:', chair.permissionCheckedAt || '(未检测)');
    } else {
        console.log('❌ 未找到办公椅商品');
    }

    await prisma.$disconnect();
}

checkChairCategory().catch(console.error);
