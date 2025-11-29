const fs = require('fs');

// 读取你现有的真实政采云数据
const fullData = require('./zcy_categories_full.json');

// 扁平化处理，生成完整的类目列表
const flatCategories = [];
const categoryMap = new Map();

function processCategory(cat, parentId = null) {
    const item = {
        id: cat.id,
        categoryCode: cat.code || cat.categoryCode || cat.id.toString(), // 商品代码
        name: cat.name,
        level: cat.level,
        parentId: parentId,
        hasChildren: cat.hasChildren || (cat.children && cat.children.length > 0),
        authed: cat.authed !== undefined ? cat.authed : true,
        hasSpu: cat.hasSpu || false
    };

    flatCategories.push(item);
    categoryMap.set(cat.id, item);

    // 递归处理子类目
    if (cat.children && cat.children.length > 0) {
        cat.children.forEach(child => {
            processCategory(child, cat.id);
        });
    }
}

// 处理所有类目
fullData.categories.forEach(cat => {
    processCategory(cat, null);
});

console.log(`✅ 处理完成！`);
console.log(`📊 总类目数: ${flatCategories.length}`);
console.log(`📊 一级类目: ${flatCategories.filter(c => c.level === 1).length}`);
console.log(`📊 二级类目: ${flatCategories.filter(c => c.level === 2).length}`);
console.log(`📊 三级类目: ${flatCategories.filter(c => c.level === 3).length}`);

// 保存扁平化的数据
const output = {
    meta: {
        source: "政采云官方真实数据",
        extractedFrom: fullData.meta.source,
        totalCategories: flatCategories.length,
        lastUpdated: new Date().toISOString(),
        note: "所有ID和名称都来自政采云官方，可直接用于商品发布"
    },
    categories: flatCategories
};

fs.writeFileSync('政采云真实类目_扁平化.json', JSON.stringify(output, null, 2), 'utf8');

// 生成CSV
let csv = 'ID,商品代码,类目名称,层级,父级ID,是否有子类,是否授权,是否有SPU\n';
flatCategories.forEach(cat => {
    csv += `${cat.id},${cat.categoryCode},"${cat.name}",${cat.level},${cat.parentId || ''},${cat.hasChildren},${cat.authed},${cat.hasSpu}\n`;
});
fs.writeFileSync('政采云真实类目_扁平化.csv', csv, 'utf8');

// 生成树形结构（保持原始层级）
fs.writeFileSync('政采云真实类目_树形.json', JSON.stringify({
    meta: output.meta,
    categories: fullData.categories
}, null, 2), 'utf8');

// 生成易读的TXT
let txt = '政采云真实类目列表（官方数据）\n';
txt += '='.repeat(80) + '\n\n';

fullData.categories.forEach((cat, idx) => {
    txt += `【一级 ${idx + 1}】${cat.name} (ID:${cat.id})\n`;

    if (cat.children) {
        cat.children.forEach((child2, idx2) => {
            txt += `  ├─【二级 ${idx2 + 1}】${child2.name} (ID:${child2.id})\n`;

            if (child2.children) {
                child2.children.forEach((child3, idx3) => {
                    txt += `      └─【三级 ${idx3 + 1}】${child3.name} (ID:${child3.id})${child3.hasSpu ? ' ⭐有SPU' : ''}\n`;
                });
            }
        });
    }
    txt += '\n';
});

fs.writeFileSync('政采云真实类目_可读.txt', txt, 'utf8');

console.log('\n📁 生成文件:');
console.log('   ✅ 政采云真实类目_扁平化.json - 所有类目的数组，方便查询');
console.log('   ✅ 政采云真实类目_树形.json - 保持层级结构');
console.log('   ✅ 政采云真实类目_扁平化.csv - Excel可直接打开');
console.log('   ✅ 政采云真实类目_可读.txt - 人类可读格式');
console.log('\n💡 这些都是政采云的真实数据，可以直接使用！');
