// ================= 苏宁 Pro 采集引擎 =================
// 不允许修改政采云相关代码，此为独立新增文件

// 导入SKU多规格采集模块（增强版）
import { extractSuningSkuData, extractSuningSkuVariants } from './sku.suning'

export async function scrapeSuningPro(): Promise<any> {
    const doc = document;
    const product: any = {};

    // 标题
    product.title =
        (doc.querySelector(".proinfo-title") as HTMLElement)?.innerText?.trim() ||
        (doc.querySelector("#itemDisplayName") as HTMLElement)?.innerText?.trim() ||
        "";

    // 价格
    let priceText =
        (doc.querySelector(".mainprice") as HTMLElement)?.innerText ||
        (doc.querySelector("#promotionPrice") as HTMLElement)?.innerText ||
        "";
    product.price = parseFloat(priceText.replace(/[^\d.]/g, "")) || null;

    // 主图 - 获取大图URL
    const imageSelectors = [
        ".imgzoom-thumb-main img",
        ".proimg-list img",
        ".bigImg img",
        "#bigImg",
        "#itemImg img",
        ".itemimg img",
        "#J-thumb-list img",
        ".thumb-list img",
        ".imgzoom-wrap img"
    ];

    product.images = [];
    const seen = new Set<string>();

    /**
     * 苏宁图片URL转大图
     * 将缩略图URL转换为原始大图URL
     * 例如: xxx_400x400.jpg -> xxx.jpg
     */
    const toHDImage = (rawUrl: string): string => {
        if (!rawUrl) return '';
        let url = rawUrl.trim();

        // 确保https
        if (url.startsWith('//')) url = 'https:' + url;
        url = url.replace(/^http:/, 'https:');

        // 移除各种尺寸后缀格式
        // _200x200.jpg -> .jpg
        url = url.replace(/_\d+x\d+\.(jpg|jpeg|png|webp|gif)/gi, '.$1');
        // _400w_400h_4e.jpg -> .jpg  
        url = url.replace(/_\d+w_\d+h[^.]*\.(jpg|jpeg|png|webp|gif)/gi, '.$1');
        // .w200.h200. -> .
        url = url.replace(/\.w\d+\.h\d+\./g, '.');
        // 移除查询参数
        url = url.replace(/\?.*$/, '');

        return url;
    };

    for (const sel of imageSelectors) {
        doc.querySelectorAll(sel).forEach((img: HTMLImageElement) => {
            // 优先用 data-url (原图)
            let rawUrl = img.getAttribute("data-url") ||
                img.getAttribute("data-original") ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-lazy") ||
                img.src || "";

            const url = toHDImage(rawUrl);

            if (url && url.length > 10 && !seen.has(url) && url.includes('suning')) {
                seen.add(url);
                product.images.push(url);
                console.log(`[Suning Pro] 添加图片 #${product.images.length}:`, url.substring(0, 80));
            }
        });
    }

    // 参数
    const partNumber = (doc.querySelector("#partNumber") as HTMLInputElement)?.value;
    product.specs = await extractSuningParamsPro(partNumber);

    // SKU多规格数据（增强版 - 政采云兼容格式）
    const skuData = await extractSuningSkuData()
    product.skuData = skuData
    product.skuVariants = await extractSuningSkuVariants() // 保持向后兼容

    product.url = location.href;
    product.platform = "Suning";

    console.log("[Suning Pro] 采集结果:", product.title?.substring(0, 30), "图片:", product.images?.length, "参数:", Object.keys(product.specs || {}).length);
    return product;
}

