/**
 * 合并所有提取的类目数据
 * 自动去重，保留最完整的信息
 */

const fs = require('fs');
const path = require('path');

console.log('🔄 开始合并所有类目数据...\n');

const allCategoriesMap = new Map();

// 数据源列表
const sources = [
    {
        name: '旧数据（132个）',
        path: './zcy_categories_full.json'
    },
    {
        name: '30分钟提取（10035个）',
        path: './zcy-auto-miner/output/zcy_30min_manual.json'
    },
    {
        name: '1小时提取',
        path: './zcy-auto-miner/output/zcy_1hour_manual.json'
    },
    {
        name: '40分钟4-5级提取',
        path: './zcy-auto-miner/output/zcy_45_levels.json'
    }
];

// 递归扁平化函数
function flattenCategories(cats, parentId = null) {
    const result = [];

    cats.forEach(cat => {
        result.push({
            id: cat.id,
            categoryCode: cat.code || cat.categoryCode || cat.id.toString(),
            name: cat.name,
            level: cat.level,
            parentId: parentId || cat.parentId || null,
            hasChildren: cat.hasChildren || false,
            hasSpu: cat.hasSpu || false,
            authed: cat.authed !== undefined ? cat.authed : true
        });

        if (cat.children && cat.children.length > 0) {
            result.push(...flattenCategories(cat.children, cat.id));
        }
    });

    return result;
}

// 逐个加载并合并数据
sources.forEach(source => {
    const filePath = path.join(__dirname, source.path);

    if (fs.existsSync(filePath)) {
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const cats = flattenCategories(data.categories || []);

            let newCount = 0;
            cats.forEach(cat => {
                if (!allCategoriesMap.has(cat.id)) {
                    allCategoriesMap.set(cat.id, cat);
                    newCount++;
                } else {
                    // ID已存在，合并信息（保留更完整的）
                    const existing = allCategoriesMap.get(cat.id);
                    allCategoriesMap.set(cat.id, {
                        ...existing,
                        categoryCode: existing.categoryCode || cat.categoryCode,
                        hasChildren: existing.hasChildren || cat.hasChildren,
                        hasSpu: existing.hasSpu || cat.hasSpu,
                        authed: existing.authed !== undefined ? existing.authed : cat.authed
                    });
                }
            });

            console.log(`✅ ${source.name}: ${cats.length} 个 (+${newCount} 新增)`);
        } catch (e) {
            console.log(`⚠️  ${source.name}: 文件不存在或格式错误`);
        }
    } else {
        console.log(`⚠️  ${source.name}: 文件不存在`);
    }
});

console.log(`\n📊 合并后总数: ${allCategoriesMap.size} 个类目\n`);

// 转为数组并统计
const arr = Array.from(allCategoriesMap.values());

// 智能推断层级
arr.forEach(cat => {
    if (!cat.parentId) {
        cat.level = 1;
    } else {
        const parent = arr.find(c => c.id === cat.parentId);
        if (parent) {
            cat.level = (parent.level || 1) + 1;
        }
    }
});

const level1 = arr.filter(c => c.level === 1);
const level2 = arr.filter(c => c.level === 2);
const level3 = arr.filter(c => c.level === 3);
const level4 = arr.filter(c => c.level === 4);

console.log('📊 层级统计:');
console.log(`   一级: ${level1.length} 个`);
console.log(`   二级: ${level2.length} 个`);
console.log(`   三级: ${level3.length} 个`);
if (level4.length > 0) {
    console.log(`   四级: ${level4.length} 个`);
}
console.log(`   总计: ${arr.length} 个\n`);

// 构建完整的树形结构
const tree = level1.map(cat1 => ({
    ...cat1,
    children: level2.filter(c => c.parentId === cat1.id).map(cat2 => ({
        ...cat2,
        children: level3.filter(c => c.parentId === cat2.id).map(cat3 => ({
            ...cat3,
            children: level4.filter(c => c.parentId === cat3.id)
        }))
    }))
}));

// 生成最终输出
const output = {
    meta: {
        source: '合并所有数据源（旧数据 + 30分钟 + 1小时）',
        mergedAt: new Date().toISOString(),
        totalCategories: arr.length,
        level1Count: level1.length,
        level2Count: level2.length,
        level3Count: level3.length,
        level4Count: level4.length,
        note: '包含完整的1-2-3-4级类目（自动去重合并）'
    },
    categories: tree
};

// 保存最终数据
fs.writeFileSync('./zcy-auto-miner/output/zcy_final_merged.json', JSON.stringify(output, null, 2));
fs.writeFileSync('./zcy_categories_final.json', JSON.stringify(output, null, 2));

console.log('✅ 已保存:');
console.log('   📄 ./zcy-auto-miner/output/zcy_final_merged.json');
console.log('   📄 ./zcy_categories_final.json\n');

// 生成SQL
console.log('🔨 生成SQL文件...\n');

let sql = `-- 政采云完整类目数据（最终合并版）\n`;
sql += `-- 数据来源：多源合并去重\n`;
sql += `-- 总计：${arr.length}个类目\n`;
sql += `-- 一级：${level1.length} | 二级：${level2.length} | 三级：${level3.length}\n`;
sql += `-- 生成时间：${new Date().toISOString()}\n\n`;

sql += `DELETE FROM zcy_categories;\n\n`;

// 一级
sql += `-- 一级类目 (${level1.length}个)\n`;
level1.forEach((cat, idx) => {
    const code = cat.categoryCode.replace(/'/g, "''");
    const name = cat.name.replace(/'/g, "''");
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (${cat.id}, '${code}', '${name}', 1, NULL, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
});

// 二级
sql += `\n-- 二级类目 (${level2.length}个)\n`;
level2.forEach((cat, idx) => {
    const code = cat.categoryCode.replace(/'/g, "''");
    const name = cat.name.replace(/'/g, "''");
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (${cat.id}, '${code}', '${name}', 2, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
});

// 三级
sql += `\n-- 三级类目 (${level3.length}个)\n`;
level3.forEach((cat, idx) => {
    const code = cat.categoryCode.replace(/'/g, "''");
    const name = cat.name.replace(/'/g, "''");
    sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (${cat.id}, '${code}', '${name}', 3, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
});

// 四级（如果有）
if (level4.length > 0) {
    sql += `\n-- 四级类目 (${level4.length}个)\n`;
    level4.forEach((cat, idx) => {
        const code = cat.categoryCode.replace(/'/g, "''");
        const name = cat.name.replace(/'/g, "''");
        sql += `INSERT INTO zcy_categories (id, category_code, name, level, parent_id, has_children, has_spu, authed, sort_order) VALUES (${cat.id}, '${code}', '${name}', 4, ${cat.parentId}, ${cat.hasChildren ? 1 : 0}, ${cat.hasSpu ? 1 : 0}, ${cat.authed ? 1 : 0}, ${idx + 1});\n`;
    });
}

sql += `\nCOMMIT;\n`;

fs.writeFileSync('./zhengcaiyun-backend/database/zcy_categories_final.sql', sql);
fs.copyFileSync('./zcy_categories_final.json', './zhengcaiyun-backend/public/api/categories.json');

console.log('✅ 已生成:');
console.log('   📄 SQL: ./zhengcaiyun-backend/database/zcy_categories_final.sql');
console.log('   📄 JSON: ./zhengcaiyun-backend/public/api/categories.json\n');

console.log('='.repeat(80));
console.log('🎉 合并完成！');
console.log(`📊 最终数据: ${arr.length} 个类目`);
console.log('='.repeat(80));
