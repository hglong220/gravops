/**
 * 政采云用户类目权限提取器
 * 在政采云发布页面提取用户的一级类目权限
 */

// 提取用户的一级类目权限
export async function extractUserCategoryPermissions(): Promise<{
    success: boolean;
    market?: string;
    level1Categories?: string[];
    error?: string;
}> {
    try {
        console.log('[类目权限] 开始提取用户一级类目...');

        // 等待页面加载
        await new Promise(resolve => setTimeout(resolve, 1000));

        // 尝试从页面提取一级类目
        // 方法1: 从类目选择弹窗提取
        const categories = await extractFromCategoryModal();

        if (categories.length > 0) {
            // 尝试获取当前卖场名称
            const market = extractMarketName();

            console.log(`[类目权限] 提取成功: 卖场=${market}, 类目数=${categories.length}`);
            console.log('[类目权限] 一级类目列表:', categories);

            return {
                success: true,
                market,
                level1Categories: categories
            };
        }

        return {
            success: false,
            error: '未能提取到类目数据，请确保已打开类目选择弹窗'
        };

    } catch (error) {
        console.error('[类目权限] 提取失败:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
        };
    }
}

// 从类目选择弹窗提取一级类目
async function extractFromCategoryModal(): Promise<string[]> {
    const categories: string[] = [];

    // 可能的选择器列表
    const selectors = [
        // 弹窗中的一级类目列表
        '.category-list .category-item',
        '.cate-list .cate-item',
        '.level1-list li',
        '.category-tree > ul > li',
        // 左侧菜单中的类目
        '.category-menu .menu-item',
        '.category-nav li',
        // 通用选择器
        '[data-level="1"]',
        '.level-1'
    ];

    for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
            elements.forEach(el => {
                const text = (el.textContent || '').trim();
                // 过滤掉空白和太长的文本（可能是整个容器的文本）
                if (text && text.length > 0 && text.length < 50 && !categories.includes(text)) {
                    categories.push(text);
                }
            });

            if (categories.length > 0) {
                console.log(`[类目权限] 使用选择器 "${selector}" 提取到 ${categories.length} 个类目`);
                return categories;
            }
        }
    }

    // 尝试从API拦截数据
    // 如果页面已经加载过类目数据，可能存储在window对象中
    const windowKeys = Object.keys(window).filter(key =>
        key.toLowerCase().includes('category') ||
        key.toLowerCase().includes('cate')
    );

    for (const key of windowKeys) {
        try {
            const value = (window as any)[key];
            if (Array.isArray(value)) {
                value.forEach((item: any) => {
                    if (item && item.name && typeof item.name === 'string') {
                        categories.push(item.name);
                    }
                });
            }
        } catch (e) {
            // 忽略访问错误
        }
    }

    return categories;
}

// 提取当前卖场名称
function extractMarketName(): string {
    // 尝试从页面提取卖场名称
    const selectors = [
        '.market-name',
        '.store-name',
        '.shop-name',
        '[data-market]',
        '.breadcrumb .market'
    ];

    for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el) {
            const text = (el.textContent || '').trim();
            if (text) return text;
        }
    }

    // 从URL判断
    const url = window.location.href;
    if (url.includes('qinghai') || url.includes('青海')) return '青海网超';
    if (url.includes('zhejiang') || url.includes('浙江')) return '浙江政采云';
    if (url.includes('anhui') || url.includes('安徽')) return '安徽政采云';

    // 默认
    return '政采云';
}

// 保存类目权限到服务器
export async function saveCategoryPermissions(
    apiUrl: string,
    licenseKey: string,
    market: string,
    level1Categories: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        const response = await fetch(`${apiUrl}/api/category-permissions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                licenseKey,
                market,
                level1Categories
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return { success: false, error: result.error || '保存失败' };
        }

        console.log('[类目权限] 保存成功:', result);
        return { success: true };

    } catch (error) {
        console.error('[类目权限] 保存失败:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : '网络错误'
        };
    }
}

// 一键提取并保存
export async function extractAndSavePermissions(
    apiUrl: string,
    licenseKey: string
): Promise<{ success: boolean; message: string; categories?: string[] }> {
    // 提取
    const extractResult = await extractUserCategoryPermissions();

    if (!extractResult.success || !extractResult.level1Categories) {
        return {
            success: false,
            message: extractResult.error || '提取失败'
        };
    }

    // 保存
    const saveResult = await saveCategoryPermissions(
        apiUrl,
        licenseKey,
        extractResult.market || '政采云',
        extractResult.level1Categories
    );

    if (!saveResult.success) {
        return {
            success: false,
            message: saveResult.error || '保存失败'
        };
    }

    return {
        success: true,
        message: `成功提取并保存${extractResult.level1Categories.length}个一级类目权限`,
        categories: extractResult.level1Categories
    };
}
