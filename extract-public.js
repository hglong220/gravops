/**
 * 从政采云公开商品页提取类目数据
 * 无需登录，爬取公开的商品信息
 */

const https = require('https');
const fs = require('fs');

const categories = new Map();

// 政采云商城首页的类目导航（公开）
async function fetchPublicCategories() {
    return new Promise((resolve, reject) => {
        https.get('https://www.zcygov.cn/', (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                // 从HTML提取类目
                const categoryMatches = data.match(/categoryData\s*[=:]\s*(\[[\s\S]*?\])/);
                if (categoryMatches) {
                    try {
                        const cats = JSON.parse(categoryMatches[1]);
                        console.log('✅ 从首页提取到', cats.length, '个类目');
                        resolve(cats);
                    } catch (e) {
                        reject(e);
                    }
                } else {
                    reject(new Error('未找到类目数据'));
                }
            });
        }).on('error', reject);
    });
}

console.log('🔍 正在从政采云公开页面提取类目...');
console.log('💡 这不需要登录，数据来自公开商品页');

fetchPublicCategories()
    .then(cats => {
        console.log('📊 提取成功！');
        fs.writeFileSync('zcy_public_categories.json', JSON.stringify(cats, null, 2));
        console.log('💾 已保存到 zcy_public_categories.json');
    })
    .catch(err => {
        console.error('❌ 提取失败:', err.message);
        console.log('\n💡 建议：使用你现有的132个类目数据');
    });
