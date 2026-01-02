const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const p = await prisma.productDraft.findFirst({
        where: { title: { contains: '118A' } }
    });

    console.log('商品标题:', p.title);
    console.log('AI分析类目路径:', p.categoryPath);
    console.log('权限状态:', p.permissionStatus);

    await prisma.$disconnect();
}

check();
