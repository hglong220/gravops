const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const licenses = await p.license.findMany({ take: 3, select: { key: true } });
    console.log('Licenses:', JSON.stringify(licenses, null, 2));

    const perms = await p.userCategoryPermission.findMany({ take: 5, select: { licenseKey: true, level1Category: true } });
    console.log('Permissions:', JSON.stringify(perms, null, 2));

    await p.$disconnect();
}

main();
