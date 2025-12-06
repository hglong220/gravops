// ================= 京东 Pro 采集引擎 =================
// 不允许修改政采云相关代码，此为独立新增文件
// 采用3层采集策略：1.主世界脚本 2.Script标签解析 3.DOM兜底

// 导入SKU多规格采集模块（增强版）
import { extractJDSkuData, extractJDSkuVariants } from './sku.jd'

// 缓存主世界脚本传来的数据
let cachedMainWorldData: Record<string, string> | null = null;
let cachedColorSize: any[] = [];
let cachedImageAndVideoJson: any[] = [];  // 新增：缓存主图数据

// 监听主世界脚本的消息
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'ECOMMERCE_PRODUCT_DATA' && event.data?.platform === 'JD') {
            console.log('[JD Pro] 收到主世界数据:', Object.keys(event.data.params || {}).length, '项参数');
            cachedMainWorldData = event.data.params || {};

            // 接收colorSize数据
            if (event.data.colorSize && Array.isArray(event.data.colorSize)) {
                cachedColorSize = event.data.colorSize;
                console.log('[JD Pro] 收到colorSize:', cachedColorSize.length, '个SKU');
            }

            // 接收imageAndVideoJson数据
            if (event.data.imageAndVideoJson && Array.isArray(event.data.imageAndVideoJson)) {
                cachedImageAndVideoJson = event.data.imageAndVideoJson;
                console.log('[JD Pro] 收到imageAndVideoJson:', cachedImageAndVideoJson.length, '张主图');
            }
        }
    });
}

// 导出获取colorSize的函数供SKU模块使用
export function getCachedColorSize(): any[] {
    return cachedColorSize;
}

export async function scrapeJDPro(): Promise<any> {
    const doc = document;
    const product: any = {};

    // 请求主世界脚本获取数据
    window.postMessage({ type: 'REQUEST_PRODUCT_DATA' }, '*');
    // 等待数据返回
    await new Promise(resolve => setTimeout(resolve, 500));

    // 标题 - 优先级方式获取
    product.title = getJDTitle(doc);

    // 价格
    product.price = getJDPrice(doc);

    // 主图 - 多种方式获取
    product.images = getJDImages(doc);

    // 参数 - 3层策略
    product.specs = await extractJDParamsLayered();

    // SKU多规格数据（增强版 - 政采云兼容格式）
    // 传入主世界获取的colorSize
    const skuData = await extractJDSkuData(cachedColorSize)
    product.skuData = skuData
    product.skuVariants = await extractJDSkuVariants() // 保持向后兼容

    product.url = location.href;
    product.platform = "JD";

    console.log("[JD Pro] 采集结果:", product.title?.substring(0, 30), "图片:", product.images?.length, "参数:", Object.keys(product.specs || {}).length);
    return product;
}

