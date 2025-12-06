/**
 * E-commerce Main World Script
 * 运行在页面主世界(MAIN)，可以直接访问 window 全局变量
 * 
 * 负责从京东、天猫等电商页面提取全局JS变量中的商品数据
 * 并通过 postMessage 发送给内容脚本
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: [
        "https://item.jd.com/*",
        "https://item.m.jd.com/*",
        "https://detail.tmall.com/*",
        "https://detail.tmall.hk/*",
        "https://chaoshi.detail.tmall.com/*",
        "https://product.suning.com/*"
    ],
    world: "MAIN",
    run_at: "document_idle"
}

// ========== 京东全局变量提取 ==========

function extractJDGlobalData(): any {
    const win = window as any;

    // 按优先级尝试多个变量源
    const sources = [
        { key: '___data', path: null },
        { key: 'skuInfo', path: null },
        { key: 'product', path: null },
        { key: 'pageConfig', path: 'product' },
        { key: '__NUXT__', path: 'data' },
        { key: '__GLOBAL_MAIN__', path: null },
        { key: 'itemData', path: null }
    ];

    for (const source of sources) {
        try {
            let data = win[source.key];
            if (data && source.path) {
                data = data[source.path];
            }
            if (data) {
                console.log(`[JD MainWorld] 找到变量: ${source.key}`, Object.keys(data).slice(0, 5));
                return { source: source.key, data };
            }
        } catch { }
    }

    return null;
}

/**
 * 提取京东colorSize数据（包含所有SKU规格）
 */
function extractJDColorSize(): any[] {
    const win = window as any;

    // 尝试多种可能的路径
    const paths = [
        () => win.colorSize,
        () => win.pageConfig?.product?.colorSize,
        () => win.itemConfig?.colorSize,
        () => win.itemData?.sku?.colorSize,
        () => win.skuInfo?.colorSize,
        () => {
            // 遍历window查找
            for (const key of Object.keys(win)) {
                try {
                    const val = win[key];
                    if (val && typeof val === 'object') {
                        if (Array.isArray(val.colorSize) && val.colorSize.length > 0) {
                            console.log(`[JD MainWorld] 发现colorSize在window.${key}`);
                            return val.colorSize;
                        }
                        if (val.product?.colorSize?.length > 0) {
                            console.log(`[JD MainWorld] 发现colorSize在window.${key}.product`);
                            return val.product.colorSize;
                        }
                    }
                } catch { }
            }
            return null;
        }
    ];

    for (const getter of paths) {
        try {
            const colorSize = getter();
            if (Array.isArray(colorSize) && colorSize.length > 0) {
                console.log(`[JD MainWorld] 成功获取colorSize: ${colorSize.length}个SKU`);
                console.log('[JD MainWorld] colorSize第一项:', JSON.stringify(colorSize[0]).substring(0, 150));
                return colorSize;
            }
        } catch { }
    }

    console.log('[JD MainWorld] 未找到colorSize');
    return [];
}

/**
 * 提取京东 imageAndVideoJson（主图/视频列表）
 */
