/**
 * AI 指令生成服务
 * 
 * 调用 DeepSeek API，让 AI 根据商品信息生成 RPA 操作指令序列
 */

import { RpaCommand, RpaCommandType, COMMAND_DESCRIPTIONS, EXAMPLE_COMMAND_SEQUENCE } from './rpa-protocol';

// DeepSeek API 配置
const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';

// 构建 AI Prompt
function buildPrompt(
    productTitle: string,
    categoryPath: string[],
    brand: string | null,
    model: string | null
): string {
    const commandList = Object.entries(COMMAND_DESCRIPTIONS)
        .map(([type, desc]) => `- ${type}: ${desc}`)
        .join('\n');

    const exampleJson = JSON.stringify(EXAMPLE_COMMAND_SEQUENCE.slice(0, 8), null, 2);

    return `你是一个政采云自动上架系统的 RPA 控制器。

## 任务
根据以下商品信息，生成 RPA 操作指令序列。

## 商品信息
- 标题: ${productTitle}
- 类目路径: ${categoryPath.join(' > ')}
- 品牌: ${brand || '未知'}
- 型号: ${model || '未知'}

## 可用指令类型
${commandList}

## 操作流程说明
1. 首先点击"修改"按钮打开电子卖场弹窗
2. 在弹窗中点击"网上超市"前的"+"展开标项列表
3. 选择一级类目（标项），例如"${categoryPath[0]}"
4. 点击"确定"关闭弹窗
5. 在页面的类目选择区域，依次点击二级、三级类目
6. 如果有品牌，先输入品牌再从下拉列表选择
7. 如果有型号，先输入型号再从下拉列表选择
8. 最后点击"下一步"

## 输出格式
直接输出 JSON 数组，不要有其他文字。每个元素包含：
- type: 指令类型（必填）
- value: 指令参数（可选，SELECT_BID/SELECT_CATEGORY/INPUT_BRAND/SELECT_BRAND/INPUT_MODEL/SELECT_MODEL 需要）
- waitMs: 等待时间（可选，WAIT 指令需要）

## 示例输出
${exampleJson}

## 注意
1. 类目路径第一个是标项（用 SELECT_BID），后面的用 SELECT_CATEGORY
2. 每个重要操作后加 WAIT 指令等待页面响应
3. 如果品牌或型号是"未知"，就跳过相关指令
4. 输出纯 JSON，不要任何解释文字

现在请生成指令序列：`;
}

// 调用 AI 生成指令
export async function generateCommandsWithAI(
    productTitle: string,
    categoryPath: string[],
    brand: string | null,
    model: string | null
): Promise<RpaCommand[]> {

    const apiKey = process.env.DEEPSEEK_API_KEY;
    console.log('[AI指令] API Key 状态:', apiKey ? `已配置 (${apiKey.substring(0, 8)}...)` : '未配置');

    if (!apiKey) {
        console.log('[AI指令] ⚠️ 无 API Key，使用模板生成');
        return generateCommandsFromTemplate(categoryPath, brand, model);
    }

    const prompt = buildPrompt(productTitle, categoryPath, brand, model);

    try {
        console.log('[AI指令] 调用 DeepSeek API...');

        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,  // 低温度，输出更确定
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status}`);
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        console.log('[AI指令] AI 原始输出:', content.substring(0, 200));

        // 解析 JSON
        const commands = parseAIResponse(content);

        console.log(`[AI指令] 解析出 ${commands.length} 个指令`);
        return commands;

    } catch (error) {
        console.error('[AI指令] AI 调用失败:', error);
        console.log('[AI指令] 降级使用模板生成');
        return generateCommandsFromTemplate(categoryPath, brand, model);
    }
}

// 解析 AI 返回的 JSON
function parseAIResponse(content: string): RpaCommand[] {
    // 尝试提取 JSON 数组
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
        throw new Error('未找到 JSON 数组');
    }

    const commands = JSON.parse(jsonMatch[0]) as RpaCommand[];

    // 验证指令类型
    const validTypes: RpaCommandType[] = [
        'OPEN_DIALOG', 'EXPAND_MARKET', 'SELECT_BID', 'CONFIRM_DIALOG',
        'SELECT_CATEGORY', 'INPUT_BRAND', 'SELECT_BRAND',
        'INPUT_MODEL', 'SELECT_MODEL', 'CLICK_NEXT', 'WAIT'
    ];

    // ⭐ 过滤并补充缺失的 value
    return commands
        .filter(cmd => validTypes.includes(cmd.type))
        .map(cmd => {
            // 确保 EXPAND_MARKET 有默认值
            if (cmd.type === 'EXPAND_MARKET' && !cmd.value) {
                return { ...cmd, value: '网上超市' };
            }
            return cmd;
        });
}

// 模板生成（备用）
function generateCommandsFromTemplate(
    categoryPath: string[],
    brand: string | null,
    model: string | null
): RpaCommand[] {
    const commands: RpaCommand[] = [];

    // 1. 打开弹窗
    commands.push({ type: 'OPEN_DIALOG' });
    commands.push({ type: 'WAIT', waitMs: 2000 });

    // 2. 展开网上超市（必须提供 value）
    commands.push({ type: 'EXPAND_MARKET', value: '网上超市' });
    commands.push({ type: 'WAIT', waitMs: 2000 });

    // 3. 选择标项（一级类目）
    if (categoryPath.length > 0) {
        commands.push({ type: 'SELECT_BID', value: categoryPath[0] });
    }

    // 4. 确认弹窗
    commands.push({ type: 'CONFIRM_DIALOG' });
    commands.push({ type: 'WAIT', waitMs: 3000 });

    // 5. 选择二级、三级类目
    for (let i = 1; i < categoryPath.length; i++) {
        commands.push({ type: 'SELECT_CATEGORY', value: categoryPath[i] });
        commands.push({ type: 'WAIT', waitMs: 1500 });
    }

    // 6. 品牌
    if (brand) {
        commands.push({ type: 'INPUT_BRAND', value: brand });
        commands.push({ type: 'WAIT', waitMs: 500 });
        commands.push({ type: 'SELECT_BRAND', value: brand });
        commands.push({ type: 'WAIT', waitMs: 1000 });
    }

    // 7. 型号
    if (model) {
        commands.push({ type: 'INPUT_MODEL', value: model });
        commands.push({ type: 'WAIT', waitMs: 500 });
        commands.push({ type: 'SELECT_MODEL', value: model });
        commands.push({ type: 'WAIT', waitMs: 1000 });
    }

    // 8. 下一步
    commands.push({ type: 'CLICK_NEXT' });

    return commands;
}

export { generateCommandsFromTemplate };
