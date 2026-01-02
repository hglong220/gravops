// ================= 鑻忓畞 Pro 閲囬泦寮曟搸 =================
// 涓嶅厑璁镐慨鏀规斂閲囦簯鐩稿叧浠ｇ爜锛屾涓虹嫭绔嬫柊澧炴枃浠?
// 瀵煎叆SKU澶氳鏍奸噰闆嗘ā鍧楋紙澧炲己鐗堬級
import { extractSuningSkuData, extractSuningSkuVariants } from './sku.suning'

export async function scrapeSuningPro(): Promise<any> {
    const doc = document;
    const product: any = {};

    // 鏍囬
    product.title =
        (doc.querySelector(".proinfo-title") as HTMLElement)?.innerText?.trim() ||
        (doc.querySelector("#itemDisplayName") as HTMLElement)?.innerText?.trim() ||
        "";

    // 浠锋牸
    let priceText =
        (doc.querySelector(".mainprice") as HTMLElement)?.innerText ||
        (doc.querySelector("#promotionPrice") as HTMLElement)?.innerText ||
        "";
    product.price = parseFloat(priceText.replace(/[^\d.]/g, "")) || null;

    // 涓诲浘 - 鑾峰彇澶у浘URL
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
     * 鑻忓畞鍥剧墖URL杞ぇ鍥?     * 灏嗙缉鐣ュ浘URL杞崲涓哄師濮嬪ぇ鍥綰RL
     * 渚嬪: xxx_400x400.jpg -> xxx.jpg
     */
    const toHDImage = (rawUrl: string): string => {
        if (!rawUrl) return '';
        let url = rawUrl.trim();

        // 纭繚https
        if (url.startsWith('//')) url = 'https:' + url;
        url = url.replace(/^http:/, 'https:');

        // 绉婚櫎鍚勭灏哄鍚庣紑鏍煎紡
        // _200x200.jpg -> .jpg
        url = url.replace(/_\d+x\d+\.(jpg|jpeg|png|webp|gif)/gi, '.$1');
        // _400w_400h_4e.jpg -> .jpg  
        url = url.replace(/_\d+w_\d+h[^.]*\.(jpg|jpeg|png|webp|gif)/gi, '.$1');
        // .w200.h200. -> .
        url = url.replace(/\.w\d+\.h\d+\./g, '.');
        // 绉婚櫎鏌ヨ鍙傛暟
        url = url.replace(/\?.*$/, '');

        return url;
    };

    for (const sel of imageSelectors) {
        doc.querySelectorAll(sel).forEach((img: HTMLImageElement) => {
            // 浼樺厛鐢?data-url (鍘熷浘)
            let rawUrl = img.getAttribute("data-url") ||
                img.getAttribute("data-original") ||
                img.getAttribute("data-src") ||
                img.getAttribute("data-lazy") ||
                img.src || "";

            const url = toHDImage(rawUrl);

            if (url && url.length > 10 && !seen.has(url) && url.includes('suning')) {
                seen.add(url);
                product.images.push(url);
                console.log(`[Suning Pro] 娣诲姞鍥剧墖 #${product.images.length}:`, url.substring(0, 80));
            }
        });
    }

    // 鍙傛暟
    const partNumber = (doc.querySelector("#partNumber") as HTMLInputElement)?.value;
    product.specs = await extractSuningParamsPro(partNumber);

    // SKU澶氳鏍兼暟鎹紙澧炲己鐗?- 鏀块噰浜戝吋瀹规牸寮忥級
    const skuData = await extractSuningSkuData()
    product.skuData = skuData
    product.skuVariants = await extractSuningSkuVariants() // 淇濇寔鍚戝悗鍏煎

    product.url = location.href;
    product.platform = "Suning";

    console.log("[Suning Pro] 閲囬泦缁撴灉:", product.title?.substring(0, 30), "鍥剧墖:", product.images?.length, "鍙傛暟:", Object.keys(product.specs || {}).length);
    return product;
}

