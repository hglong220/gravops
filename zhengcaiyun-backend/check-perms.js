const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
    const perms = await p.userCategoryPermission.findMany();
    console.log('权限数量:', perms.length);
    perms.forEach(x => console.log('-', x.licenseKey, '|', x.level1Category));
}

main().finally(() => p.$disconnect());
