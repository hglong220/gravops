const fs = require('fs');
const path = require('path');

function checkCategories() {
    const categoryFile = path.join('g:', 'gravops', 'zcy_categories_final.json');

    console.log('📚 检查类目库...\n');

    if (!fs.existsSync(categoryFile)) {
        console.log('❌ 未找到类目文件:', categoryFile);
        return;
    }

    const rawData = fs.readFileSync(categoryFile, 'utf-8');
    const parsed = JSON.parse(rawData);

    // 判断数据格式
    let data;
    if (Array.isArray(parsed)) {
        data = parsed;
    } else if (parsed.data && Array.isArray(parsed.data)) {
        data = parsed.data;
    } else if (typeof parsed === 'object') {
        // 可能是 key-value 格式
        data = Object.values(parsed);
    } else {
        console.log('❌ 无法识别的数据格式');
        console.log('数据类型:', typeof parsed);
        console.log('前100字符:', JSON.stringify(parsed).substring(0, 100));
        return;
    }

    console.log('📊 类目统计:');
    console.log('  总类目数:', data.length);
    console.log('  数据格式:', Array.isArray(data) ? '数组' : 'key-value对象');

    // 查看前3个类目
    console.log('\n📋 前3个类目示例:');
    data.slice(0, 3).forEach((cat, i) => {
        console.log(`${i + 1}.`, JSON.stringify(cat));
    });

    // 查找包含"办公"的类目
    console.log('\n🔍 搜索"办公"相关类目:');
    const officeCategories = data.filter(cat =>
        (cat.name && cat.name.includes('办公')) ||
        (cat.label && cat.label.includes('办公')) ||
        (typeof cat === 'string' && cat.includes('办公'))
    );

    console.log(`  找到 ${officeCategories.length} 个含"办公"的类目`);
    officeCategories.slice(0, 5).forEach(cat => {
        if (typeof cat === 'object') {
            console.log(`  - ${cat.name || cat.label || JSON.stringify(cat)}`);
        } else {
            console.log(`  - ${cat}`);
        }
    });

    // 查找包含"家具"的类目
    console.log('\n🪑 搜索"家具"相关类目:');
    const furnitureCategories = data.filter(cat =>
        (cat.name && cat.name.includes('家具')) ||
        (cat.label && cat.label.includes('家具')) ||
        (typeof cat === 'string' && cat.includes('家具'))
    );

    console.log(`  找到 ${furnitureCategories.length} 个含"家具"的类目`);
    furnitureCategories.slice(0, 5).forEach(cat => {
        if (typeof cat === 'object') {
            console.log(`  - ${cat.name || cat.label || JSON.stringify(cat)}`);
        } else {
            console.log(`  - ${cat}`);
        }
    });
}

try {
    checkCategories();
} catch (error) {
    console.error('❌ 错误:', error.message);
    console.error(error.stack);
}
