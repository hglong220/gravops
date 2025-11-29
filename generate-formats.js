const fs = require('fs');
const data = require('./政采云完整类目_30大类.json');

// 生成 CSV
let csv = 'ID,类目编码,类目名称,层级,父级ID\n';

data.categories.forEach(cat => {
    csv += `${cat.id},${cat.code},"${cat.name}",${cat.level},\n`;

    if (cat.children) {
        cat.children.forEach(child => {
            csv += `${child.id},,"${child.name}",${child.level},${child.parentId}\n`;
        });
    }
});

fs.writeFileSync('政采云完整类目_30大类.csv', csv, 'utf8');

// 生成 TXT
let txt = '政采云完整类目列表（30大类）\n';
txt += '=' *.repeat(80) + '\n\n';

data.categories.forEach((cat, index) => {
    txt += `【${index + 1}】${cat.name} (编码:${cat.code})\n`;

    if (cat.children) {
        cat.children.forEach((child, i) => {
            txt += `  ├─ ${i + 1}. ${child.name}\n`;
        });
    }
    txt += '\n';
});

fs.writeFileSync('政采云完整类目_30大类.txt', txt, 'utf8');

console.log('✅ 生成完成！');
console.log(`📊 一级类目数: ${data.categories.length}`);
console.log(`📊 二级类目数: ${data.categories.reduce((sum, c) => sum + (c.children ? c.children.length : 0), 0)}`);
console.log('📁 生成文件:');
console.log('   - 政采云完整类目_30大类.json');
console.log('   - 政采云完整类目_30大类.csv');
console.log('   - 政采云完整类目_30大类.txt');
