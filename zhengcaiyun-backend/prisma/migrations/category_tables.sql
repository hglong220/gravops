-- 创建类目模板库表
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

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_category_template_title ON CategoryTemplate(titleKey);
CREATE INDEX IF NOT EXISTS idx_category_template_platform ON CategoryTemplate(platform);
CREATE INDEX IF NOT EXISTS idx_category_template_hit ON CategoryTemplate(hitCount);
CREATE UNIQUE INDEX IF NOT EXISTS idx_category_template_unique ON CategoryTemplate(titleKey, platform, brand);

-- 创建用户权限类目表
CREATE TABLE IF NOT EXISTS UserCategoryPermission (
    id TEXT PRIMARY KEY,
    licenseKey TEXT NOT NULL,
    market TEXT,
    level1Category TEXT NOT NULL,
    subCategories TEXT NOT NULL,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_permission_license ON UserCategoryPermission(licenseKey);
CREATE INDEX IF NOT EXISTS idx_user_permission_level1 ON UserCategoryPermission(level1Category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_permission_unique ON UserCategoryPermission(licenseKey, level1Category);
