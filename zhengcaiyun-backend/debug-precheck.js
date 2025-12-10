const fs = require('fs');
const path = require('path');

// 加载类目树
const filePath = path.join(process.cwd(), 'public', 'api', '政采云完整类目.json');
const categoryTree = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const allowedCategories = ['五金/工具', '办公设备'];
const productTitle = '电动螺丝刀充电式电钻工具';
const title = productTitle.toLowerCase();

console.log('测试预检逻辑:');
console.log('商品标题:', productTitle);
console.log('允许类目:', allowedCategories);
console.log('');

for (const level1Name of allowedCategories) {
    const level1Cat = categoryTree.categories.find(c => c.name === level1Name);
    console.log(`查找类目 "${level1Name}":`, level1Cat ? '找到' : '未找到');

    if (level1Cat) {
        // 检查一级类目名是否在标题中
        console.log(`  检查标题是否包含 "${level1Name.toLowerCase()}":`, title.includes(level1Name.toLowerCase()));

        // 检查模糊匹配
        const parts = level1Name.split(/[\/\s]/);
        console.log('  分割后:', parts);
        for (const part of parts) {
            if (part.length >= 2) {
                console.log(`  检查标题是否包含 "${part.toLowerCase()}":`, title.includes(part.toLowerCase()));
            }
        }

        // 检查二级类目
        if (level1Cat.children) {
            console.log('  二级类目数量:', level1Cat.children.length);
            for (const level2Cat of level1Cat.children.slice(0, 5)) {
                console.log(`    - ${level2Cat.name}:`, title.includes(level2Cat.name.toLowerCase()));
            }
        }
    }
}