// 鑻忓畞鍙傛暟瑙ｆ瀽鎺ュ彛 - 浣跨敤澶╃尗鐨勯〉闈㈡枃鏈彁鍙栨柟寮?async function extractSuningParamsPro(partNumber?: string): Promise<Record<string, string>> {
    const params: Record<string, string> = {};

    console.log('[Suning Pro] 寮€濮嬪弬鏁伴噰闆?..');

    // 鏂规硶1: 鐩存帴浠庨〉闈㈡枃鏈彁鍙栵紙澶╃尗鏂瑰紡锛屾渶鏈夋晥锛?    const pageText = document.body.innerText || '';
    console.log('[Suning Pro] 椤甸潰鏂囨湰闀垮害:', pageText.length);

    // 鑻忓畞甯哥敤鍙傛暟姝ｅ垯
    const labelPatterns: [string, RegExp][] = [
        ['鍝佺墝', /鍝佺墝[锛?\s]*([^\s\n閫夋嫨璐拱鍔犲叆]{2,30})/],
        ['鍨嬪彿', /鍨嬪彿[锛?\s]*([A-Za-z0-9\-\/\s]+)/],
        ['璐у彿', /璐у彿[锛?\s]*([A-Za-z0-9\-\u4e00-\u9fa5]+)/],
        ['浜у湴', /浜у湴[锛?\s]*(涓浗[^\s\n]*|[^\s\n]{2,20})/],
        ['棰滆壊', /棰滆壊[锛?\s]*(鐧借壊|榛戣壊|閾惰壊|绾㈣壊|钃濊壊|鐏拌壊|閲戣壊)/],
        ['瑙勬牸', /瑙勬牸[锛?\s]*([^\s\n]+)/],
        ['閲嶉噺', /閲嶉噺[锛?\s]*([\d.]+[kg鍗冨厠鍏媇+)/i],
        ['灏哄', /灏哄[锛?\s]*([^\s\n]+)/],
        ['鏉愯川', /鏉愯川[锛?\s]*([^\s\n]+)/],
    ];

    // 鍨冨溇璇嶈繃婊?    const garbageWords = ['閫夋嫨', '濂界湅', '涓嶉敊', '鎺ㄨ崘', '鍠滄', '姝ｅ搧', '鍔犲叆', '璐拱', '绔嬪嵆', '鏁呬簨'];

    for (const [label, pattern] of labelPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
            const value = match[1].trim();
            const isGarbage = garbageWords.some(w => value.includes(w));
            if (value.length >= 1 && value.length <= 50 && !isGarbage) {
                params[label] = value;
                console.log(`[Suning Pro] 鏂囨湰鎻愬彇: ${label}=${value}`);
            }
        }
    }

    // 鏂规硶2: 濡傛灉鍝佺墝娌℃彁鍙栧埌锛屼粠鏍囬鎻愬彇
    if (!params['鍝佺墝']) {
        let title = document.querySelector('.proinfo-title, #itemDisplayName')?.textContent?.trim() || '';
        title = title.replace(/^(鑻忓畞瓒呭競|鑷惀)\s*/g, '').trim();  // 鍘绘帀鑷惀鍓嶇紑

        // 甯歌鍝佺墝鍒楄〃鍖归厤 - 鍖呭惈閰掔被鍝佺墝
        const knownBrands = [
            // 閰掔被
            '娲嬫渤', '鑼呭彴', '浜旂伯娑?, '娉稿窞鑰佺獤', '姹鹃厭', '鍓戝崡鏄?, '閮庨厭', '瑗垮嚖閰?, '鍙や簳璐?,
            '姘翠簳鍧?, '鐗涙爮灞?, '绾㈡槦', '姹熷皬鐧?, '涔犻厭', '鍥界獤1573', '闈掕姳閮?, '姊︿箣钃?, '澶╀箣钃?, '娴蜂箣钃?,
            // 鐢靛瓙/鎵嬫満
            '鑱旀兂', 'Lenovo', '鍗庝负', 'HUAWEI', '灏忕背', 'Xiaomi', '涓夋槦', 'Samsung',
            'Apple', '鑻规灉', 'OPPO', 'vivo', '鑽ｈ€€', 'Honor', 'Dell', '鎴村皵', 'HP', '鎯犳櫘',
            'ThinkPad', '鍗庣', 'ASUS', '瀹忕', 'Acer', '寰蒋', 'Microsoft', 'Sony', '绱㈠凹',
            // 瀹剁數
            '娴峰皵', 'Haier', '缇庣殑', 'Midea', '鏍煎姏', 'Gree', '娴蜂俊', 'Hisense', 'TCL',
            '搴蜂匠', 'Konka', '闀胯櫣', 'Changhong', '鍒涚淮', 'Skyworth', '濂ュ厠鏂?, 'AUX',
            // 鍏朵粬
            '椋炲埄娴?, 'Philips', '瑗块棬瀛?, 'Siemens', '鍗氫笘', 'Bosch', '鏉句笅', 'Panasonic'
        ];

        for (const brand of knownBrands) {
            if (title.includes(brand)) {
                params['鍝佺墝'] = brand;
                console.log('[Suning Pro] 浠庢爣棰樺尮閰嶅搧鐗?', brand);
                break;
            }
        }

        // 濡傛灉杩樻病鎵惧埌锛屽皾璇曟鍒欐彁鍙栨爣棰樺紑澶寸殑鍝佺墝
        if (!params['鍝佺墝']) {
            const brandMatch = title.match(/^([\u4e00-\u9fa5]{2,4})/);
            if (brandMatch && !['鑻忓畞', '鑷惀', '姝ｅ搧', '鐗逛环', '鐑崠'].includes(brandMatch[1])) {
                params['鍝佺墝'] = brandMatch[1];
                console.log('[Suning Pro] 浠庢爣棰樻鍒欐彁鍙栧搧鐗?', brandMatch[1]);
            }
        }
    }

    // 鏂规硶3: 鎻愬彇鍨嬪彿锛堜粠鏍囬锛?    if (!params['鍨嬪彿']) {
        const title = document.querySelector('.proinfo-title, #itemDisplayName')?.textContent?.trim() || '';
        // 鍖归厤 520ml, 52搴? 6鐡?绛夎鏍?        const modelMatch = title.match(/(\d+搴\d+ml|\d+鐡秥\d+L|\d+g|\d+kg)/i);
        if (modelMatch) {
            params['鍨嬪彿'] = modelMatch[1].trim();
            console.log('[Suning Pro] 浠庢爣棰樻彁鍙栧瀷鍙?', params['鍨嬪彿']);
        }
    }

    console.log('[Suning Pro] 鏈€缁堝弬鏁?', Object.keys(params).length, '椤?);
    if (Object.keys(params).length > 0) {
        console.log('[Suning Pro] 鏍蜂緥:', Object.entries(params).slice(0, 5));
    }
    return params;
}
