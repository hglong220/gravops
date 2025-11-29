/**
 * 测试京东商品爬虫
 * 使用方法: npx tsx scripts/test-jd-scraper.ts
 */

import { scrapeJDProduct } from '../lib/scrapers/jd-product-scraper';

async function testJDScraper() {
    console.log('=== 京东商品爬虫测试 ===\n');

    // 测试URL - 换成普通商品(图书类,通常不需要登录)
    const testUrl = 'https://item.jd.com/13264970.html'; // 《活着》余华

    console.log(`测试URL: ${testUrl}\n`);

    try {
        console.log('开始爬取...');
        const startTime = Date.now();

        const productData = await scrapeJDProduct(testUrl);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n✅ 爬取成功!');
        console.log(`⏱️  耗时: ${duration}秒\n`);

        console.log('📦 商品信息:');
        console.log('----------------------------------------');
        console.log(`标题: ${productData.title}`);
        console.log(`价格: ¥${productData.skuData.price}`);
        console.log(`库存: ${productData.skuData.stock}`);
        console.log(`店铺: ${productData.shopName}`);
        console.log(`图片数量: ${productData.images.length}`);
        console.log(`详情长度: ${productData.detailHtml.length} 字符`);
        console.log(`参数数量: ${Object.keys(productData.attributes).length} 项`);
        console.log('----------------------------------------\n');

        // 显示前3张图片URL
        if (productData.images.length > 0) {
            console.log('🖼️  图片URL (前3张):');
            productData.images.slice(0, 3).forEach((img, idx) => {
                console.log(`  ${idx + 1}. ${img}`);
            });
            console.log();
        }

        // 显示部分商品参数
        if (Object.keys(productData.attributes).length > 0) {
            console.log('📋 商品参数 (前5项):');
            Object.entries(productData.attributes).slice(0, 5).forEach(([key, value]) => {
                console.log(`  ${key}: ${value}`);
            });
            console.log();
        }

        console.log('测试完成! ✨');

    } catch (error) {
        console.error('❌ 测试失败:', (error as Error).message);
        console.error('错误详情:', error);
        process.exit(1);
    }
}

// 运行测试
testJDScraper().then(() => {
    console.log('\n程序退出');
    process.exit(0);
});
