const fs = require('fs');

// 读取合并后的完整数据
const data = require('./zcy_categories_complete.json');

console.log('📊 生成SQL文件...\n');

let sql = `-- 政采云完整类目数据（最终版）\n`;
sql += `-- 数据来源：合并数据（旧数据 + 新提取）\n`;
sql += `-- 总计：${data.meta.totalCategories}个类目\n`;
sql += `-- 一级：${data.meta.level1Count} | 二级：${data.meta.level2Count} | 三级：${data.meta.level3Count}\n`;
sql += `-- 生成时间：${new Date().toISOString()}\n\n`;

// 清空旧数据
sql += `DELETE FROM zcy_categories;\n\n`;

// 扁平化所有类目
const allCats = [];

function flatten(cats, parentId = null) {
    cats.forEach(cat => {
        allCats.push({
            ...cat,
            parentId: parentId
        });

        if (cat.children && cat.children.length > 0) {
            flatten(cat.children, cat.id);
        }
    });
}

flatten(data.categories);

console.log(`✅ 扁平化: ${allCats.length} 个类目\n`);

// 按层级分组
const byLevel = {
    1: allCats.filter(c => c.level === 1),
    2: allCats.filter(c => c.level === 2),
    3: allCats.filter(c => c.level === 3)
};

// 生成INSERT语句
sql += `-- 一级类目 (${byLevel[1].length}个)\n`;
byLevel[1].forEach((cat, idx) => {
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children,has_spu, authed, sort_order) VALUES (${cat.id}, '${cat.categoryCode}', '${cat.name.replace(/'/g, "''")}', ${cat.level}, NULL, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
});

sql += `\n-- 二级类目 (${byLevel[2].length}个)\n`;
byLevel[2].forEach((cat, idx) => {
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (${cat.id}, '${cat.categoryCode}', '${cat.name.replace(/'/g, "''")}', ${cat.level}, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed !== undefined ? (cat.authed ? 1 : 0) : 1}, ${idx + 1});\n`;
});

sql += `\n-- 三级类目 (${byLevel[3].length}个)\n`;
byLevel[3].forEach((cat, idx) => {
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (${cat.id}, '${cat.categoryCode}', '${cat.name.replace(/'/g, "''")}', ${cat.level}, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed !== undefined ? (cat.authed ? 1 : 0) : 1}, ${idx + 1});\n`;
});

sql += `\nCOMMIT;\n`;

// 保存SQL
fs.writeFileSync('./zhengcaiyun-backend/database/zcy_categories_complete.sql', sql);

// 同时生成前端JSON
fs.copyFileSync('./zcy_categories_complete.json', './zhengcaiyun-backend/public/api/categories.json');

console.log('✅ 已生成:');
console.log('   📄 SQL: zhengcaiyun-backend/database/zcy_categories_complete.sql');
console.log('   📄 JSON: zhengcaiyun-backend/public/api/categories.json\n');

console.log('📊 最终统计:');
console.log(`   ✅ 一级: ${byLevel[1].length} 个`);
console.log(`   ✅ 二级: ${byLevel[2].length} 个`);
console.log(`   ✅ 三级: ${byLevel[3].length} 个`);
console.log(`   ✅ 总计: ${allCats.length} 个\n`);

console.log('🎉 完成！可以导入数据库了！');
