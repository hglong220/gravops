/**
 * 政采云类目数据整合方案
 * 
 * 策略：
 * 1. 一级类目：显示全部30类（基于政府采购目录）
 * 2. 二三四级：只显示有权限的类目（基于实际数据）
 * 3. 前端提示用户哪些类目可用
 */

const fs = require('fs');

// 你有权限的真实数据
const realData = require('./zcy_categories_full.json');

// 政府采购目录的30大类（一级类目）
const officialLevel1Categories = [
    { id: '10', name: '机电设备', hasAuth: false },
    { id: '11', name: '教学科研', hasAuth: false },
    { id: '4407', name: '安全防护', hasAuth: false },
    { id: '2136', name: '橡胶及塑料制品', hasAuth: true }, // ✅ 你有权限
    { id: '4454', name: '图书档案设备', hasAuth: false },
    { id: '4453', name: '图书和档案', hasAuth: false },
    { id: '3587', name: '仪器仪表', hasAuth: false },
    { id: '8', name: '专用设备', hasAuth: false },
    { id: '4400', name: '3C数码', hasAuth: false },
    { id: '4401', name: '办公设备/耗材', hasAuth: false },
    { id: '4402', name: '文化用品', hasAuth: true }, // ✅ 你有权限
    { id: '4403', name: '家居建材', hasAuth: false },
    { id: '4404', name: '家用电器', hasAuth: false },
    { id: '4405', name: '日用百货', hasAuth: false },
    { id: '4406', name: '食品酒水', hasAuth: false },
    { id: '4407', name: '劳动保护用品', hasAuth: false },
    { id: '4408', name: '运动户外', hasAuth: false },
    { id: '4409', name: '五金/工具', hasAuth: false },
    { id: '4410', name: '文化玩乐', hasAuth: true }, // ✅ 你有权限
    { id: '4411', name: '教育装备', hasAuth: false },
    { id: '4412', name: '鲜花绿植', hasAuth: false },
    { id: '3564', name: '信息技术', hasAuth: false },
    { id: '4413', name: '体育用品及器材', hasAuth: false },
    { id: '4414', name: '体育相关用品和设备', hasAuth: false },
    { id: '4415', name: '科研仪器', hasAuth: false },
    { id: '4416', name: '防护用品', hasAuth: false },
    { id: '2631', name: '医疗器械', hasAuth: false },
    { id: '1868', name: '电工电气', hasAuth: false },
    { id: '2551', name: '建筑建材', hasAuth: false },
    { id: '1832', name: '车辆', hasAuth: false }
];

// 构建完整的类目树
const mergedCategories = officialLevel1Categories.map(level1 => {
    // 查找你有权限的真实数据
    const realCategory = realData.categories.find(c => c.id.toString() === level1.id.toString());

    if (realCategory && level1.hasAuth) {
        // 有权限：使用真实的完整数据
        return {
            ...realCategory,
            hasAuth: true,
            categoryCode: realCategory.code || realCategory.id.toString()
        };
    } else {
        // 无权限：只显示一级，提示用户
        return {
            id: level1.id,
            categoryCode: level1.id,
            name: level1.name,
            level: 1,
            hasAuth: false,
            locked: true,
            tip: '该类目需要额外授权，请联系政采云客服开通权限'
        };
    }
});

// 统计信息
const authCount = mergedCategories.filter(c => c.hasAuth).length;
const lockedCount = mergedCategories.filter(c => c.locked).length;

console.log('✅ 类目整合完成！');
console.log(`📊 共整合 ${mergedCategories.length} 个一级类目`);
console.log(`✅ 已授权可用: ${authCount} 个`);
console.log(`🔒 需要授权: ${lockedCount} 个`);

// 生成最终数据
const output = {
    meta: {
        source: '政采云官方数据 + 政府采购目录',
        version: '2025-11-29',
        description: '包含30个一级类目，其中' + authCount + '个可用，' + lockedCount + '个需要授权',
        authCategories: mergedCategories.filter(c => c.hasAuth).map(c => c.name),
        totalCategories计算未完成
    },
    categories: mergedCategories
};

// 保存文件
fs.writeFileSync('政采云类目_完整版_带权限标识.json', JSON.stringify(output, null, 2), 'utf8');

// 生成前端可用的格式
const frontendData = {
    // 所有类目
    all: mergedCategories,

    // 只有可用的类目（完整数据）
    available: mergedCategories.filter(c => c.hasAuth),

    // 不可用的类目（只有名称）
    locked: mergedCategories.filter(c => c.locked).map(c => ({
        id: c.id,
        name: c.name,
        tip: c.tip
    }))
};

fs.writeFileSync('政采云类目_前端专用.json', JSON.stringify(frontendData, null, 2), 'utf8');

console.log('\n📁 生成文件:');
console.log('   ✅ 政采云类目_完整版_带权限标识.json - 完整数据');
console.log('   ✅ 政采云类目_前端专用.json - 前端直接调用');

console.log('\n💡 使用建议:');
console.log('   - 显示全部30类给用户看');
console.log('   - 有权限的' + authCount + '类可以展开和选择');
console.log('   - 无权限的显示为灰色+提示');
console.log('   - 用户点击无权限类目时，提示"请联系客服开通"');
