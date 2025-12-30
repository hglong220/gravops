const { AIService } = require('./lib/ai-service');

async function test() {
    console.log("正在测试 AI 服务连接...");
    try {
        const result = await AIService.analyzeFormSection("你好，请返回一个 JSON 对象 { 'status': 'ok' }。不要包含任何其他文字。");
        console.log("AI 响应成功:");
        console.log(JSON.stringify(result, null, 2));
    } catch (e) {
        console.error("AI 响应失败:");
        console.error(e);
    }
}

test();
