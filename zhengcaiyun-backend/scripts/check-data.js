const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
    const drafts = await prisma.productDraft.findMany({
        select: { id: true, title: true, userId: true, createdAt: true },
        orderBy: { createdAt: 'desc' }
    });

    console.log('Total records:', drafts.length);
    drafts.forEach(d => {
        console.log(d.userId, '|', d.title?.substring(0, 40), '|', d.createdAt);
    });

    await prisma.$disconnect();
}

checkData();