// 稳定版：优先从DOM表格提取，文本作为后备
async function extractJDParamsLayered(): Promise<Record<string, string>> {
    let params: Record<string, string> = {};

    console.log('[JD Pro] 开始参数提取...');

    // 方法1: 直接从页面文本提取（天猫方式，最有效）
    const pageText = document.body.innerText || '';
    console.log('[JD Pro] 页面文本长度:', pageText.length);

    // 京东常用参数正则 - 更严格的品牌匹配
    const labelPatterns: [string, RegExp][] = [
        // 品牌：只匹配短的品牌名（通常是英文或中文2-8个字符）
        ['品牌', /品牌[：:\s]+([A-Za-z][A-Za-z0-9\-\/]{1,20}|[\u4e00-\u9fa5]{2,8}[A-Za-z]*)/],
        ['型号', /型号[：:\s]+([A-Za-z0-9\-\/\s]{2,30})/],
        ['货号', /货号[：:\s]+([A-Za-z0-9\-]{2,30})/],
        ['商品名称', /商品名称[：:\s]+([^\n]{5,50})/],
        ['商品编号', /商品编号[：:\s]+(\d{10,})/],
        ['商品毛重', /商品毛重[：:\s]+([0-9.]+\s*[kgKG千克克]+)/],
        ['商品产地', /商品产地[：:\s]+(中国[^\s\n]*|[^\s\n]{2,15})/],
        ['材质', /材质[：:\s]+([^\s\n]{2,20})/],
        ['颜色', /颜色[：:\s]*(白色|黑色|银色|红色|蓝色|灰色|金色|粉色|绿色|紫色)/],
    ];

    // 垃圾词过滤（品牌不应该包含这些词）
    const garbageWords = ['选择', '好看', '不错', '推荐', '喜欢', '正品', '加入', '购买', '立即',
        '请选择', '属于', '国内', '高端', '前5名', '可以', '应该', '评价', '晒单'];

    for (const [label, pattern] of labelPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
            const value = match[1].trim();
            // 更严格的垃圾词过滤
            const isGarbage = garbageWords.some(w => value.includes(w));
            // 品牌名不应该太长（通常不超过20个字符）
            const isTooLong = label === '品牌' && value.length > 20;
            if (value.length >= 2 && value.length <= 50 && !isGarbage && !isTooLong) {
                params[label] = value;
                console.log(`[JD Pro] 文本提取: ${label}=${value}`);
            }
        }
    }

    // 方法2: 如果品牌没提取到，从标题提取
    if (!params['品牌']) {
        const title = getJDTitle(document);

        // 常见品牌列表匹配
        const knownBrands = ['联想', 'Lenovo', '华为', 'HUAWEI', '小米', 'Xiaomi', '三星', 'Samsung',
            'Apple', '苹果', 'OPPO', 'vivo', '荣耀', 'Honor', 'Dell', '戴尔', 'HP', '惠普',
            'ThinkPad', '华硕', 'ASUS', '宏碁', 'Acer', '微软', 'Microsoft', 'Sony', '索尼',
            '品仪', 'JOMOW', '九牧', 'JOMOO', '箭牌', 'Arrow', '科勒', 'Kohler', '摩恩', 'Moen'];

        for (const brand of knownBrands) {
            if (title.toLowerCase().includes(brand.toLowerCase())) {
                params['品牌'] = brand;
                console.log('[JD Pro] 从标题匹配品牌:', brand);
                break;
            }
        }

        // 如果还没找到，尝试正则提取标题开头的品牌
        if (!params['品牌']) {
            const brandMatch = title.match(/^([A-Za-z][A-Za-z0-9]{0,15})/);
            if (brandMatch && brandMatch[1].length >= 2) {
                params['品牌'] = brandMatch[1];
                console.log('[JD Pro] 从标题正则提取品牌:', brandMatch[1]);
            }
        }
    }

    // 方法3: 提取型号（从标题）
    if (!params['型号']) {
        const title = getJDTitle(document);
        // 型号通常在标题中，如 "品仪老板椅" -> 提取后缀型号
        const modelMatch = title.match(/([A-Za-z]+\d+[A-Za-z]*|[A-Za-z]{2,}\s*\d+)/i);
        if (modelMatch) {
            params['型号'] = modelMatch[1].trim();
            console.log('[JD Pro] 从标题提取型号:', params['型号']);
        }
    }

    // 方法4: 如果没有型号，用货号代替
    if (!params['型号'] && params['货号']) {
        params['型号'] = params['货号'];
        console.log('[JD Pro] 用货号作为型号:', params['型号']);
    }

    // 方法5: 从URL提取商品编号
    if (!params['商品编号']) {
        const urlMatch = location.href.match(/\/(\d{10,})\./);
        if (urlMatch) {
            params['商品编号'] = urlMatch[1];
        }
    }

    console.log('[JD Pro] 最终参数:', Object.keys(params).length, '项');
    if (Object.keys(params).length > 0) {
        console.log('[JD Pro] 样例:', Object.entries(params).slice(0, 5));
    }
    return params;
}


