const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProducts() {
    // 总数
    const total = await prisma.productDraft.count();
    console.log('📊 总商品数量:', total);

    // 按状态分组
    const byStatus = await prisma.productDraft.groupBy({
        by: ['status'],
        _count: true
    });
    console.log('\n按状态分组:');
    byStatus.forEach(s => console.log(`  ${s.status}: ${s._count} 个`));

    // 最近的商品
    const recent = await prisma.productDraft.findMany({
        select: {
            id: true,
            title: true,
            status: true,
            createdAt: true
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    console.log('\n最近20个商品:');
    recent.forEach((p, i) => {
        const date = new Date(p.createdAt).toLocaleString('zh-CN');
        console.log(`${i + 1}. [${p.status}] ${p.title.substring(0, 40)} (${date})`);
    });

    await prisma.$disconnect();
}

checkProducts().catch(console.error);
