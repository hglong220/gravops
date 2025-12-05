// ================= 京东 Pro 采集引擎 =================
// 不允许修改政采云相关代码，此为独立新增文件
// 采用3层采集策略：1.主世界脚本 2.Script标签解析 3.DOM兜底

// 缓存主世界脚本传来的数据
let cachedMainWorldData: Record<string, string> | null = null;

// 监听主世界脚本的消息
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'ECOMMERCE_PRODUCT_DATA' && event.data?.platform === 'JD') {
            console.log('[JD Pro] 收到主世界数据:', Object.keys(event.data.params || {}).length, '项参数');
            cachedMainWorldData = event.data.params || {};
        }
    });
}

export async function scrapeJDPro(): Promise<any> {
    const doc = document;
    const product: any = {};

    // 标题 - 优先级方式获取
    product.title = getJDTitle(doc);

    // 价格
    product.price = getJDPrice(doc);

    // 主图 - 多种方式获取
    product.images = getJDImages(doc);

    // 参数 - 3层策略
    product.specs = await extractJDParamsLayered();

    product.url = location.href;
    product.platform = "JD";

    console.log("[JD Pro] 采集结果:", product.title?.substring(0, 30), "图片:", product.images?.length, "参数:", Object.keys(product.specs || {}).length);
    return product;
}