// 苏宁参数解析接口 - 使用天猫的页面文本提取方式
async function extractSuningParamsPro(partNumber?: string): Promise<Record<string, string>> {
    const params: Record<string, string> = {};

    console.log('[Suning Pro] 开始参数采集...');

    // 方法1: 直接从页面文本提取（天猫方式，最有效）
    const pageText = document.body.innerText || '';
    console.log('[Suning Pro] 页面文本长度:', pageText.length);

    // 苏宁常用参数正则
    const labelPatterns: [string, RegExp][] = [
        ['品牌', /品牌[：:\s]*([^\s\n选择购买加入]{2,30})/],
        ['型号', /型号[：:\s]*([A-Za-z0-9\-\/\s]+)/],
        ['货号', /货号[：:\s]*([A-Za-z0-9\-\u4e00-\u9fa5]+)/],
        ['产地', /产地[：:\s]*(中国[^\s\n]*|[^\s\n]{2,20})/],
        ['颜色', /颜色[：:\s]*(白色|黑色|银色|红色|蓝色|灰色|金色)/],
        ['规格', /规格[：:\s]*([^\s\n]+)/],
        ['重量', /重量[：:\s]*([\d.]+[kg千克克]+)/i],
        ['尺寸', /尺寸[：:\s]*([^\s\n]+)/],
        ['材质', /材质[：:\s]*([^\s\n]+)/],
    ];

    // 垃圾词过滤
    const garbageWords = ['选择', '好看', '不错', '推荐', '喜欢', '正品', '加入', '购买', '立即', '故事'];

    for (const [label, pattern] of labelPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
            const value = match[1].trim();
            const isGarbage = garbageWords.some(w => value.includes(w));
            if (value.length >= 1 && value.length <= 50 && !isGarbage) {
                params[label] = value;
                console.log(`[Suning Pro] 文本提取: ${label}=${value}`);
            }
        }
    }

    // 方法2: 如果品牌没提取到，从标题提取
    if (!params['品牌']) {
        let title = document.querySelector('.proinfo-title, #itemDisplayName')?.textContent?.trim() || '';
        title = title.replace(/^(苏宁超市|自营)\s*/g, '').trim();  // 去掉自营前缀

        // 常见品牌列表匹配 - 包含酒类品牌
        const knownBrands = [
            // 酒类
            '洋河', '茅台', '五粮液', '泸州老窖', '汾酒', '剑南春', '郎酒', '西凤酒', '古井贡',
            '水井坊', '牛栏山', '红星', '江小白', '习酒', '国窖1573', '青花郎', '梦之蓝', '天之蓝', '海之蓝',
            // 电子/手机
            '联想', 'Lenovo', '华为', 'HUAWEI', '小米', 'Xiaomi', '三星', 'Samsung',
            'Apple', '苹果', 'OPPO', 'vivo', '荣耀', 'Honor', 'Dell', '戴尔', 'HP', '惠普',
            'ThinkPad', '华硕', 'ASUS', '宏碁', 'Acer', '微软', 'Microsoft', 'Sony', '索尼',
            // 家电
            '海尔', 'Haier', '美的', 'Midea', '格力', 'Gree', '海信', 'Hisense', 'TCL',
            '康佳', 'Konka', '长虹', 'Changhong', '创维', 'Skyworth', '奥克斯', 'AUX',
            // 其他
            '飞利浦', 'Philips', '西门子', 'Siemens', '博世', 'Bosch', '松下', 'Panasonic'
        ];

        for (const brand of knownBrands) {
            if (title.includes(brand)) {
                params['品牌'] = brand;
                console.log('[Suning Pro] 从标题匹配品牌:', brand);
                break;
            }
        }

        // 如果还没找到，尝试正则提取标题开头的品牌
        if (!params['品牌']) {
            const brandMatch = title.match(/^([\u4e00-\u9fa5]{2,4})/);
            if (brandMatch && !['苏宁', '自营', '正品', '特价', '热卖'].includes(brandMatch[1])) {
                params['品牌'] = brandMatch[1];
                console.log('[Suning Pro] 从标题正则提取品牌:', brandMatch[1]);
            }
        }
    }

    // 方法3: 提取型号（从标题）
    if (!params['型号']) {
        const title = document.querySelector('.proinfo-title, #itemDisplayName')?.textContent?.trim() || '';
        // 匹配 520ml, 52度, 6瓶 等规格
        const modelMatch = title.match(/(\d+度|\d+ml|\d+瓶|\d+L|\d+g|\d+kg)/i);
        if (modelMatch) {
            params['型号'] = modelMatch[1].trim();
            console.log('[Suning Pro] 从标题提取型号:', params['型号']);
        }
    }

    console.log('[Suning Pro] 最终参数:', Object.keys(params).length, '项');
    if (Object.keys(params).length > 0) {
        console.log('[Suning Pro] 样例:', Object.entries(params).slice(0, 5));
    }
    return params;
}
