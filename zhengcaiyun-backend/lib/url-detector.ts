/**
 * URL平台检测工具
 * 根据URL识别是哪个电商平台
 */

export type Platform = 'jd' | 'tmall' | 'taobao' | 'suning' | 'zcy' | 'unknown';

export function detectPlatform(url: string): Platform {
    const urlLower = url.toLowerCase();

    if (urlLower.includes('jd.com') || urlLower.includes('jd.hk')) {
        return 'jd';
    }

    if (urlLower.includes('tmall.com') || urlLower.includes('tmall.hk')) {
        return 'tmall';
    }

    if (urlLower.includes('taobao.com')) {
        return 'taobao';
    }

    if (urlLower.includes('suning.com') || urlLower.includes('suning.cn')) {
        return 'suning';
    }

    if (urlLower.includes('zcygov.cn')) {
        return 'zcy';
    }

    return 'unknown';
}

/**
 * 验证URL格式是否有效
 */
export function isValidProductUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        const platform = detectPlatform(url);

        if (platform === 'unknown') {
            return false;
        }

        // 基本验证:确保是HTTPS
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            return false;
        }

        // 不同平台的URL模式验证
        switch (platform) {
            case 'jd':
                return /item\.jd\.com\/\d+\.html/.test(url);
            case 'tmall':
                return /detail\.tmall\.com\/item\.htm/.test(url);
            case 'taobao':
                return /item\.taobao\.com\/item\.htm/.test(url);
            case 'suning':
                return /product\.suning\.com/.test(url);
            case 'zcy':
                return /zcygov\.cn\//.test(url);
            default:
                return false;
        }
    } catch (error) {
        return false;
    }
}

/**
 * 规范化URL(移除追踪参数等)
 */
export function normalizeUrl(url: string): string {
    try {
        const parsedUrl = new URL(url);
        const platform = detectPlatform(url);

        // 保留必要参数,移除追踪参数
        const paramsToKeep = ['id', 'skuId', 'itemId'];
        const newSearchParams = new URLSearchParams();

        paramsToKeep.forEach(param => {
            const value = parsedUrl.searchParams.get(param);
            if (value) {
                newSearchParams.set(param, value);
            }
        });

        parsedUrl.search = newSearchParams.toString();
        parsedUrl.hash = ''; // 移除hash

        return parsedUrl.toString();
    } catch (error) {
        return url;
    }
}
