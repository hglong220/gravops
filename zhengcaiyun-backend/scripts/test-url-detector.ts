/**
 * URL检测工具测试
 * 使用方法: npx tsx scripts/test-url-detector.ts
 */

import { detectPlatform, isValidProductUrl, normalizeUrl } from '../lib/url-detector';

function testUrlDetector() {
    console.log('=== URL检测工具测试 ===\n');

    const testCases = [
        'https://item.jd.com/100012043978.html',
        'https://detail.tmall.com/item.htm?id=123456789',
        'https://item.taobao.com/item.htm?id=987654321',
        'https://product.suning.com/0000000000/12345678.html',
        'https://www.zcygov.cn/product/123456',
        'https://www.baidu.com', // 无效
        'not-a-url', // 无效
    ];

    console.log('📝 测试用例共 ' + testCases.length + ' 个\n');

    testCases.forEach((url, index) => {
        console.log(`测试 ${index + 1}: ${url}`);

        const platform = detectPlatform(url);
        const isValid = isValidProductUrl(url);
        const normalized = normalizeUrl(url);

        console.log(`  平台: ${platform}`);
        console.log(`  有效: ${isValid ? '✅' : '❌'}`);
        if (normalized !== url) {
            console.log(`  规范化: ${normalized}`);
        }
        console.log();
    });

    console.log('✨ URL检测测试完成!');
}

// 运行测试
testUrlDetector();
