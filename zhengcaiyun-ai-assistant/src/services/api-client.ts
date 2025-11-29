/**
 * 后端 API 客户端
 * 负责与 Next.js 后端服务通信
 */

const API_BASE_URL = 'http://localhost:3000';

interface AIAnalysisResult {
    category: string;
    riskLevel: 'low' | 'medium' | 'high';
    reasoning: string;
    suggestedAction: 'direct_upload' | 'trojan_strategy' | 'manual_review';
    safeName?: string;
}

interface ImageResult {
    url: string;
    title: string;
    source: 'jd' | 'tmall';
}

/**
 * 调用 AI 分析商品
 */
export async function analyzeProduct(
    productName: string,
    licenseKey: string,
    description?: string
): Promise<AIAnalysisResult> {
    const response = await fetch(`${API_BASE_URL}/api/ai/analyze`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            productName,
            description,
            licenseKey,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI 分析失败');
    }

    return response.json();
}

/**
 * 搜索商品图片
 */
export async function searchProductImages(
    keyword: string,
    licenseKey: string
): Promise<ImageResult[]> {
    const url = new URL(`${API_BASE_URL}/api/search-images`);
    url.searchParams.set('keyword', keyword);
    url.searchParams.set('licenseKey', licenseKey);

    const response = await fetch(url.toString());

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '图片搜索失败');
    }

    const data = await response.json();
    return data.images;
}

/**
 * 视觉分析（截图）
 */
export async function visualAnalyze(imageBase64: string, licenseKey: string): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/api/ai/visual-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, licenseKey })
    });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '视觉分析失败');
    }
    return response.json();
}


/**
 * 验证 License
 */
export async function verifyLicense(
    licenseKey: string,
    companyName: string
): Promise<{
    valid: boolean;
    companyName?: string;
    expiresAt?: number;
    plan?: string;
}> {
    const response = await fetch(`${API_BASE_URL}/api/verify-license`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            licenseKey,
            companyName,
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        return {
            valid: false,
        };
    }

    return response.json();
}

/**
 * 记录使用情况（可选，用于统计）
 */
export async function logUsage(
    licenseKey: string,
    action: string,
    metadata?: Record<string, any>
): Promise<void> {
    try {
        await fetch(`${API_BASE_URL}/api/usage/log`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                licenseKey,
                action,
                metadata,
                timestamp: Date.now(),
            }),
        });
    } catch (error) {
        console.warn('[API] 日志记录失败:', error);
        // 静默失败，不影响主流程
    }
}
