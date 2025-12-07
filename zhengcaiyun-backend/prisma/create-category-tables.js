// 使用 Prisma Client 执行原生 SQL 创建表
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('开始创建表...');

    // 创建 CategoryTemplate 表
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS CategoryTemplate (
            id TEXT PRIMARY KEY,
            titleKey TEXT NOT NULL,
            platform TEXT,
            brand TEXT,
            categoryPath TEXT NOT NULL,
            hitCount INTEGER DEFAULT 1,
            confidence REAL DEFAULT 1.0,
            source TEXT DEFAULT 'ai',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('✓ CategoryTemplate 表创建成功');

    // 创建 UserCategoryPermission 表
    await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS UserCategoryPermission (
            id TEXT PRIMARY KEY,
            licenseKey TEXT NOT NULL,
            market TEXT,
            level1Category TEXT NOT NULL,
            subCategories TEXT NOT NULL,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);
    console.log('✓ UserCategoryPermission 表创建成功');

    // 创建索引
    const indexes = [
        `CREATE INDEX IF NOT EXISTS idx_category_template_title ON CategoryTemplate(titleKey);`,
        `CREATE INDEX IF NOT EXISTS idx_category_template_platform ON CategoryTemplate(platform);`,
        `CREATE INDEX IF NOT EXISTS idx_category_template_hit ON CategoryTemplate(hitCount);`,
        `CREATE INDEX IF NOT EXISTS idx_user_permission_license ON UserCategoryPermission(licenseKey);`,
        `CREATE INDEX IF NOT EXISTS idx_user_permission_level1 ON UserCategoryPermission(level1Category);`,
    ];

    for (const sql of indexes) {
        try {
            await prisma.$executeRawUnsafe(sql);
        } catch (e) {
            // 索引可能已存在
        }
    }
    console.log('✓ 索引创建成功');

    console.log('数据库表创建完成！');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