function extractJDImageAndVideoJson(): any[] {
    const win = window as any;

    console.log('[JD MainWorld] 检查imageAndVideoJson路径...');
    console.log('[JD MainWorld] pageConfig存在:', !!win.pageConfig);
    console.log('[JD MainWorld] pageConfig.product存在:', !!win.pageConfig?.product);
    console.log('[JD MainWorld] pageConfig.product.imageAndVideoJson:', win.pageConfig?.product?.imageAndVideoJson?.length || 0);
    console.log('[JD MainWorld] pageConfig.imageAndVideoJson:', win.pageConfig?.imageAndVideoJson?.length || 0);

    const getters: Array<{ desc: string, getter: () => any }> = [
        { desc: 'pageConfig.product', getter: () => win.pageConfig?.product?.imageAndVideoJson },
        { desc: 'pageConfig', getter: () => win.pageConfig?.imageAndVideoJson },
        { desc: 'itemData', getter: () => win.itemData?.imageAndVideoJson },
        { desc: 'itemConfig', getter: () => win.itemConfig?.imageAndVideoJson },
        { desc: 'PCDetailClient.resJs', getter: () => win.PCDetailClient?.product?.resJs?.['product.detail']?.data?.product?.imageAndVideoJson },
        { desc: 'PCDetailClient.resCore', getter: () => win.PCDetailClient?.product?.resCore?.['product.detail']?.data?.product?.imageAndVideoJson },
        { desc: '___data.product', getter: () => win.___data?.product?.imageAndVideoJson },
        { desc: '__INIT_DATA__.product', getter: () => win.__INIT_DATA__?.product?.imageAndVideoJson },
        { desc: 'product', getter: () => win.product?.imageAndVideoJson },
    ];

    for (const { desc, getter } of getters) {
        try {
            const val = getter();
            if (Array.isArray(val) && val.length > 0) {
                console.log(`[JD MainWorld] 使用${desc}.imageAndVideoJson:`, val.length, '项');
                return val;
            }
        } catch { }
    }

    // 遍历 window 兜底查找
    try {
        for (const key of Object.keys(win)) {
            const val = (win as any)[key];
            if (val && typeof val === 'object') {
                if (Array.isArray(val.imageAndVideoJson) && val.imageAndVideoJson.length > 0) {
                    console.log(`[JD MainWorld] 在window.${key}找到imageAndVideoJson:`, val.imageAndVideoJson.length, '项');
                    return val.imageAndVideoJson;
                }
                if (val.product?.imageAndVideoJson && Array.isArray(val.product.imageAndVideoJson) && val.product.imageAndVideoJson.length > 0) {
                    console.log(`[JD MainWorld] 在window.${key}.product找到imageAndVideoJson:`, val.product.imageAndVideoJson.length, '项');
                    return val.product.imageAndVideoJson;
                }
            }
        }
    } catch { }

    // ============ DOM兜底：直接从页面元素获取图片 ============
    console.log('[JD MainWorld] 未找到imageAndVideoJson变量，使用DOM提取...');
    const domImages: any[] = [];
    const seen = new Set<string>();

    /**
     * 标准化京东图片URL为唯一基准形式
     * 处理所有尺寸变体，确保同一图片只保留一份
     */
    const normalizeToBase = (rawUrl: string): string => {
        if (!rawUrl) return '';
        let u = rawUrl.trim();

        // 协议标准化
        if (u.startsWith('//')) u = 'https:' + u;
        u = u.replace(/^http:/, 'https:');

        // 移除所有尺寸前缀: s54x54_, s60x60_, s1440x1440_, 等
        // 格式: sWxH_ 或 sWxH_jfs
        u = u.replace(/s\d+x\d+_jfs/gi, 'jfs');
        u = u.replace(/\/s\d+x\d+_/g, '/');
        u = u.replace(/s\d+x\d+_/g, '');

        // 统一路径: /n5/, /n7/, /n9/ 都转为 /n1/ (大图)
        u = u.replace(/\/n[579]\//g, '/n1/');

        return u;
    };

    // 优先级: data-url > data-src > src
    // data-url 通常包含高清图片URL
    const selectors = [
        '#spec-list li img',      // 缩略图列表
        '#spec-n1 img',           // 主预览图
        '.preview-list li img',
        '.spec-items li img',
        '.lh li:not(.video-item) img',
        '.plist li img'           // 新增选择器
    ];

    for (const sel of selectors) {
        document.querySelectorAll(sel).forEach((img: Element) => {
            const imgEl = img as HTMLImageElement;

            // 跳过视频项
            const li = imgEl.closest('li');
            if (li?.classList.contains('video-item') || li?.className.includes('video')) {
                return;
            }

            // 优先使用 data-url（通常是高清大图URL）
            let rawUrl = imgEl.getAttribute('data-url') ||
                imgEl.getAttribute('data-src') ||
                imgEl.getAttribute('data-lazy') ||
                imgEl.getAttribute('src') || '';

            if (!rawUrl || !rawUrl.includes('360buyimg.com')) {
                return;
            }

            // 标准化URL用于去重
            const baseUrl = normalizeToBase(rawUrl);

            if (!baseUrl) return;

            // 检查是否已存在（基于标准化后的URL）
            if (seen.has(baseUrl)) {
                console.log('[JD MainWorld] 跳过重复图片:', baseUrl.substring(0, 60));
                return;
            }

            seen.add(baseUrl);

            // 构建高清图片URL（使用标准化后的URL）
            const hdUrl = baseUrl;
            console.log('[JD MainWorld] 添加图片:', hdUrl.substring(0, 80));
            domImages.push({ type: 1, img: hdUrl });
        });
    }

    if (domImages.length > 0) {
        console.log('[JD MainWorld] 从DOM提取到图片:', domImages.length, '张');
        // 打印所有图片URL便于调试
        domImages.forEach((item, i) => {
            console.log(`[JD MainWorld] 图片#${i + 1}:`, item.img?.substring(0, 100));
        });
        return domImages;
    }

    console.log('[JD MainWorld] 未找到任何图片');
    return [];
}

function extractJDParams(globalData: any): Record<string, string> {
    const params: Record<string, string> = {};
    if (!globalData?.data) return params;

    const data = globalData.data;

    try {
        // 尝试多种路径提取参数
        const paramPaths = [
            data.product?.detail?.parameterList,
            data.detail?.parameterList,
            data.parameterList,
            data.productDetail?.parameterList,
            data.skuBase?.parameterList
        ];

        for (const paramList of paramPaths) {
            if (Array.isArray(paramList)) {
                paramList.forEach((group: any) => {
                    const infos = group?.parameterInfos || group?.attrs || [];
                    infos.forEach((p: any) => {
                        const name = p?.name || p?.attrName || '';
                        const value = p?.value || p?.attrValue || '';
                        if (name && value) {
                            params[name.trim()] = value.trim();
                        }
                    });
                });
                break;
            }
        }

        // 也尝试直接从扁平结构提取
        const flatPaths = [data.product, data.detail, data.skuBase];
        for (const obj of flatPaths) {
            if (!obj) continue;
            ['brand', 'model', 'weight', 'origin', 'material'].forEach(key => {
                if (obj[key] && !params[key]) {
                    params[key] = String(obj[key]);
                }
            });
        }
    } catch (e) {
        console.warn('[JD MainWorld] 参数提取错误:', e);
    }

    return params;
}

// ========== 天猫全局变量提取 ==========

function extractTmallGlobalData(): any {
    const win = window as any;

    const sources = [
        { key: '__GLOBAL_DATA__', path: null },
        { key: '__INIT_DATA__', path: null },
        { key: '__AUI_STAGE_DATA__', path: null },
        { key: 'g_config', path: null },
        { key: 'g_page_config', path: null },
        { key: 'Hub', path: 'config.itemDO' }
    ];

    for (const source of sources) {
        try {
            let data = win[source.key];
            if (data && source.path) {
                const paths = source.path.split('.');
                for (const p of paths) {
                    data = data?.[p];
                }
            }
            if (data) {
                console.log(`[Tmall MainWorld] 找到变量: ${source.key}`,
                    typeof data === 'object' ? Object.keys(data).slice(0, 5) : typeof data);
                return { source: source.key, data };
            }
        } catch { }
    }

    return null;
}

function extractTmallParams(globalData: any): Record<string, string> {
    const params: Record<string, string> = {};
    if (!globalData?.data) return params;

    const data = globalData.data;

    try {
        // 尝试多种路径
        const paramPaths = [
            data.moduleData?.itemDO?.itemParams,
            data.itemDO?.itemParams,
            data.props,
            data.attributesMap,
            data.data?.itemInfoModel?.props,
            data.item?.props
        ];

        for (const itemParams of paramPaths) {
            if (!itemParams) continue;

            // 处理 props/attrs 数组格式
            ['props', 'attrs', 'parameters'].forEach(key => {
                const arr = itemParams[key] || (Array.isArray(itemParams) ? itemParams : null);
                if (Array.isArray(arr)) {
                    arr.forEach((p: any) => {
                        const name = p?.name || p?.attrName || '';
                        const value = p?.value || p?.attrValue || '';
                        if (name && value) {
                            params[name.trim()] = value.trim();
                        }
                    });
                }
            });

            if (Object.keys(params).length > 0) break;
        }
    } catch (e) {
        console.warn('[Tmall MainWorld] 参数提取错误:', e);
    }

    return params;
}

// ========== Script标签JSON解析 ==========

function extractJSONFromScripts(): any {
    const scripts = document.querySelectorAll('script:not([src])');

    for (const script of scripts) {
        const text = script.textContent || '';

        // 检查是否包含商品数据关键词
        if (text.includes('itemDO') || text.includes('skuId') ||
            text.includes('parameterList') || text.includes('props')) {

            // 尝试提取JSON对象
            const patterns = [
                /window\.__INIT_DATA__\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|<\/script>)/,
                /window\.___data\s*=\s*(\{[\s\S]*?\});?\s*(?:window\.|<\/script>)/,
                /var\s+pageConfig\s*=\s*(\{[\s\S]*?\});/,
                /\bdata\s*:\s*(\{[\s\S]*?"sku"[\s\S]*?\})/
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    try {
                        const json = JSON.parse(match[1]);
                        console.log('[MainWorld] 从Script标签提取到JSON');
                        return { source: 'script', data: json };
                    } catch { }
                }
            }
        }
    }

    return null;
}

