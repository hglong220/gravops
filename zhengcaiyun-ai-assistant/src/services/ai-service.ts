import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

// 初始化OpenAI客户端
export function initOpenAI(apiKey: string) {
    openaiClient = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true // Chrome插件环境需要
    });
}

// 获取OpenAI客户端
function getClient(): OpenAI {
    if (!openaiClient) {
        throw new Error('OpenAI客户端未初始化，请先设置API Key');
    }
    return openaiClient;
}

/**
 * AI分析页面截图，识别商品类目
 */
export async function analyzeCategory(
    screenshot: string,
    productName: string,
    availableCategories?: string[]
): Promise<{ category: string; confidence: number; reason: string }> {
    const client = getClient();

    const prompt = availableCategories
        ? `请分析这个商品应该属于哪个类目。

商品名称：${productName}
可选类目：${availableCategories.join(', ')}

请返回JSON格式：
{
  "category": "选择的类目名称",
  "confidence": 0.95,
  "reason": "选择理由"
}`
        : `请分析这个商品应该属于什么类目。

商品名称：${productName}

请返回JSON格式：
{
  "category": "类目名称",
  "confidence": 0.95,
  "reason": "选择理由"
}`;

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: prompt },
                        {
                            type: 'image_url',
                            image_url: { url: screenshot }
                        }
                    ]
                }
            ],
            max_tokens: 300
        });

        const content = response.choices[0]?.message?.content || '{}';
        const result = JSON.parse(content);

        console.log('[AI] 类目识别结果:', result);
        return result;
    } catch (error) {
        console.error('[AI] 类目识别失败:', error);
        throw error;
    }
}

/**
 * AI识别验证码
 */
export async function solveCaptcha(captchaImage: string): Promise<string> {
    const client = getClient();

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '请识别图片中的验证码文字，只返回识别结果，不要其他内容'
                        },
                        {
                            type: 'image_url',
                            image_url: { url: captchaImage }
                        }
                    ]
                }
            ],
            max_tokens: 50
        });

        const result = response.choices[0]?.message?.content?.trim() || '';
        console.log('[AI] 验证码识别结果:', result);
        return result;
    } catch (error) {
        console.error('[AI] 验证码识别失败:', error);
        throw error;
    }
}

/**
 * 截取页面指定区域
 */
export async function captureScreenshot(
    selector?: string
): Promise<string> {
    try {
        // 获取当前活动标签页
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        if (!tab.id) {
            throw new Error('无法获取当前标签页');
        }

        // 截取整个可见区域
        const screenshot = await chrome.tabs.captureVisibleTab(undefined, {
            format: 'png'
        });

        return screenshot;
    } catch (error) {
        console.error('[Screenshot] 截图失败:', error);
        throw error;
    }
}

/**
 * AI判断审核状态
 */
export async function analyzeApprovalStatus(screenshot: string): Promise<'approved' | 'rejected' | 'pending'> {
    const client = getClient();

    try {
        const response = await client.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: '这是政采云商品详情页的截图，请判断审核状态。只返回以下之一：approved（已通过）、rejected（已拒绝）、pending（审核中）'
                        },
                        {
                            type: 'image_url',
                            image_url: { url: screenshot }
                        }
                    ]
                }
            ],
            max_tokens: 20
        });

        const result = response.choices[0]?.message?.content?.trim().toLowerCase() || 'pending';

        if (['approved', 'rejected', 'pending'].includes(result)) {
            return result as 'approved' | 'rejected' | 'pending';
        }

        return 'pending';
    } catch (error) {
        console.error('[AI] 审核状态识别失败:', error);
        return 'pending';
    }
}
