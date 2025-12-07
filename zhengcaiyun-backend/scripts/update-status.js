const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateStatus() {
    const result = await prisma.productDraft.updateMany({
        where: { status: 'pending' },
        data: { status: 'collected' }
    });
    console.log('Updated:', result.count, 'records');
    await prisma.$disconnect();
}

updateStatus();
