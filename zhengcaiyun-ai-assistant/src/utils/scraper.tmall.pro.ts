// ================= 天猫 Pro 采集引擎 =================
// 不允许修改政采云相关代码，此为独立新增文件
// 采用3层采集策略：1.主世界脚本 2.Script标签解析 3.DOM兜底

// 缓存主世界脚本传来的数据
let cachedMainWorldData: Record<string, string> | null = null;

// 监听主世界脚本的消息
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'ECOMMERCE_PRODUCT_DATA' && event.data?.platform === 'Tmall') {
            console.log('[Tmall Pro] 收到主世界数据:', Object.keys(event.data.params || {}).length, '项参数');
            cachedMainWorldData = event.data.params || {};
        }
    });
}

export async function scrapeTmallPro(): Promise<any> {
    const doc = document;
    const product: any = {};

    // 标题 - 优先级方式获取
    product.title = getTmallTitle(doc);

    // 价格
    product.price = getTmallPrice(doc);

    // 主图 - 多种方式获取
    product.images = getTmallImages(doc);

    // 参数 - 3层策略
    product.specs = await extractTmallParamsLayered();

    product.url = location.href;
    product.platform = "Tmall";

    console.log("[Tmall Pro] 采集结果:", product.title?.substring(0, 30), "图片:", product.images?.length, "参数:", Object.keys(product.specs || {}).length);
    return product;
}

// 直接从页面文本提取参数
async function extractTmallParamsLayered(): Promise<Record<string, string>> {
    let params: Record<string, string> = {};

    console.log('[Tmall Pro] 开始参数提取...');

    // 最有效的方法：直接从整个页面文本中提取！
    const pageText = document.body.innerText || '';
    console.log('[Tmall Pro] 页面文本长度:', pageText.length);

    // 天猫常用的参数标签 - 更精确的正则 (增加更多)
    const labelPatterns: [string, RegExp][] = [
        ['品牌', /品牌[：:\s]*([^\s\n选择年月日]{2,30})/],
        ['货号', /货号[：:\s]*([A-Za-z0-9\-\u4e00-\u9fa5]+)/],
        ['产地', /产地[：:\s]*(中国[^\s\n]*|[^\s\n]{2,20})/],
        ['材质', /材质[：:\s]*([^\s\n]{2,20})/],
        ['规格', /规格[：:\s]*([^\s\n]+)/],
        ['重量', /重量[：:\s]*([\d.]+[kg千克克]+)/i],
        ['风格', /风格[：:\s]*([^\s\n]+)/],
        ['面料', /面料[：:\s]*([^\s\n]+)/],
        ['季节', /季节[：:\s]*([^\s\n]+)/],
        ['图案', /图案[：:\s]*([^\s\n]+)/],
        // 新增更多匹配
        ['适用范围', /适用范围[：:\s]*([^\s\n]+)/],
        ['是否量贩装', /是否量贩装[：:\s]*([^\s\n]+)/],
        ['洗衣液功效', /洗衣液功效[：:\s]*([^\s\n]+)/],
        ['规格类型', /规格类型[：:\s]*([^\s\n]+)/],
        ['执行标准', /执行标准[：:\s]*([^\s\n]+)/],
        ['活性物含量', /活性物含量[：:\s]*([^\s\n]+)/],
        ['瓶口设计类型', /瓶口设计类型[：:\s]*([^\s\n]+)/],
        ['计价单位', /计价单位[：:\s]*([^\s\n]+)/],
        ['包装种类', /包装种类[：:\s]*([^\s\n]+)/],
        ['去污范围', /去污范围[：:\s]*([^\s\n]+)/],
        ['酶添加种类', /酶添加种类[：:\s]*([^\s\n]+)/],
        ['是否浓缩', /是否浓缩[：:\s]*([^\s\n]+)/],
        ['款式', /款式[：:\s]*([^\s\n]+)/],
        ['香味持久度', /香味持久度[：:\s]*([^\s\n]+)/],
        ['核心功效', /核心功效[：:\s]*([^\s\n]+)/],
        ['净含量', /净含量[：:\s]*([\d.]+[gGmlL毫升千克]+)/],
        ['保质期', /保质期[：:\s]*([^\s\n]+)/],
        ['成分', /成分[：:\s]*([^\s\n]+)/],
    ];

    // 评价类垃圾词
    const garbageWords = ['选择', '好看', '不错', '很好', '推荐', '值得', '喜欢', '正品',
        '承诺', '购买', '放心', '退换货', '无理由', '本知', '简约现代'];

    for (const [label, pattern] of labelPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
            const value = match[1].trim();
            const isGarbage = garbageWords.some(w => value.includes(w));
            if (value.length >= 1 && value.length <= 50 && !isGarbage &&
                !value.includes('评价') && !value.includes('请选择') && !value.includes('收藏')) {
                params[label] = value;
                console.log(`[Tmall Pro] 找到: ${label}=${value}`);
            }
        }
    }

    // 如果直接提取不够，尝试从主世界数据
    if (Object.keys(params).length < 3 && cachedMainWorldData) {
        Object.entries(cachedMainWorldData).forEach(([k, v]) => {
            if (!params[k] && isValidSpec(k, v)) params[k] = v;
        });
    }

    console.log('[Tmall Pro] 最终参数:', Object.keys(params).length, '项');
    if (Object.keys(params).length > 0) {
        console.log('[Tmall Pro] 样例:', Object.entries(params).slice(0, 5));
    }
    return params;
}

