const fs = require('fs');

// 读取真实数据
const fullData = require('./zcy_categories_full.json');

// 生成完整的SQL插入语句
let sql = `-- 政采云类目完整数据导入\n`;
sql += `-- 数据来源：政采云官方API真实提取\n`;
sql += `-- 总计：132个类目（3个一级 + 35个二级 + 94个三级）\n`;
sql += `-- 生成时间：${new Date().toISOString()}\n\n`;

// 清空旧数据
sql += `-- 清空旧数据\nDELETE FROM zcy_categories;\n\n`;

const allCategories = [];

// 递归提取所有类目
function extractCategories(cat, parentId = null) {
    allCategories.push({
        id: cat.id,
        categoryCode: cat.code || cat.categoryCode || cat.id.toString(),
        name: cat.name,
        level: cat.level,
        parentId: parentId,
        hasChildren: cat.hasChildren || (cat.children && cat.children.length > 0),
        hasSpu: cat.hasSpu || false,
        authed: cat.authed !== undefined ? cat.authed : true
    });

    if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => {
            extractCategories(child, cat.id);
        });
    }
}

fullData.categories.forEach(cat => {
    extractCategories(cat, null);
});

console.log(`✅ 提取到 ${allCategories.length} 个类目`);

// 按层级分组
const level1 = allCategories.filter(c => c.level === 1);
const level2 = allCategories.filter(c => c.level === 2);
const level3 = allCategories.filter(c => c.level === 3);

console.log(`📊 一级类目: ${level1.length} 个`);
console.log(`📊 二级类目: ${level2.length} 个`);
console.log(`📊 三级类目: ${level3.length} 个`);

// 生成插入语句
sql += `-- 插入一级类目 (${level1.length}个)\n`;
level1.forEach((cat, idx) => {
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (${cat.id}, '${cat.categoryCode}', '${cat.name.replace(/'/g, "''")}', ${cat.level}, NULL, ${cat.hasChildren ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
});

sql += `\n-- 插入二级类目 (${level2.length}个)\n`;
level2.forEach((cat, idx) => {
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, authed, sort_order) VALUES (${cat.id}, '${cat.categoryCode}', '${cat.name.replace(/'/g, "''")}', ${cat.level}, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
});

sql += `\n-- 插入三级类目 (${level3.length}个)\n`;
level3.forEach((cat, idx) => {
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (${cat.id}, '${cat.categoryCode}', '${cat.name.replace(/'/g, "''")}', ${cat.level}, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
});

sql += `\n-- 提交事务\nCOMMIT;\n`;

// 保存SQL文件
fs.writeFileSync('zhengcaiyun-backend/database/zcy_categories_full_insert.sql', sql, 'utf8');

// 同时生成JSON格式（供前端使用）
const frontendData = {
    meta: {
        total: allCategories.length,
        level1Count: level1.length,
        level2Count: level2.length,
        level3Count: level3.length,
        lastUpdate: new Date().toISOString(),
        source: '政采云官方API'
    },
    categories: allCategories,
    tree: fullData.categories
};

fs.writeFileSync('zhengcaiyun-backend/public/api/categories.json', JSON.stringify(frontendData, null, 2), 'utf8');

console.log('\n✅ 生成完成！');
console.log('📁 文件:');
console.log('   - zhengcaiyun-backend/database/zcy_categories_full_insert.sql (SQL导入)');
console.log('   - zhengcaiyun-backend/public/api/categories.json (前端JSON)');
console.log('\n📊 数据统计:');
console.log(`   - 总计: ${allCategories.length} 个类目`);
console.log(`   - 一级: ${level1.length} 个`);
console.log(`   - 二级: ${level2.length} 个`);
console.log(`   - 三级: ${level3.length} 个`);
