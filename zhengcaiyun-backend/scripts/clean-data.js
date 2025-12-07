const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanBadData() {
    const result = await prisma.productDraft.deleteMany({
        where: {
            title: {
                contains: '下载采云学院APP'
            }
        }
    });
    console.log('Deleted bad records:', result.count);
    await prisma.$disconnect();
}

cleanBadData();
