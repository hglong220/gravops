const fs = require('fs');
const path = require('path');

// 加载类目树
const filePath = path.join(process.cwd(), 'public', 'api', '政采云完整类目.json');
const categoryTree = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

const allowedCategories = ['五金/工具', '办公设备'];
const productTitle = '电动螺丝刀充电式电钻工具';
const title = productTitle.toLowerCase();

console.log('模拟 preCheck 函数:');
console.log('商品标题:', productTitle);
console.log('标题小写:', title);
console.log('');

for (const level1Name of allowedCategories) {
    const level1Cat = categoryTree.categories.find(c => c.name === level1Name);
    console.log(`\n--- 检查类目: "${level1Name}" ---`);

    if (level1Cat && level1Cat.children) {
        for (const level2Cat of level1Cat.children) {
            const level2NameLower = level2Cat.name.toLowerCase();
            const includes = title.includes(level2NameLower);
            if (includes) {
                console.log(`✓ 匹配成功! "${level2Cat.name}" (${level2NameLower}) 在标题中`);
                console.log(`  应该返回: { isLikelyMatch: true, suggestedCategory: "${level1Name}" }`);
                process.exit(0);
            }
        }
    }
}

console.log('未找到匹配');
