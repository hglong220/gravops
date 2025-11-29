/**
 * 测试批量处理器
 * 使用方法: npx tsx scripts/test-batch-processor.ts
 */

import { processPendingDrafts, processSingleDraft } from '../lib/batch-processor';
import { prisma } from '../lib/prisma';

async function testBatchProcessor() {
    console.log('=== 批量处理器测试 ===\n');

    // 方案1: 直接处理单个URL
    console.log('📝 方案1: 测试单个商品处理\n');

    const testUrl = 'https://item.jd.com/100012043978.html';

    try {
        // 先创建一个pending草稿
        console.log('1. 创建测试草稿...');
        const draft = await prisma.productDraft.create({
            data: {
                userId: 'test-user-id', // 替换为真实用户ID
                originalUrl: testUrl,
                title: '待采集测试商品',
                status: 'pending',
                shopName: 'JD Test'
            }
        });
        console.log(`   ✅ 草稿已创建: ${draft.id}\n`);

        // 处理这个草稿
        console.log('2. 开始处理草稿...');
        const startTime = Date.now();

        await processSingleDraft(draft.id, testUrl);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`   ✅ 处理完成，耗时: ${duration}秒\n`);

        // 验证结果
        console.log('3. 验证结果...');
        const updatedDraft = await prisma.productDraft.findUnique({
            where: { id: draft.id }
        });

        if (updatedDraft && updatedDraft.status === 'scraped') {
            console.log('   ✅ 状态已更新为 scraped');
            console.log(`   📦 标题: ${updatedDraft.title}`);
            console.log(`   🏪 店铺: ${updatedDraft.shopName}`);

            const images = JSON.parse(updatedDraft.images || '[]');
            console.log(`   🖼️  图片: ${images.length} 张`);
        } else {
            console.log('   ❌ 状态未正确更新');
        }

        console.log('\n✨ 单个商品处理测试完成!\n');

    } catch (error) {
        console.error('❌ 测试失败:', (error as Error).message);
        console.error('错误详情:', error);
        process.exit(1);
    }

    // 方案2: 批量处理pending草稿
    console.log('\n📝 方案2: 测试批量处理pending草稿\n');

    try {
        console.log('1. 查询pending草稿数量...');
        const pendingCount = await prisma.productDraft.count({
            where: { status: 'pending' }
        });
        console.log(`   找到 ${pendingCount} 个pending草稿\n`);

        if (pendingCount > 0) {
            console.log('2. 开始批量处理 (限制5个)...');
            await processPendingDrafts(5);
            console.log('   ✅ 批量处理完成\n');

            // 验证结果
            console.log('3. 验证结果...');
            const scrapedCount = await prisma.productDraft.count({
                where: { status: 'scraped' }
            });
            console.log(`   ✅ 已采集: ${scrapedCount} 个商品\n`);
        } else {
            console.log('   ⚠️  没有pending草稿，跳过批量处理\n');
        }

        console.log('✨ 批量处理测试完成!');

    } catch (error) {
        console.error('❌ 批量处理测试失败:', (error as Error).message);
        console.error('错误详情:', error);
    }
}

// 运行测试
testBatchProcessor().then(() => {
    console.log('\n程序退出');
    process.exit(0);
});
