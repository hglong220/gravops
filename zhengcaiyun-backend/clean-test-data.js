const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function cleanTestData() {
    console.log('🧹 开始清理测试数据...\n');

    // 1. 查看要删除的商品
    const testProducts = await prisma.productDraft.findMany({
        where: { userId: 'test-user-001' },
        select: { id: true, title: true, createdAt: true }
    });

    console.log(`📋 找到 ${testProducts.length} 个测试商品:`);
    testProducts.forEach((p, i) => {
        const date = new Date(p.createdAt).toLocaleString('zh-CN');
        console.log(`  ${i + 1}. ${p.title.substring(0, 50)} (${date})`);
    });

    // 2. 删除测试用户的商品
    const deleteResult = await prisma.productDraft.deleteMany({
        where: { userId: 'test-user-001' }
    });

    console.log(`\n✅ 已删除 ${deleteResult.count} 个测试商品`);

    // 3. 验证结果
    const remainingTotal = await prisma.productDraft.count();
    const adminProducts = await prisma.productDraft.count({
        where: { userId: 'cmj5x20s40000upqkxzfosben' }
    });

    console.log('\n📊 清理后的数据统计:');
    console.log(`  数据库总商品数: ${remainingTotal} 个`);
    console.log(`  admin用户商品数: ${adminProducts} 个`);
    console.log(`  数据已一致: ${remainingTotal === adminProducts ? '✅ 是' : '❌ 否'}`);

    await prisma.$disconnect();
}

cleanTestData().catch(console.error);
