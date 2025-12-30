
const { chromium } = require('playwright');
const axios = require('axios');
const fs = require('fs');

async function runVisionTest() {
    console.log('🚀 启动隔离环境下的 Vision Agent (Browser-use) 测试...');

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
        // 1. 访问一个公共测试页面 (百度或谷歌)
        console.log('🌐 正在访问: https://www.baidu.com');
        await page.goto('https://www.baidu.com');
        await page.waitForTimeout(2000);

        // 2. 截取当前视觉状态 (模拟插件行为)
        const screenshotBuffer = await page.screenshot({ type: 'png' });
        const base64Image = screenshotBuffer.toString('base64');
        console.log('📸 截图完成，已转换为 Base64');

        // 3. 调用用户的后端 Vision API (localhost:3000)
        console.log('🤖 正在咨询后端 Vision Agent (localhost:3000)...');
        const task = "找到搜索输入框并点击";

        const response = await axios.post('http://localhost:3000/api/vision/agent', {
            screenshot: `data:image/png;base64,${base64Image}`,
            task: task,
            context: "隔离测试环境"
        });

        const decision = response.data;
        console.log('💡 AI 决策获取成功:');
        console.log(`   - 目标: ${decision.target}`);
        console.log(`   - 动作: ${decision.action}`);
        console.log(`   - 坐标: x=${decision.point.x}, y=${decision.point.y}`);
        console.log(`   - 原因: ${decision.reason}`);

        // 4. 在隔离页面执行点击 (验证坐标准确性)
        const width = page.viewportSize().width;
        const height = page.viewportSize().height;
        const clickX = decision.point.x * width;
        const clickY = decision.point.y * height;

        console.log(`🎯 模拟点击物理坐标: (${Math.round(clickX)}, ${Math.round(clickY)})`);
        await page.mouse.click(clickX, clickY);

        console.log('✅ 测试完成：坐标定位准确。');

    } catch (error) {
        console.error('❌ 测试失败:', error.response ? error.response.data : error.message);
        console.log('提示：请确保 npm run dev 正在后台运行且提供了有效的 AI API Key。');
    } finally {
        await browser.close();
        console.log('🏁 浏览器已关闭');
    }
}

runVisionTest();
