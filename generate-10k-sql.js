const fs = require('fs');

// 读取30分钟手动提取的数据
const data = require('./zcy-auto-miner/output/zcy_30min_manual.json');

console.log('📊 处理10035个类目...\n');

// 扁平化所有类目
const allCats = [];

function flatten(cats, parentId = null) {
    cats.forEach(cat => {
        allCats.push({
            ...cat,
            parentId: parentId || cat.parentId
        });

        if (cat.children && cat.children.length > 0) {
            flatten(cat.children, cat.id);
        }
    });
}

flatten(data.categories);

console.log(`✅ 提取: ${allCats.length} 个类目\n`);

// 按层级分组
const byLevel = {
    1: allCats.filter(c => c.level === 1),
    2: allCats.filter(c => c.level === 2),
    3: allCats.filter(c => c.level === 3),
    4: allCats.filter(c => c.level === 4)
};

console.log(`📊 统计:`);
console.log(`   一级: ${byLevel[1].length}`);
console.log(`   二级: ${byLevel[2].length}`);
console.log(`   三级: ${byLevel[3].length}`);
console.log(`   四级: ${byLevel[4].length}\n`);

// 生成SQL
let sql = `-- 政采云类目数据（10035个）\n`;
sql += `-- 来源：30分钟手动提取\n`;
sql += `-- 包含：${byLevel[1].length}个一级 + ${byLevel[2].length}个二级 + ${byLevel[3].length}个三级\n`;
sql += `-- 生成时间：${new Date().toISOString()}\n\n`;

sql += `DELETE FROM zcy_categories;\n\n`;

// 一级
sql += `-- 一级类目 (${byLevel[1].length}个)\n`;
byLevel[1].forEach((cat, idx) => {
    const code = cat.categoryCode || cat.id.toString();
    const name = cat.name.replace(/'/g, "''");
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, sort_order) VALUES (${cat.id}, '${code}', '${name}', 1, NULL, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${idx + 1});\n`;
});

// 二级
sql += `\n-- 二级类目 (${byLevel[2].length}个)\n`;
byLevel[2].forEach((cat, idx) => {
    const code = cat.categoryCode || cat.id.toString();
    const name = cat.name.replace(/'/g, "''");
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, sort_order) VALUES (${cat.id}, '${code}', '${name}', 2, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${idx + 1});\n`;
});

// 三级
sql += `\n-- 三级类目 (${byLevel[3].length}个)\n`;
byLevel[3].forEach((cat, idx) => {
    const code = cat.categoryCode || cat.id.toString();
    const name = cat.name.replace(/'/g, "''");
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, sort_order) VALUES (${cat.id}, '${code}', '${name}', 3, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${idx + 1});\n`;
});

// 四级（如果有）
if (byLevel[4].length > 0) {
    sql += `\n-- 四级类目 (${byLevel[4].length}个)\n`;
    byLevel[4].forEach((cat, idx) => {
        const code = cat.categoryCode || cat.id.toString();
        const name = cat.name.replace(/'/g, "''");
        sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, sort_order) VALUES (${cat.id}, '${code}', '${name}', 4, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${idx + 1});\n`;
    });
}

sql += `\nCOMMIT;\n`;

// 保存SQL
fs.writeFileSync('./zhengcaiyun-backend/database/zcy_categories_10k.sql', sql);

// 保存JSON供前端使用
fs.copyFileSync('./zcy-auto-miner/output/zcy_30min_manual.json', './zhengcaiyun-backend/public/api/categories.json');

console.log('✅ 已生成:');
console.log('   📄 SQL: zhengcaiyun-backend/database/zcy_categories_10k.sql');
console.log('   📄 JSON: zhengcaiyun-backend/public/api/categories.json\n');
console.log('🎉 完成！可以导入数据库了！');
