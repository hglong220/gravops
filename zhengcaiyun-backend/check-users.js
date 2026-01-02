const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkUsers() {
    // 按userId分组
    const byUser = await prisma.productDraft.groupBy({
        by: ['userId'],
        _count: true
    });

    console.log('📊 按用户分组的商品数量:');
    for (const group of byUser) {
        // 查找用户信息
        const user = await prisma.user.findUnique({
            where: { id: group.userId },
            select: { email: true, name: true }
        });
        console.log(`  用户 ${group.userId}:`);
        console.log(`    邮箱: ${user?.email || '未知'}`);
        console.log(`    商品数: ${group._count} 个`);
        console.log('');
    }

    await prisma.$disconnect();
}

checkUsers().catch(console.error);