// 政采云方法：点击规格Tab并等待容器出现
async function clickSpecTabAndWaitJD(): Promise<Element | null> {
    // 京东规格Tab选择器
    const tabSelectors = [
        '#detail .tab-main li',
        'ul.tab-con li',
        '.product-intro .tab li',
        '[class*="tabs"] li',
        'a[href*="parameter"]'
    ];

    let clickedTab: Element | null = null;

    for (const sel of tabSelectors) {
        const tabs = document.querySelectorAll(sel);
        for (const tab of tabs) {
            const text = tab.textContent?.trim() || '';
            // 必须包含"规格"或"参数"，但排除用户评价
            if ((text.includes('规格') || text.includes('参数')) &&
                text.length < 20 && !text.includes('评价') && !text.includes('好评')) {
                console.log('[JD Pro] 点击Tab:', text);
                (tab as HTMLElement).click();
                clickedTab = tab;
                break;
            }
        }
        if (clickedTab) break;
    }

    if (!clickedTab) {
        console.log('[JD Pro] 未找到规格Tab，尝试滚动到规格区域');
        const paramSection = document.querySelector('.Ptable, #detail, .parameter2');
        if (paramSection) {
            paramSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    await sleep(1000);
    return waitForSpecContainerJD();
}

// 政采云方法：等待规格容器出现
async function waitForSpecContainerJD(): Promise<Element | null> {
    const containerSelectors = [
        '.Ptable',           // 京东规格表
        '.parameter2',       // 规格参数区
        '#detail .tab-content',
        '.p-parameter',
        '.detail-list'
    ];

    return new Promise((resolve) => {
        const tryFind = (): Element | null => {
            for (const sel of containerSelectors) {
                const containers = document.querySelectorAll(sel);
                for (const container of containers) {
                    const hasTable = container.querySelector('table, dl, .Ptable-item');
                    const hasRows = container.querySelectorAll('tr, li, dt').length > 2;
                    const text = container.textContent || '';
                    const hasLabelValue = text.includes('品牌') || text.includes('型号') || text.includes('产地');

                    if (hasTable || hasRows || hasLabelValue) {
                        console.log('[JD Pro] 找到规格容器:', sel);
                        return container;
                    }
                }
            }
            return null;
        };

        const found = tryFind();
        if (found) {
            resolve(found);
            return;
        }

        const observer = new MutationObserver(() => {
            const container = tryFind();
            if (container) {
                observer.disconnect();
                resolve(container);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(tryFind());
        }, 3000);
    });
}

// 政采云方法：只从规格容器中提取参数
function extractParamsFromContainer(container: Element): Record<string, string> {
    const params: Record<string, string> = {};
    const seen = new Set<string>();

    console.log('[JD Pro] 容器内容长度:', container.textContent?.length || 0);
    console.log('[JD Pro] 容器内文本前200字:', container.textContent?.substring(0, 200));

    // 方式1: Ptable格式（京东专用）
    const ptableItems = container.querySelectorAll('.Ptable-item dl');
    console.log('[JD Pro] Ptable-item dl 数量:', ptableItems.length);
    ptableItems.forEach(dl => {
        const dt = dl.querySelector('dt');
        const dd = dl.querySelector('dd');
        if (dt && dd) {
            const label = cleanLabel(dt.textContent || '');
            const value = (dd.textContent || '').trim();
            if (label && value && !seen.has(label) && isValidSpec(label, value)) {
                seen.add(label);
                params[label] = value;
            }
        }
    });

    // 方式2: 表格格式
    const rows = container.querySelectorAll('tr');
    console.log('[JD Pro] tr 行数:', rows.length);
    rows.forEach(tr => {
        const cells = tr.querySelectorAll('td, th');
        if (cells.length >= 2) {
            const label = cleanLabel(cells[0].textContent || '');
            const value = (cells[1].textContent || '').trim();
            if (label && value && !seen.has(label) && isValidSpec(label, value)) {
                seen.add(label);
                params[label] = value;
            }
        }
    });

    // 方式3: li格式
    const lis = container.querySelectorAll('li');
    console.log('[JD Pro] li 数量:', lis.length);
    lis.forEach(li => {
        const text = li.textContent?.trim() || '';
        const match = text.match(/^([^：:]{2,12})[：:](.+)$/);
        if (match) {
            const label = cleanLabel(match[1]);
            const value = match[2].trim();
            if (label && value && !seen.has(label) && isValidSpec(label, value)) {
                seen.add(label);
                params[label] = value;
            }
        }
    });

    // 方式4: 直接从文本解析（京东特殊格式）
    console.log('[JD Pro] 开始文本解析...');
    const text = container.textContent || '';
    const knownLabels = ['品牌', '商品名称', '商品编号', '商品毛重', '商品产地', '货号',
        '材质', '颜色', '尺码', '款式', '适用人群', '适用场景'];

    for (const label of knownLabels) {
        if (seen.has(label)) continue;
        // 匹配 "品牌哥伦比亚" 或 "品牌：哥伦比亚" 或 "品牌 哥伦比亚"
        const patterns = [
            new RegExp(`${label}[：:\\s]*([^\\s品商货材颜尺款适产]{1,30})`, 'i'),
        ];
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const value = match[1].trim();
                if (value && value.length > 1 && value.length < 30 && isValidSpec(label, value)) {
                    console.log(`[JD Pro] 文本解析成功: ${label}=${value}`);
                    params[label] = value;
                    seen.add(label);
                    break;
                }
            }
        }
    }

    console.log('[JD Pro] 容器提取结果:', Object.keys(params).length, '项');
    return params;
}

function cleanLabel(raw: string): string {
    return raw.replace(/[：:：\s]/g, '').trim();
}


// 从Script标签解析JD参数
function extractJDParamsFromScripts(): Record<string, string> {
    const params: Record<string, string> = {};
    const scripts = document.querySelectorAll('script:not([src])');

    for (const script of scripts) {
        const text = script.textContent || '';

        // 查找 pageConfig 或 itemData
        if (text.includes('pageConfig') || text.includes('___data') || text.includes('skuInfo')) {
            // 尝试提取参数列表
            const patterns = [
                /"parameterList"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
                /"parameters"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
                /"attrs"\s*:\s*(\[[\s\S]*?\])\s*[,}]/
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    try {
                        const arr = JSON.parse(match[1]);
                        if (Array.isArray(arr)) {
                            arr.forEach((item: any) => {
                                // 处理 parameterInfos 嵌套
                                const infos = item.parameterInfos || [item];
                                infos.forEach((p: any) => {
                                    const name = p?.name || p?.attrName || '';
                                    const value = p?.value || p?.attrValue || '';
                                    if (name && value) {
                                        params[name.trim()] = value.trim();
                                    }
                                });
                            });
                        }
                    } catch { }
                }
            }
        }
    }

    return params;
}

