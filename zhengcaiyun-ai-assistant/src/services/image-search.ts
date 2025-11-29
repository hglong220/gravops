/**
 * 图片搜索服务
 * 从京东、淘宝等电商平台搜索商品图片
 */

export interface ProductImage {
    url: string;
    source: '京东' | '淘宝' | '天猫' | '百度';
    width: number;
    height: number;
    quality: 'high' | 'medium' | 'low';
}

/**
 * 搜索商品图片（优先级：京东 > 淘宝 > 天猫 > 百度）
 */
export async function searchProductImages(
    productName: string,
    limit: number = 5
): Promise<ProductImage[]> {
    const sources = [
        { name: '京东' as const, fn: searchJDImages },
        { name: '淘宝' as const, fn: searchTaobaoImages },
        { name: '天猫' as const, fn: searchTmallImages },
        { name: '百度' as const, fn: searchBaiduImages }
    ];

    for (const source of sources) {
        try {
            console.log(`[ImageSearch] 尝试从${source.name}搜索...`);
            const images = await source.fn(productName);

            if (images.length > 0) {
                console.log(`[ImageSearch] 从${source.name}找到${images.length}张图片`);
                return images.slice(0, limit);
            }
        } catch (error) {
            console.warn(`[ImageSearch] ${source.name}搜索失败:`, error);
            continue;
        }
    }

    console.warn('[ImageSearch] 所有来源都未找到图片');
    return [];
}

/**
 * 京东图片搜索（需要后端API支持）
 */
async function searchJDImages(productName: string): Promise<ProductImage[]> {
    try {
        // 调用后端API
        const response = await fetch('http://localhost:3000/api/search-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: productName,
                source: 'jd'
            })
        });

        if (!response.ok) {
            throw new Error('京东图片搜索失败');
        }

        const data = await response.json();
        return data.images || [];
    } catch (error) {
        console.error('[JD] 搜索失败:', error);
        // 如果后端API未实现，返回模拟数据用于测试
        return getMockImages('京东', productName);
    }
}

/**
 * 淘宝图片搜索
 */
async function searchTaobaoImages(productName: string): Promise<ProductImage[]> {
    try {
        const response = await fetch('http://localhost:3000/api/search-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: productName,
                source: 'taobao'
            })
        });

        if (!response.ok) {
            throw new Error('淘宝图片搜索失败');
        }

        const data = await response.json();
        return data.images || [];
    } catch (error) {
        console.error('[Taobao] 搜索失败:', error);
        return getMockImages('淘宝', productName);
    }
}

/**
 * 天猫图片搜索
 */
async function searchTmallImages(productName: string): Promise<ProductImage[]> {
    try {
        const response = await fetch('http://localhost:3000/api/search-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: productName,
                source: 'tmall'
            })
        });

        if (!response.ok) {
            throw new Error('天猫图片搜索失败');
        }

        const data = await response.json();
        return data.images || [];
    } catch (error) {
        console.error('[Tmall] 搜索失败:', error);
        return getMockImages('天猫', productName);
    }
}

/**
 * 百度图片搜索
 */
async function searchBaiduImages(productName: string): Promise<ProductImage[]> {
    try {
        const response = await fetch('http://localhost:3000/api/search-images', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                keyword: productName,
                source: 'baidu'
            })
        });

        if (!response.ok) {
            throw new Error('百度图片搜索失败');
        }

        const data = await response.json();
        return data.images || [];
    } catch (error) {
        console.error('[Baidu] 搜索失败:', error);
        return getMockImages('百度', productName);
    }
}

/**
 * 获取模拟数据（用于测试）
 */
function getMockImages(source: '京东' | '淘宝' | '天猫' | '百度', productName: string): ProductImage[] {
    console.log(`[Mock] 返回${source}的模拟图片数据`);

    // 这里返回占位图片，实际项目中应该调用真实API
    return [
        {
            url: `https://via.placeholder.com/800x800.png?text=${encodeURIComponent(productName)}+${source}`,
            source,
            width: 800,
            height: 800,
            quality: 'high'
        }
    ];
}

/**
 * 图片质量评估
 */
export function evaluateImageQuality(image: ProductImage): ProductImage {
    let quality: 'high' | 'medium' | 'low' = 'low';

    // 分辨率评分
    const pixelCount = image.width * image.height;
    if (pixelCount >= 800 * 800) {
        quality = 'high';
    } else if (pixelCount >= 400 * 400) {
        quality = 'medium';
    }

    return { ...image, quality };
}

/**
 * 过滤和排序图片
 */
export function filterAndSortImages(images: ProductImage[]): ProductImage[] {
    return images
        .map(evaluateImageQuality)
        .filter(img => img.quality !== 'low')
        .sort((a, b) => {
            // 优先级：high > medium，然后按分辨率排序
            const qualityScore = { high: 3, medium: 2, low: 1 };
            const scoreA = qualityScore[a.quality] * 1000000 + (a.width * a.height);
            const scoreB = qualityScore[b.quality] * 1000000 + (b.width * b.height);
            return scoreB - scoreA;
        });
}