// 稳定版：优先从DOM表格提取，文本作为后备
async function extractJDParamsLayered(): Promise<Record<string, string>> {
    let params: Record<string, string> = {};

    console.log('[JD Pro] 开始参数提取...');

    // 方法1: 从京东参数表格提取 (最稳定)
    const tableSelectors = [
        '.Ptable .Ptable-item',          // 新版京东
        '.p-parameter-list li',          // 老版京东
        '#parameter2 .p-parameter-list li',
        '.detail-list li'
    ];

    for (const sel of tableSelectors) {
        document.querySelectorAll(sel).forEach(item => {
            // Ptable格式: dt/dd
            const dt = item.querySelector('dt, .Ptable-key, .name');
            const dd = item.querySelector('dd, .Ptable-val, .value');
            if (dt && dd) {
                const key = dt.textContent?.trim().replace(/[：:]/g, '') || '';
                const val = dd.textContent?.trim() || '';
                if (key && val && key.length <= 15 && val.length <= 100 && !params[key]) {
                    params[key] = val;
                    console.log(`[JD Pro] DOM提取: ${key}=${val}`);
                }
            }

            // li格式: 整行文本
            if (!dt && !dd) {
                const text = item.textContent?.trim() || '';
                const match = text.match(/^([^：:]{2,15})[：:](.+)$/);
                if (match) {
                    const key = match[1].trim();
                    const val = match[2].trim();
                    if (key && val && !params[key]) {
                        params[key] = val;
                        console.log(`[JD Pro] li提取: ${key}=${val}`);
                    }
                }
            }
        });
    }

    console.log('[JD Pro] DOM提取结果:', Object.keys(params).length, '项');

    // 方法2: 如果DOM提取不够，从标题提取品牌
    if (!params['品牌']) {
        const title = document.title || '';
        // 标题通常格式: "品牌名 商品描述"
        const brandMatch = title.match(/^([A-Za-z]+|[\u4e00-\u9fa5]{2,6})\s/);
        if (brandMatch) {
            params['品牌'] = brandMatch[1];
            console.log('[JD Pro] 从标题提取品牌:', brandMatch[1]);
        }
    }

    // 方法3: 如果没有型号，用货号代替
    if (!params['型号'] && params['货号']) {
        params['型号'] = params['货号'];
        console.log('[JD Pro] 用货号作为型号:', params['型号']);
    }

    // 方法4: 从URL提取商品编号
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


// 京东标题提取
function getJDTitle(doc: Document): string {
    console.log('[JD Pro] 开始标题提取...');

    const selectors = [
        // 商品信息区域的标题 - 优先级最高
        '.product-intro .sku-name',
        '.itemInfo-wrap .sku-name',
        '#J-detail-content .sku-name',
        '.w .sku-name',  // 主内容区
        // 商品名称专用
        '.p-name em',
        '.p-name',
        '.itemInfo h1',
        // 老版京东
        '#name h1',
        '.item-name h1',
        // 最后尝试通用选择器
        'h1.sku-name',
        '[class*="SkuName"]'
    ];

    for (const sel of selectors) {
        try {
            const el = doc.querySelector(sel);
            const text = el?.textContent?.trim();
            console.log(`[JD Pro] 选择器 "${sel}":`, text?.substring(0, 30) || '(空)');

            // 过滤掉店铺名（通常包含"专营店"、"旗舰店"等）
            if (text && text.length > 5 && text.length < 200) {
                if (!text.includes('专营店') && !text.includes('旗舰店') &&
                    !text.includes('自营') && !text.includes('官方店')) {
                    console.log('[JD Pro] 标题选中:', text.substring(0, 50));
                    return text;
                }
            }
        } catch { }
    }

    // Fallback: 从页面标题提取
    const pageTitle = doc.title.split(/[-|–—]/)[0].replace(/京东|JD|商品详情/gi, '').trim();
    console.log('[JD Pro] 使用页面标题:', pageTitle);

    if (pageTitle && pageTitle.length > 5 &&
        !pageTitle.includes('专营店') && !pageTitle.includes('旗舰店')) {
        return pageTitle;
    }

    // 最后fallback：用meta description
    const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    if (metaDesc && metaDesc.length > 10) {
        console.log('[JD Pro] 使用meta description');
        return metaDesc.substring(0, 100);
    }

    return '未知商品';
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
function getJDImages(doc: Document): string[] {
    const images: string[] = [];
    const seen = new Set<string>();
    const videoUrls = new Set<string>(); // 记录视频相关URL

    console.log('[JD Pro] 开始图片采集...');

    // 先找出所有视频相关的元素
    document.querySelectorAll('[class*="video"], [class*="Video"], [data-video], .video-item, .J-video').forEach(el => {
        const img = el.querySelector('img');
        if (img) {
            const src = img.src || img.getAttribute('data-src') || '';
            if (src) videoUrls.add(src);
        }
    });

    const addImage = (src: string, source: string = '', element?: Element) => {
        if (!src) return;

        // 过滤视频URL（增强版）
        if (src.includes('.mp4') || src.includes('.webm') || src.includes('.m3u8') ||
            src.includes('video') || src.includes('play') || src.includes('.gif') ||
            src.includes('jdv') || src.includes('vodeo') || videoUrls.has(src)) {
            console.log('[JD Pro] 过滤视频:', src.substring(0, 50));
            return;
        }

        // 检查父元素是否是视频容器
        if (element) {
            const parent = element.closest('[class*="video"], [class*="Video"], .video-item, .J-video');
            if (parent) {
                console.log('[JD Pro] 过滤视频容器内的图片');
                return;
            }
        }

        // 转为高清大图
        let hdSrc = src
            .replace(/\/n\d+\//, '/n1/')   // n5 -> n1 高清
            .replace(/s\d+x\d+_/, '')      // 去掉尺寸前缀
            .replace(/_\d+x\d+[^.]*\.(jpg|png|webp)/i, '.$1');

        // 确保是https
        if (hdSrc.startsWith('//')) hdSrc = 'https:' + hdSrc;

        // 放宽域名限制
        const isJdImage = hdSrc.includes('jd.com') || hdSrc.includes('360buyimg.com') || hdSrc.includes('jd.hk');
        if (!seen.has(hdSrc) && isJdImage) {
            seen.add(hdSrc);
            images.push(hdSrc);
            console.log(`[JD Pro] 找到图片 #${images.length} [${source}]:`, hdSrc.substring(0, 60));
        }
    };

    // 新版京东图片选择器 - 增加更多
    const selectors = [
        // 主图轮播区域
        '#spec-list img',
        '#spec-img img',
        '.spec-items img',
        '[class*="PicGallery"] img',
        // 缩略图列表
        '#spec-list li:not(.video-item) img',
        '.lh li:not(.video-item) img',
        '.spec-list li:not(.video-item) img',
        // 大图
        '#spec-n1 img',
        '#preview img',
        '.jqzoom img',
        // 通用
        '.product-img img',
        '.slider-main img',
        // 新增选择器
        '.img-hover img',
        '.small-pic img',
        '[class*="sku-name"] img',
        '.J-pic-main img',
        '.pic-main img',
        '[data-role="img-list"] img'
    ];

    for (const sel of selectors) {
        try {
            doc.querySelectorAll(sel).forEach((img: HTMLImageElement) => {
                // 获取各种属性
                const src = img.src ||
                    img.getAttribute('data-src') ||
                    img.getAttribute('data-lazy-img') ||
                    img.getAttribute('data-origin') ||
                    img.getAttribute('src') || '';
                addImage(src, sel, img);
            });
        } catch { }
    }

    // Fallback: 从页面JS对象获取
    if (images.length === 0) {
        try {
            const win = window as any;
            // 尝试多种全局变量
            const imageList =
                win.pageConfig?.product?.imageList ||
                win.itemData?.imageList ||
                win.top_itemData?.imageList ||
                [];
            if (Array.isArray(imageList)) {
                imageList.forEach((p: string) => addImage(p));
            }
        } catch { }
    }

    // Fallback: 扫描所有360buyimg图片（放宽条件）
    if (images.length === 0) {
        console.log('[JD Pro] 使用全页扫描兜底...');
        const allImgs = doc.querySelectorAll('img');
        console.log('[JD Pro] 页面共有图片:', allImgs.length);

        allImgs.forEach((img: HTMLImageElement) => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-img') || '';
            // 放宽条件：只要包含jd相关域名
            if ((src.includes('360buyimg.com') || src.includes('jd.com')) && !src.includes('icon') && !src.includes('logo')) {
                addImage(src, 'fallback-scan');
            }
        });
    }

    // 最后兜底：从所有 img 标签的各种属性中提取
    if (images.length === 0) {
        console.log('[JD Pro] 使用属性扫描兜底...');
        doc.querySelectorAll('[data-src], [data-lazy-img], [data-origin]').forEach((el) => {
            const src = el.getAttribute('data-src') || el.getAttribute('data-lazy-img') || el.getAttribute('data-origin') || '';
            if (src.includes('360buyimg.com')) {
                addImage(src, 'attr-scan');
            }
        });
    }

    console.log('[JD Pro] 最终图片数量:', images.length);
    return images.slice(0, 15);
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