// ========== 主函数 ==========

function detectPlatform(): 'JD' | 'Tmall' | 'Suning' | null {
    const host = location.hostname;
    if (host.includes('jd.com')) return 'JD';
    if (host.includes('tmall.com') || host.includes('taobao.com')) return 'Tmall';
    if (host.includes('suning.com')) return 'Suning';
    return null;
}

function extractProductData() {
    const platform = detectPlatform();
    console.log(`[MainWorld] 检测平台: ${platform}`);

    let globalData: any = null;
    let params: Record<string, string> = {};
    let colorSize: any[] = [];
    let imageAndVideoJson: any[] = [];  // 新增：主图数据

    // 根据平台提取数据
    if (platform === 'JD') {
        globalData = extractJDGlobalData();
        if (globalData) {
            params = extractJDParams(globalData);
        }
        // 提取colorSize（SKU规格）
        colorSize = extractJDColorSize();

        // 提取imageAndVideoJson（主图列表）
        imageAndVideoJson = extractJDImageAndVideoJson();
        console.log('[JD MainWorld] 最终imageAndVideoJson:', imageAndVideoJson.length, '项');
    } else if (platform === 'Tmall') {
        globalData = extractTmallGlobalData();
        if (globalData) {
            params = extractTmallParams(globalData);
        }
    }

    // Fallback: 从Script标签解析
    if (Object.keys(params).length === 0) {
        console.log('[MainWorld] 尝试从Script标签解析...');
        const scriptData = extractJSONFromScripts();
        if (scriptData) {
            if (platform === 'JD') {
                params = extractJDParams(scriptData);
            } else if (platform === 'Tmall') {
                params = extractTmallParams(scriptData);
            }
        }
    }

    console.log(`[MainWorld] 提取到参数: ${Object.keys(params).length} 项, colorSize: ${colorSize.length} 项, 图片: ${imageAndVideoJson.length} 张`);
    if (Object.keys(params).length > 0) {
        console.log('[MainWorld] 参数样例:', Object.entries(params).slice(0, 5));
    }

    // 发送给内容脚本
    window.postMessage({
        type: 'ECOMMERCE_PRODUCT_DATA',
        platform,
        params,
        colorSize,
        imageAndVideoJson,  // 新增：发送主图数据
        source: globalData?.source || 'unknown',
        timestamp: Date.now()
    }, '*');
}

// 监听采集请求
window.addEventListener('message', (event) => {
    if (event.data?.type === 'REQUEST_PRODUCT_DATA') {
        console.log('[MainWorld] 收到采集请求');
        extractProductData();
    }
});

// 页面加载后自动提取一次
setTimeout(() => {
    console.log('[MainWorld] 自动执行首次提取');
    extractProductData();
}, 2000);

console.log(`[MainWorld] E-commerce script loaded on ${location.hostname}`);