// 等待元素出现
function waitForElement(selector: string, timeout: number): Promise<Element | null> {
    return new Promise((resolve) => {
        const element = document.querySelector(selector);
        if (element) {
            resolve(element);
            return;
        }

        const observer = new MutationObserver(() => {
            const el = document.querySelector(selector);
            if (el) {
                observer.disconnect();
                resolve(el);
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        setTimeout(() => {
            observer.disconnect();
            resolve(document.querySelector(selector));
        }, timeout);
    });
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 过滤非规格参数的键名和值
function isValidSpec(key: string, value: string): boolean {
    // 排除的键名关键词（促销、物流、购买记录等）
    const invalidKeywords = [
        '京东价', '价格', '促销', '优惠', '满减', '领券', '红包',
        '发货', '配送', '送达', '运费', '快递', '物流',
        '已购', '已买', '购买', '下单', '付款', '支付',
        '评价', '好评', '差评', '晒单', '追评',
        '收藏', '关注', '分享', '问答', '咨询',
        '库存', '数量', '件', '月销',
        '异常', '问题', '提示', '说明', '须知', '注意',
        '选择', '请选择', '可选',
        '服务', '保障', '承诺', '退换'
    ];

    // 排除的值关键词
    const invalidValueKeywords = [
        '商品详情', '促销信息', '请以', '具体', '为准',
        '点击查看', '了解更多', '查看详情',
        '选择后', '请您', '您可以', '如有疑问'
    ];

    const keyLower = key.toLowerCase();
    const valueLower = value.toLowerCase();

    // 检查键名
    for (const kw of invalidKeywords) {
        if (key.includes(kw)) {
            return false;
        }
    }

    // 检查值
    for (const kw of invalidValueKeywords) {
        if (value.includes(kw)) {
            return false;
        }
    }

    // 检查键名长度（太短或太长都不对）
    if (key.length < 2 || key.length > 15) {
        return false;
    }

    // 检查值长度（太长可能是描述文本）
    if (value.length > 100) {
        return false;
    }

    // 检查是否包含日期格式（购买记录）
    if (/\d{4}-\d{2}-\d{2}/.test(key)) {
        return false;
    }

    return true;
}


// ========== 标题采集（用户方案重写版） ==========

/**
 * 温和清洗京东标题（用户方案）
 * 只做"非常确定"的裁剪，保留规格信息
 */
function cleanJdTitle(raw: string): string {
    if (!raw) return '';

    let t = raw.trim();

    // 去掉 -京东 / -JD.COM 等后缀
    t = t.replace(/\s*[-_—–]\s*(京东|jd\.?com).*$/i, '');

    // 去掉 JD 通用的【图片 价格 品牌 报价】等尾巴
    t = t.replace(/【[^【】]*(图片|价格|品牌|报价|行情|评测)[^【】]*】$/i, '');

    return t.trim();
}

function getJDTitle(doc: Document): string {
    console.log('[JD Pro] 开始标题提取（用户方案）...');

    let title = '';

    // 1. 先尝试 DOM 里的 h1 / sku-name（兼容老页面）
    const domSelectors = [
        '.product-intro .sku-name',
        '.itemInfo-wrap .sku-name',
        'h1.sku-name',
        '.sku-name',
        '.p-name em',
        '.p-name',
        '#name h1'
    ];

    for (const sel of domSelectors) {
        try {
            const el = doc.querySelector(sel);
            const text = el?.textContent?.trim();

            if (text && text.length > 5 && text.length < 200) {
                // 过滤掉店铺名
                if (!text.includes('专营店') && !text.includes('旗舰店') &&
                    !text.includes('自营') && !text.includes('官方店')) {
                    console.log('[JD Pro] DOM标题选中:', text.substring(0, 50));
                    title = text;
                    break;
                }
            }
        } catch { }
    }

    // 2. 兜底：document.title（不再暴力裁剪！）
    if (!title) {
        title = doc.title;
        console.log('[JD Pro] 使用页面标题:', title);
    }

    // 3. 温和清洗（只砍京东尾巴和【图片 价格 品牌 报价】）
    title = cleanJdTitle(title);

    console.log('[JD Pro] 最终标题:', title.substring(0, 80));
    return title || '未知商品';
}

// 京东价格提取
function getJDPrice(doc: Document): number | null {
    const selectors = [
        '.p-price .price',
        '.summary-price-wrap .price',
        '[class*="Price--mainPrice"]',
        '.J-p-price',
        '#jd-price'
    ];

    for (const sel of selectors) {
        try {
            const el = doc.querySelector(sel);
            const text = el?.textContent || '';
            const match = text.match(/[\d,.]+/);
            if (match) {
                return parseFloat(match[0].replace(/,/g, '')) || null;
            }
        } catch { }
    }

    // 正则从页面提取
    const bodyText = doc.body.innerText || '';
    const priceMatch = bodyText.match(/[¥￥]\s*([\d,]+\.?\d*)/);
    if (priceMatch) {
        return parseFloat(priceMatch[1].replace(/,/g, '')) || null;
    }

    return null;
}

// 京东图片提取
// ========== 图片采集（用户方案重写版） ==========

/**
 * 判断是否是京东活动图标/LOGO（需要过滤）
 */
function isBadJdIcon(url: string): boolean {
    if (!url) return false;
    const u = url.toLowerCase();

    // 活动图、角标常见域名/路径
    if (u.includes('/jdg/')) return true;          // HOT/12.12 这类
    if (u.includes('/popshop/')) return true;      // 品牌&店铺小图
    if (u.includes('/imagetools/')) return true;   // 很多营销图
    if (u.includes('/da/')) return true;           // 广告图
    if (u.includes('/cms/')) return true;          // CMS营销内容

    // 关键词过滤
    if (/hot|12\.12|logo|icon|badge|coupon|vip|member|avatar|qrcode/i.test(u)) return true;

    return false;
}

/**
 * 标准化京东图片URL
 */
function normalizeJdImg(url: string): string {
    if (!url) return '';
    let u = url.trim();
    if (u.startsWith('//')) u = 'https:' + u;
    return u.replace(/^http:/, 'https:');
}

/**
 * 标准化京东图片URL为大图URL
 * 处理缩略图参数，确保获取高清原图
 */
function normalizeJdImgToHD(url: string): string {
    if (!url) return '';
    let u = url.trim();

    // 协议标准化
    if (u.startsWith('//')) u = 'https:' + u;
    u = u.replace(/^http:/, 'https:');

    // 移除缩略图前缀（如 s54x54_ s40x40_ s60x60_）
    u = u.replace(/\/s\d+x\d+_/g, '/');
    u = u.replace(/s\d+x\d+_jfs/g, 'jfs');

    // 转换小图路径为大图路径
    u = u.replace(/\/n5\//g, '/n1/');
    u = u.replace(/\/n7\//g, '/n1/');
    u = u.replace(/\/n9\//g, '/n1/');

    // 移除尺寸限制参数（如 s1440x1440_ 等）
    // 但保留完整路径，只移除前缀
    u = u.replace(/s\d+x\d+_jfs/gi, 'jfs');

    return u;
}

function getJDImages(doc: Document): string[] {
    console.log('[JD Pro] 开始图片采集...');

    const urls: string[] = []; // 用于去重和结果存储

    /**
     * 添加图片URL（带去重）
     */
    const pushImg = (rawUrl: string | undefined | null, debugFrom: string) => {
        if (!rawUrl) return;
        let url = rawUrl.trim();
        if (!url) return;

        // 补全协议
        if (url.startsWith('//')) url = 'https:' + url;
        url = url.replace(/^http:/, 'https:');

        // 必须是京东图片
        if (!url.includes('360buyimg.com') && !url.includes('jd.com')) {
            console.log(`[JD Pro] 跳过非京东图片 ${debugFrom}:`, url.substring(0, 50));
            return;
        }

        // 过滤活动图标
        if (isBadJdIcon(url)) {
            console.log(`[JD Pro] 跳过活动图标 ${debugFrom}:`, url.substring(0, 50));
            return;
        }

        // 去重检查（使用原始URL，不做过度标准化）
        if (urls.includes(url)) {
            console.log(`[JD Pro] 跳过重复 ${debugFrom}:`, url.substring(0, 50));
            return;
        }

        urls.push(url);
        console.log(`[JD Pro] 添加图片 #${urls.length} ${debugFrom}:`, url.substring(0, 80));
    };

    // 1) 优先用缓存的 imageAndVideoJson
    console.log('[JD Pro] cachedImageAndVideoJson长度:', cachedImageAndVideoJson?.length || 0);

    if (Array.isArray(cachedImageAndVideoJson) && cachedImageAndVideoJson.length > 0) {
        console.log('[JD Pro] 缓存内容预览:', JSON.stringify(cachedImageAndVideoJson.slice(0, 2)).substring(0, 200));

        cachedImageAndVideoJson.forEach((item, idx) => {
            if (!item) return;

            // 过滤视频项
            if (item.type === 2 || item.type === '2' || item.type === 'video') {
                console.log(`[JD Pro] 跳过视频项 #${idx + 1}`);
                return;
            }

            // 尝试多个可能的URL字段
            const imgUrl = item.img || item.imgUrl || item.imageUrl || item.bigImgUrl ||
                item.mainUrl || item.url || item.src || item.image || '';
            pushImg(imgUrl, `[cached #${idx + 1}]`);
        });
    }

    // 2) 再从 window.imageAndVideoJson 兜底
    if (urls.length < 3) {
        try {
            const win = window as any;
            const winSources = [
                win.imageAndVideoJson,
                win.imageList,
                win.pageConfig?.product?.imageAndVideoJson,
                win.pageConfig?.imageAndVideoJson,
                win.itemData?.imageAndVideoJson
            ];

            for (const imageAndVideoJson of winSources) {
                if (Array.isArray(imageAndVideoJson) && imageAndVideoJson.length > 0) {
                    console.log('[JD Pro] 从window获取imageAndVideoJson，长度:', imageAndVideoJson.length);

                    imageAndVideoJson.forEach((item: any, idx: number) => {
                        if (!item) return;
                        if (item.type === 2 || item.type === '2' || item.type === 'video') return;

                        const imgUrl = item.img || item.imgUrl || item.imageUrl || item.bigImgUrl ||
                            item.mainUrl || item.url || item.src || item.image || '';
                        pushImg(imgUrl, `[window #${idx + 1}]`);
                    });
                    break; // 找到一个有效源就停止
                }
            }
        } catch (e) {
            console.warn('[JD Pro] 读取window.imageAndVideoJson出错:', e);
        }
    }

    // 3) 最后从 DOM 里再扫一遍主图区域做兜底
    if (urls.length < 3) {
        try {
            console.log('[JD Pro] 从DOM采集主图...');
            const selectors = [
                '#spec-list img',
                '#spec-n1 img',
                '.preview-wrap img',
                '.spec-items img',
                '.lh li:not(.video-item) img'
            ];

            selectors.forEach(sel => {
                doc.querySelectorAll<HTMLImageElement>(sel).forEach((img, idx) => {
                    // 跳过视频容器内的图片
                    if (img.closest('.video-item, [class*="video"]')) return;

                    const src = img.getAttribute('data-url') ||
                        img.getAttribute('data-src') ||
                        img.getAttribute('data-lazy-img') ||
                        img.src || '';
                    pushImg(src, `[DOM ${sel} #${idx + 1}]`);
                });
            });
        } catch (e) {
            console.warn('[JD Pro] 从DOM采集主图出错:', e);
        }
    }

    console.log('[JD Pro] 最终图片数量:', urls.length);
    return urls.slice(0, 15);
}

// 京东参数解析（完整 Pro 级）
function extractJDParamsPro(): Record<string, string> {
    const params: Record<string, string> = {};

    console.log('[JD Pro] 开始参数采集...');

    // 方式1: 从全局JS对象获取
    try {
        const win = window as any;
        console.log('[JD Pro] 检查全局变量...');
        console.log('[JD Pro] PCDetailClient存在:', !!win.PCDetailClient);
        console.log('[JD Pro] pageConfig存在:', !!win.pageConfig);

        // PCDetailClient 路径
        const data = win.PCDetailClient?.product?.resJs?.['product.detail']?.data?.product?.detail?.parameterList;
        if (Array.isArray(data)) {
            console.log('[JD Pro] 从PCDetailClient找到参数组:', data.length);
            data.forEach((group: any) => {
                group?.parameterInfos?.forEach((p: any) => {
                    if (p?.name && p?.value) {
                        params[p.name.trim()] = p.value.trim();
                    }
                });
            });
        }

        // pageConfig 路径
        const paramList = win.pageConfig?.product?.parameterList;
        if (Array.isArray(paramList)) {
            console.log('[JD Pro] 从pageConfig找到参数组:', paramList.length);
            paramList.forEach((group: any) => {
                group?.parameterInfos?.forEach((p: any) => {
                    if (p?.name && p?.value && !params[p.name.trim()]) {
                        params[p.name.trim()] = p.value.trim();
                    }
                });
            });
        }
    } catch (e) {
        console.warn('[JD Pro] 全局变量解析失败:', e);
    }

    // 方式2: DOM 补充 - 规格参数表格
    console.log('[JD Pro] 开始DOM扫描...');
    const domSelectors = [
        '#detail .parameter2 li',
        '.Ptable-item dl',
        '#parameter2 li',
        '.p-parameter li',
        '#detail-tag-id-3 li',
        '.p-parameter-list li',
        // 新增更多选择器
        '.detail-list li',
        '#product-detail-2 li',
        '.tab-con li',
        'table.Ptable tr'
    ];

    for (const sel of domSelectors) {
        try {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                console.log(`[JD Pro] 选择器 "${sel}" 找到 ${elements.length} 个元素`);
            }
            elements.forEach((el) => {
                if (el.tagName === 'LI') {
                    const txt = (el as HTMLElement).innerText?.trim() || "";
                    const match = txt.match(/^(.+?)[：:](.+)$/);
                    if (match && match[1] && match[2]) {
                        const k = match[1].trim();
                        const v = match[2].trim();
                        if (!params[k] && isValidSpec(k, v)) {
                            params[k] = v;
                        }
                    }
                } else if (el.tagName === 'DL') {
                    const dt = el.querySelector('dt')?.textContent?.trim() || "";
                    const dd = el.querySelector('dd')?.textContent?.trim() || "";
                    if (dt && dd && !params[dt] && isValidSpec(dt, dd)) {
                        params[dt] = dd;
                    }
                } else if (el.tagName === 'TR') {
                    const cells = el.querySelectorAll('td, th');
                    if (cells.length >= 2) {
                        const key = cells[0].textContent?.trim() || '';
                        const val = cells[1].textContent?.trim() || '';
                        if (key && val && !params[key] && isValidSpec(key, val)) {
                            params[key] = val;
                        }
                    }
                }
            });
        } catch { }
    }

    // 方式3: Ptable格式（详细规格）
    try {
        const ptables = document.querySelectorAll('.Ptable-item');
        if (ptables.length > 0) {
            console.log('[JD Pro] 找到 Ptable-item:', ptables.length);
        }
        ptables.forEach(table => {
            const dts = table.querySelectorAll('dt');
            const dds = table.querySelectorAll('dd');
            dts.forEach((dt, i) => {
                const label = dt.textContent?.trim() || '';
                const value = dds[i]?.textContent?.trim() || '';
                if (label && value && !params[label]) {
                    params[label] = value;
                }
            });
        });
    } catch { }

    // 方式4: 强力文本模式提取（从页面全文）
    console.log('[JD Pro] 尝试从页面文本提取...');
    const bodyText = document.body.innerText || '';

    // 常见商品参数名称列表
    const commonParams = [
        '品牌', '型号', '产地', '材质', '颜色', '尺寸', '重量', '包装',
        '货号', '款式', '适用人群', '适用场景', '面料', '功能',
        '生产日期', '保质期', '规格', '类型', '系列', '上市时间',
        '商品名称', '商品编号', '商品毛重', '商品产地',
        '能效等级', '功率', '容量', '版本', '存储', '内存',
        '屏幕', '分辨率', '刷新率', '处理器', '显卡'
    ];

    for (const paramName of commonParams) {
        if (params[paramName]) continue;

        // 尝试多种分隔符格式
        const patterns = [
            new RegExp(`${paramName}[：:：]\\s*([^\\n\\r\\t]+)`, 'i'),
            new RegExp(`${paramName}\\s*[：:：]\\s*([^\\n\\r\\t]+)`, 'i'),
            new RegExp(`【${paramName}】\\s*([^\\n\\r【]+)`, 'i'),
        ];

        for (const pattern of patterns) {
            const match = bodyText.match(pattern);
            if (match && match[1]) {
                const value = match[1].trim();
                // 过滤掉太长或看起来不像值的内容
                if (value.length > 1 && value.length < 100 && !value.includes('暂无') && !value.includes('undefined')) {
                    params[paramName] = value.substring(0, 50);
                    console.log(`[JD Pro] 从文本提取: ${paramName} = ${value.substring(0, 30)}`);
                    break;
                }
            }
        }
    }

    // 方式5: 扫描所有包含冒号的文本（最后兜底）
    if (Object.keys(params).length < 3) {
        console.log('[JD Pro] 使用冒号扫描兜底...');
        // 找所有包含冒号的行
        const lines = bodyText.split(/[\n\r]/);
        for (const line of lines) {
            const colonMatch = line.match(/^([^：:]{2,15})[：:]([^：:]{2,80})$/);
            if (colonMatch) {
                const key = colonMatch[1].trim();
                const val = colonMatch[2].trim();
                // 过滤掉不像参数的内容
                if (key && val && !params[key] &&
                    !key.includes('评价') && !key.includes('购买') && !key.includes('好评') &&
                    !key.includes('图片') && !key.includes('点击') && !key.includes('查看') &&
                    Object.keys(params).length < 20) {
                    params[key] = val.substring(0, 50);
                }
            }
        }
    }

    console.log('[JD Pro] 参数采集:', Object.keys(params).length, '项');
    if (Object.keys(params).length > 0) {
        console.log('[JD Pro] 参数样例:', Object.entries(params).slice(0, 5));
    }
    return params;
}
