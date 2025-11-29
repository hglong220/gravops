const fs = require('fs');
const path = require('path');

// 读取两份数据
const oldData = require('../zcy_categories_full.json');
const newDataPath = path.join(__dirname, 'output/zcy_complete_categories.json');

let newData = { categories: [] };
if (fs.existsSync(newDataPath)) {
    newData = require('./output/zcy_complete_categories.json');
}

console.log('📊 数据对比:');
console.log(`   旧数据: ${oldData.meta.totalCategories} 个类目`);
console.log(`   新数据: ${newData.meta?.totalCategories || 0} 个类目\n`);

// 合并策略：使用Map去重，ID相同的保留更完整的数据
const allCategoriesMap = new Map();

// 先添加旧数据（递归扁平化）
function flattenOldData(cats, parentId = null) {
    cats.forEach(cat => {
        allCategoriesMap.set(cat.id, {
            id: cat.id,
            categoryCode: cat.code || cat.categoryCode || cat.id.toString(),
            name: cat.name,
            level: cat.level,
            parentId: parentId,
            hasChildren: cat.hasChildren || false,
            hasSpu: cat.hasSpu || false,
            authed: cat.authed !== undefined ? cat.authed : true
        });

        if (cat.children && cat.children.length > 0) {
            flattenOldData(cat.children, cat.id);
        }
    });
}

flattenOldData(oldData.categories);
console.log(`✅ 旧数据扁平化: ${allCategoriesMap.size} 个`);

// 再添加新数据
function flattenNewData(cats) {
    cats.forEach(cat => {
        if (!allCategoriesMap.has(cat.id)) {
            allCategoriesMap.set(cat.id, cat);
        } else {
            // ID已存在，合并信息（保留更完整的）
            const existing = allCategoriesMap.get(cat.id);
            allCategoriesMap.set(cat.id, {
                ...existing,
                categoryCode: existing.categoryCode || cat.categoryCode,
                hasChildren: existing.hasChildren || cat.hasChildren,
                hasSpu: existing.hasSpu || cat.hasSpu
            });
        }

        if (cat.children && cat.children.length > 0) {
            flattenNewData(cat.children);
        }
    });
}

if (newData.categories && newData.categories.length > 0) {
    flattenNewData(newData.categories);
    console.log(`✅ 合并后总数: ${allCategoriesMap.size} 个\n`);
}

// 统计
const arr = Array.from(allCategoriesMap.values());
const level1 = arr.filter(c => c.level === 1);
const level2 = arr.filter(c => c.level === 2);
const level3 = arr.filter(c => c.level === 3);
const level4 = arr.filter(c => c.level === 4);

console.log('📊 最终统计:');
console.log(`   一级: ${level1.length}`);
console.log(`   二级: ${level2.length}`);
console.log(`   三级: ${level3.length}`);
console.log(`   四级: ${level4.length}`);
console.log(`   总计: ${arr.length}\n`);

// 重建树形结构
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

// 保存最终数据
const output = {
    meta: {
        source: '合并数据（旧数据 + 新提取）',
        mergedAt: new Date().toISOString(),
        totalCategories: arr.length,
        level1Count: level1.length,
        level2Count: level2.length,
        level3Count: level3.length,
        level4Count: level4.length,
        note: '包含完整的1-2-3-4级类目树'
    },
    categories: tree
};

fs.writeFileSync(path.join(__dirname, 'output/zcy_merged_final.json'), JSON.stringify(output, null, 2));

console.log('✅ 已保存到: output/zcy_merged_final.json');
console.log('\n='.repeat(60));
console.log('🎉 合并完成！');
console.log('='.repeat(60));
