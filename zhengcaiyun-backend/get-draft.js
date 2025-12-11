const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.productDraft.findUnique({
    where: { id: 'cmj0y7bmv0004upc4ixmstntw' }
}).then(d => {
    console.log('Draft:', d ? JSON.stringify(d, null, 2) : '不存在');
    p.$disconnect();
});
