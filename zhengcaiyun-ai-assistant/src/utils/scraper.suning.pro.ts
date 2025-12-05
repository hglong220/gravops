// ================= 苏宁 Pro 采集引擎 =================
// 不允许修改政采云相关代码，此为独立新增文件

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
        ".thumb-list img"
    ];

    product.images = [];
    const seen = new Set<string>();

    for (const sel of imageSelectors) {
        doc.querySelectorAll(sel).forEach((img: HTMLImageElement) => {
            // 优先用 data-url (原图)
            let url = img.getAttribute("data-url") ||
                img.getAttribute("data-original") ||
                img.getAttribute("data-src") ||
                img.src || "";

            // 苏宁图片URL处理 - 获取原始大图
            url = url.replace(/_\d+w_\d+h\.(jpg|png|webp)/gi, '.$1');
            url = url.replace(/_\d+x\d+\.(jpg|png|webp)/gi, '.$1');
            url = url.replace(/\.w\d+\.h\d+\./g, '.');
            url = url.replace(/\?.*$/, '');

            // 确保https
            if (url.startsWith('//')) url = 'https:' + url;

            if (url && url.length > 10 && !seen.has(url) && url.includes('suning')) {
                seen.add(url);
                product.images.push(url);
            }
        });
    }

    // 参数
    const partNumber = (doc.querySelector("#partNumber") as HTMLInputElement)?.value;
    product.specs = await extractSuningParamsPro(partNumber);

    product.url = location.href;
    product.platform = "Suning";

    console.log("[Suning Pro] 采集结果:", product.title?.substring(0, 30), "图片:", product.images?.length, "参数:", Object.keys(product.specs || {}).length);
    return product;
}

// 苏宁参数解析接口
async function extractSuningParamsPro(partNumber?: string): Promise<Record<string, string>> {
    const params: Record<string, string> = {};

    console.log('[Suning Pro] 开始参数采集...');

    // 优先从DOM表格提取（最准确）
    const domSelectors = ['.itemparameter li', '#itemParameter li', '.pro-para li', '.J-parameter li'];
    for (const sel of domSelectors) {
        document.querySelectorAll(sel).forEach((el) => {
            const txt = (el as HTMLElement).innerText?.trim() || "";
            const match = txt.match(/^(.+?)[：:](.+)$/);
            if (match && match[1] && match[2]) {
                const key = match[1].trim();
                const val = match[2].trim();
                if (!params[key] && key.length <= 10 && val.length <= 50) {
                    params[key] = val;
                    console.log(`[Suning Pro] DOM提取: ${key}=${val}`);
                }
            }
        });
    }

    // 如果DOM提取不够,用文本提取
    if (Object.keys(params).length < 3) {
        const pageText = document.body.innerText || '';
        console.log('[Suning Pro] 页面文本长度:', pageText.length);

        const labelPatterns: [string, RegExp][] = [
            ['品牌', /品牌[：:\s]*([^\s\n选择]{2,30})/],
            ['型号', /型号[：:\s]*([A-Za-z0-9\-\/]+)/],
            ['产地', /产地[：:\s]*(中国[^\s\n]*|[^\s\n]{2,20})/],
            ['商品编号', /商品编号[：:\s]*(\d+)/],
            ['颜色', /颜色[：:\s]*(白色|黑色|银色|红色|蓝色|灰色)/],
            ['规格', /规格[：:\s]*([^\s\n]+)/],
            ['材质', /材质[：:\s]*(不锈钢|塑料|铝合金|铜|铁)/],
            ['功率', /功率[：:\s]*([\d.]+[wW瓦]+)/],
            ['容量', /容量[：:\s]*([\d.]+[L升毫升ml]+)/i],
            ['重量', /重量[：:\s]*([\d.]+[kg千克克]+)/i],
            ['电压', /电压[：:\s]*([\d]+[vV伏]+)/],
            ['能效等级', /能效等级[：:\s]*([一二三四五]级)/],
        ];

        const garbageWords = ['选择', '好看', '不错', '推荐', '喜欢', '正品', '故事'];

        for (const [label, pattern] of labelPatterns) {
            if (params[label]) continue;
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
    }

    console.log('[Suning Pro] 最终参数:', Object.keys(params).length, '项');
    return params;
}
