const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

p.license.findUnique({
    where: { key: '6GSM-24JW-XTRW-RRUG-SFEB' }
}).then(l => {
    console.log('License:', JSON.stringify(l, null, 2));
    p.$disconnect();
});