// 政采云方法：点击规格Tab并等待容器
async function clickSpecTabAndWaitTmall(): Promise<Element | null> {
    const tabSelectors = [
        '[class*="Tabs"] [class*="item"]',
        '.tm-anchor li a',
        '#J_TabBar li a',
        '.detail-tab li'
    ];

    let clickedTab: Element | null = null;

    for (const sel of tabSelectors) {
        const tabs = document.querySelectorAll(sel);
        for (const tab of tabs) {
            const text = tab.textContent?.trim() || '';
            if ((text.includes('规格') || text.includes('参数') || text.includes('属性')) &&
                text.length < 20 && !text.includes('评价')) {
                console.log('[Tmall Pro] 点击Tab:', text);
                (tab as HTMLElement).click();
                clickedTab = tab;
                break;
            }
        }
        if (clickedTab) break;
    }

    if (!clickedTab) {
        console.log('[Tmall Pro] 未找到规格Tab，尝试滚动');
        window.scrollTo({ top: document.body.scrollHeight * 0.4, behavior: 'smooth' });
    }

    await sleep(1000);
    return waitForSpecContainerTmall();
}

// 政采云方法：等待规格容器
async function waitForSpecContainerTmall(): Promise<Element | null> {
    const containerSelectors = [
        '#J_AttrUL',
        '[class*="Attributes"]',
        '[class*="attributes"]',
        '#attributes',
        '.tb-attributes',
        '.tm-props'
    ];

    return new Promise((resolve) => {
        const tryFind = (): Element | null => {
            for (const sel of containerSelectors) {
                const containers = document.querySelectorAll(sel);
                for (const container of containers) {
                    const hasRows = container.querySelectorAll('li').length > 2;
                    const text = container.textContent || '';
                    const hasLabelValue = text.includes('品牌') || text.includes('型号');

                    if (hasRows || hasLabelValue) {
                        console.log('[Tmall Pro] 找到规格容器:', sel);
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

// 政采云方法：从容器提取参数
function extractParamsFromContainerTmall(container: Element): Record<string, string> {
    const params: Record<string, string> = {};
    const seen = new Set<string>();

    // 方式1: li格式（天猫主要格式）
    container.querySelectorAll('li').forEach(li => {
        const text = li.textContent?.trim() || '';
        const match = text.match(/^([^：:]{2,12})[：:](.+)$/);
        if (match) {
            const label = cleanLabelTmall(match[1]);
            const value = match[2].trim();
            if (label && value && !seen.has(label) && isValidSpec(label, value)) {
                seen.add(label);
                params[label] = value;
            }
        }
    });

    // 方式2: span格式
    container.querySelectorAll('li').forEach(li => {
        const spans = li.querySelectorAll('span');
        if (spans.length >= 2) {
            const label = cleanLabelTmall(spans[0].textContent || '');
            const value = (spans[1].textContent || '').trim();
            if (label && value && !seen.has(label) && isValidSpec(label, value)) {
                seen.add(label);
                params[label] = value;
            }
        }
    });

    return params;
}

function cleanLabelTmall(raw: string): string {
    return raw.replace(/[：:：\s]/g, '').trim();
}


// 从Script标签解析Tmall参数
function extractTmallParamsFromScripts(): Record<string, string> {
    const params: Record<string, string> = {};
    const scripts = document.querySelectorAll('script:not([src])');

    for (const script of scripts) {
        const text = script.textContent || '';

        // 查找天猫特有的数据结构
        if (text.includes('__INIT_DATA__') || text.includes('__GLOBAL_DATA__') ||
            text.includes('itemDO') || text.includes('props')) {

            // 尝试提取参数列表
            const patterns = [
                /"props"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
                /"attrs"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
                /"itemParams"\s*:\s*(\{[\s\S]*?\})\s*[,}]/,
                /"parameters"\s*:\s*(\[[\s\S]*?\])\s*[,}]/
            ];

            for (const pattern of patterns) {
                const match = text.match(pattern);
                if (match) {
                    try {
                        const data = JSON.parse(match[1]);
                        if (Array.isArray(data)) {
                            data.forEach((p: any) => {
                                const name = p?.name || p?.attrName || '';
                                const value = p?.value || p?.attrValue || '';
                                if (name && value) {
                                    params[name.trim()] = value.trim();
                                }
                            });
                        } else if (typeof data === 'object') {
                            // 处理对象格式的 itemParams
                            ['props', 'attrs'].forEach(key => {
                                const arr = data[key];
                                if (Array.isArray(arr)) {
                                    arr.forEach((p: any) => {
                                        if (p?.name && p?.value) {
                                            params[p.name.trim()] = p.value.trim();
                                        }
                                    });
                                }
                            });
                        }
                    } catch { }
                }
            }
        }
    }

    return params;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 过滤非规格参数的键名和值
function isValidSpec(key: string, value: string): boolean {
    // 排除的键名关键词（促销、物流、购买记录等）
    const invalidKeywords = [
        '价格', '促销', '优惠', '满减', '领券', '红包', '折扣',
        '发货', '配送', '送达', '运费', '快递', '物流', '包邮',
        '已购', '已买', '购买', '下单', '付款', '支付',
        '评价', '好评', '差评', '晒单', '追评', '评论',
        '收藏', '关注', '分享', '问答', '咨询',
        '库存', '数量', '件', '月销', '销量',
        '异常', '问题', '提示', '说明', '须知', '注意',
        '选择', '请选择', '可选', '默认',
        '服务', '保障', '承诺', '退换', '保修'
    ];

    // 排除的值关键词
    const invalidValueKeywords = [
        '商品详情', '促销信息', '请以', '具体', '为准',
        '点击查看', '了解更多', '查看详情',
        '选择后', '请您', '您可以', '如有疑问',
        '收藏', '无异味'
    ];

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

    // 检查键名长度
    if (key.length < 2 || key.length > 15) {
        return false;
    }

    // 检查值长度
    if (value.length > 100) {
        return false;
    }

    // 检查是否包含日期格式（购买记录）
    if (/\d{4}-\d{2}-\d{2}/.test(key)) {
        return false;
    }

    return true;
}


// 天猫标题提取
function getTmallTitle(doc: Document): string {
    const selectors = [
        // 新版天猫
        '[class*="mainTitle"]',
        '[class*="ItemHeader--mainTitle"]',
        '.ItemHeader--mainTitle--',
        // 老版天猫
        ".tb-detail-hd h1",
        ".tb-main-title",
        // 通用
        "h1.title",
        "h1",
        ".product-title",
        // JSON-LD (SEO数据)
        'script[type="application/ld+json"]'
    ];

    for (const sel of selectors) {
        try {
            if (sel.includes('ld+json')) {
                const scripts = doc.querySelectorAll(sel);
                for (const script of scripts) {
                    try {
                        const data = JSON.parse(script.textContent || '');
                        if (data.name) return data.name;
                    } catch { }
                }
                continue;
            }
            const el = doc.querySelector(sel);
            const text = el?.textContent?.trim();
            if (text && text.length > 5 && text.length < 200) {
                return text;
            }
        } catch { }
    }

    // Fallback: 页面标题
    return doc.title.split(/[-|–—]/)[0].replace(/天猫|淘宝|Tmall/gi, '').trim();
}

// 天猫价格提取
function getTmallPrice(doc: Document): number | null {
    const selectors = [
        '[class*="Price--priceText"]',
        '[class*="priceText"]',
        '.tm-price',
        '.tm-promo-price',
        '#J_StrPrice .tm-price',
        '.tb-rmb-num',
        '[class*="originPrice"]'
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

// 天猫图片提取
function getTmallImages(doc: Document): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    console.log('[Tmall Pro] 开始图片采集...');

    const addImage = (src: string, source: string = '') => {
        if (!src) return;

        let hdSrc = src;

        // 只移除尺寸后缀，保留完整URL
        // 例如: xxx_60x60q90.jpg -> xxx.jpg
        // 例如: xxx_100x100.jpg -> xxx.jpg
        hdSrc = hdSrc.replace(/_\d+x\d+q?\d*\.(jpg|jpeg|png|webp|gif)/gi, '.$1');
        hdSrc = hdSrc.replace(/_\d+x\d+\.(jpg|jpeg|png|webp|gif)/gi, '.$1');

        // 移除 .jpg_.webp 这种双后缀
        hdSrc = hdSrc.replace(/\.(jpg|jpeg|png)_\.webp$/i, '.$1');
        hdSrc = hdSrc.replace(/\.(jpg|jpeg|png)_.webp$/i, '.$1');

        // 确保是https
        if (hdSrc.startsWith('//')) hdSrc = 'https:' + hdSrc;

        // 验证URL完整性
        if (!hdSrc.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)) {
            console.log('[Tmall Pro] 跳过不完整URL:', hdSrc.substring(0, 50));
            return;
        }

        // 放宽域名限制
        const isTmallImage = hdSrc.includes('alicdn.com') || hdSrc.includes('tbcdn.cn') || hdSrc.includes('tmall.com') || hdSrc.includes('taobao.com');
        if (!seen.has(hdSrc) && isTmallImage) {
            seen.add(hdSrc);
            images.push(hdSrc);
            console.log(`[Tmall Pro] 找到图片 #${images.length} [${source}]:`, hdSrc.substring(0, 80));
        }
    };

    // 新版天猫图片选择器
    const selectors = [
        // 新版主图区域
        '[class*="PicGallery"] img',
        '[class*="picGallery"] img',
        '[class*="sliderMain"] img',
        // 缩略图
        '[class*="thumbnail"] img',
        '[class*="Thumbnail"] img',
        // 老版天猫
        '#J_UlThumb img',
        '.tb-thumb img',
        '.tb-gallery img',
        '.main-image img',
        // 通用
        '.slider-main img',
        '.item-gallery img'
    ];

    for (const sel of selectors) {
        try {
            doc.querySelectorAll(sel).forEach((img: HTMLImageElement) => {
                const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
                addImage(src);
            });
        } catch { }
    }

    // Fallback: 从页面JS变量获取
    if (images.length === 0) {
        try {
            const win = window as any;
            const initData = win.__INIT_DATA__ || win.__GLOBAL_DATA__ || win.g_config;
            const pics = initData?.itemDO?.picsPath || initData?.item?.imgs || [];
            if (Array.isArray(pics)) {
                pics.forEach((p: string) => addImage(p));
            }
        } catch { }
    }

    // Fallback: 扫描所有alicdn图片（放宽条件）
    if (images.length === 0) {
        console.log('[Tmall Pro] 使用全页扫描兜底...');
        const allImgs = doc.querySelectorAll('img');
        console.log('[Tmall Pro] 页面共有图片:', allImgs.length);

        allImgs.forEach((img: HTMLImageElement) => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
            // 放宽条件：只要是alicdn/tbcdn图片
            if ((src.includes('alicdn.com') || src.includes('tbcdn.cn')) && !src.includes('icon') && !src.includes('logo') && !src.includes('avatar')) {
                addImage(src, 'fallback-scan');
            }
        });
    }

    // 最后兜底：从所有元素的 data-* 属性中提取
    if (images.length === 0) {
        console.log('[Tmall Pro] 使用属性扫描兜底...');
        doc.querySelectorAll('[data-src], [data-lazy-src], [data-ks-lazyload]').forEach((el) => {
            const src = el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.getAttribute('data-ks-lazyload') || '';
            if (src.includes('alicdn.com') || src.includes('tbcdn.cn')) {
                addImage(src, 'attr-scan');
            }
        });
    }

    console.log('[Tmall Pro] 最终图片数量:', images.length);
    return images.slice(0, 15);
}

// 天猫参数解析
function extractTmallParamsPro(): Record<string, string> {
    const params: Record<string, string> = {};

    console.log('[Tmall Pro] 开始参数采集...');

    try {
        const win = window as any;
        console.log('[Tmall Pro] 检查全局变量...');
        console.log('[Tmall Pro] __INIT_DATA__存在:', !!win.__INIT_DATA__);
        console.log('[Tmall Pro] __GLOBAL_DATA__存在:', !!win.__GLOBAL_DATA__);
        console.log('[Tmall Pro] g_config存在:', !!win.g_config);

        // 从全局变量获取
        const init = win.__INIT_DATA__ || win.__GLOBAL_DATA__ || win.g_config || win.g_page_config;

        if (init) {
            console.log('[Tmall Pro] 全局数据键:', Object.keys(init).slice(0, 10));
        }

        // 尝试多种路径
        const itemParams =
            init?.moduleData?.itemDO?.itemParams ||
            init?.itemDO?.itemParams ||
            init?.props ||
            init?.attributesMap ||
            init?.data?.itemInfoModel?.props;

        if (itemParams) {
            console.log('[Tmall Pro] 找到itemParams:', typeof itemParams);
        }

        // props
        if (itemParams?.props) {
            console.log('[Tmall Pro] 从props提取:', itemParams.props.length);
            itemParams.props.forEach((p: any) => {
                if (p?.name) params[p.name.trim()] = p.value?.trim() || "";
            });
        }

        // attrs
        if (itemParams?.attrs) {
            console.log('[Tmall Pro] 从attrs提取:', itemParams.attrs.length);
            itemParams.attrs.forEach((p: any) => {
                if (p?.name) params[p.name.trim()] = p.value?.trim() || "";
            });
        }

        // 直接数组格式
        if (Array.isArray(itemParams)) {
            console.log('[Tmall Pro] itemParams是数组:', itemParams.length);
            itemParams.forEach((p: any) => {
                if (p?.name) params[p.name.trim()] = p.value?.trim() || "";
            });
        }
    } catch (e) {
        console.warn('[Tmall Pro] 全局变量解析失败:', e);
    }

    // DOM 补充 - 新版天猫
    console.log('[Tmall Pro] 开始DOM扫描...');
    const domSelectors = [
        // 新版属性区域
        '[class*="Attributes"] li',
        '[class*="attributes"] li',
        '[class*="ItemAttributes"] li',
        '[class*="Props"] li',
        // 老版
        '#J_AttrUL li',
        '#J_AttrList li',
        '.attributes-list li',
        '.tb-attributes li',
        // 更多尝试
        '.tm-clear li',
        '#attributes li',
        'ul.attributes li'
    ];

    for (const sel of domSelectors) {
        try {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                console.log(`[Tmall Pro] 选择器 "${sel}" 找到 ${elements.length} 个元素`);
            }
            elements.forEach((li) => {
                const txt = (li as HTMLElement).innerText?.trim() || "";
                const match = txt.match(/^(.+?)[：:](.+)$/);
                if (match && match[1] && match[2]) {
                    const k = match[1].trim();
                    const v = match[2].trim();
                    if (!params[k] && isValidSpec(k, v)) {
                        params[k] = v;
                    }
                }
            });
        } catch { }
    }

    // 方式3: 强力文本模式提取（从页面全文）
    console.log('[Tmall Pro] 尝试从页面文本提取...');
    const bodyText = document.body.innerText || '';

    // 常见商品参数名称列表
    const commonParams = [
        '品牌', '型号', '产地', '材质', '颜色', '尺寸', '重量', '包装',
        '货号', '款式', '适用人群', '适用场景', '面料', '功能',
        '生产日期', '保质期', '规格', '类型', '系列', '上市时间',
        '商品名称', '商品编号', '商品毛重', '商品产地',
        '能效等级', '功率', '容量', '版本', '存储', '内存',
        '屏幕', '分辨率', '刷新率', '处理器', '显卡',
        '屏幕尺寸', '风格', '图案', '形状', '厚度'
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
                    console.log(`[Tmall Pro] 从文本提取: ${paramName} = ${value.substring(0, 30)}`);
                    break;
                }
            }
        }
    }

    // 方式4: 扫描所有包含冒号的文本（最后兜底）
    if (Object.keys(params).length < 3) {
        console.log('[Tmall Pro] 使用冒号扫描兜底...');
        const lines = bodyText.split(/[\n\r]/);
        for (const line of lines) {
            const colonMatch = line.match(/^([^：:]{2,15})[：:]([^：:]{2,80})$/);
            if (colonMatch) {
                const key = colonMatch[1].trim();
                const val = colonMatch[2].trim();
                if (key && val && !params[key] &&
                    !key.includes('评价') && !key.includes('购买') && !key.includes('好评') &&
                    !key.includes('图片') && !key.includes('点击') && !key.includes('查看') &&
                    !key.includes('选择') && !key.includes('数量') &&
                    Object.keys(params).length < 20) {
                    params[key] = val.substring(0, 50);
                }
            }
        }
    }

    console.log('[Tmall Pro] 参数采集:', Object.keys(params).length, '项');
    if (Object.keys(params).length > 0) {
        console.log('[Tmall Pro] 参数样例:', Object.entries(params).slice(0, 5));
    }
    return params;
}

