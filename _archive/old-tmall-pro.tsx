// ================= 澶╃尗 Pro 閲囬泦寮曟搸 =================
// 涓嶅厑璁镐慨鏀规斂閲囦簯鐩稿叧浠ｇ爜锛屾涓虹嫭绔嬫柊澧炴枃浠?// 閲囩敤3灞傞噰闆嗙瓥鐣ワ細1.涓讳笘鐣岃剼鏈?2.Script鏍囩瑙ｆ瀽 3.DOM鍏滃簳

// 瀵煎叆SKU澶氳鏍奸噰闆嗘ā鍧楋紙澧炲己鐗堬級
import { extractTmallSkuData, extractTmallSkuVariants } from './sku.tmall'

// 缂撳瓨涓讳笘鐣岃剼鏈紶鏉ョ殑鏁版嵁
let cachedMainWorldData: Record<string, string> | null = null;

// 鐩戝惉涓讳笘鐣岃剼鏈殑娑堟伅
if (typeof window !== 'undefined') {
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'ECOMMERCE_PRODUCT_DATA' && event.data?.platform === 'Tmall') {
            console.log('[Tmall Pro] 鏀跺埌涓讳笘鐣屾暟鎹?', Object.keys(event.data.params || {}).length, '椤瑰弬鏁?);
            cachedMainWorldData = event.data.params || {};
        }
    });
}

export async function scrapeTmallPro(): Promise<any> {
    const doc = document;
    const product: any = {};

    // 鏍囬 - 浼樺厛绾ф柟寮忚幏鍙?    product.title = getTmallTitle(doc);

    // 浠锋牸
    product.price = getTmallPrice(doc);

    // 涓诲浘 - 澶氱鏂瑰紡鑾峰彇
    product.images = getTmallImages(doc);

    // 鍙傛暟 - 3灞傜瓥鐣?    product.specs = await extractTmallParamsLayered();

    // SKU澶氳鏍兼暟鎹紙澧炲己鐗?- 鏀块噰浜戝吋瀹规牸寮忥級
    const skuData = await extractTmallSkuData()
    product.skuData = skuData
    product.skuVariants = await extractTmallSkuVariants() // 淇濇寔鍚戝悗鍏煎

    product.url = location.href;
    product.platform = "Tmall";

    console.log("[Tmall Pro] 閲囬泦缁撴灉:", product.title?.substring(0, 30), "鍥剧墖:", product.images?.length, "鍙傛暟:", Object.keys(product.specs || {}).length);
    return product;
}

// 鐩存帴浠庨〉闈㈡枃鏈彁鍙栧弬鏁?async function extractTmallParamsLayered(): Promise<Record<string, string>> {
    let params: Record<string, string> = {};

    console.log('[Tmall Pro] 寮€濮嬪弬鏁版彁鍙?..');

    // 鏈€鏈夋晥鐨勬柟娉曪細鐩存帴浠庢暣涓〉闈㈡枃鏈腑鎻愬彇锛?    const pageText = document.body.innerText || '';
    console.log('[Tmall Pro] 椤甸潰鏂囨湰闀垮害:', pageText.length);

    // 澶╃尗甯哥敤鐨勫弬鏁版爣绛?- 鏇寸簿纭殑姝ｅ垯 (澧炲姞鏇村)
    const labelPatterns: [string, RegExp][] = [
        ['鍝佺墝', /鍝佺墝[锛?\s]*([^\s\n閫夋嫨骞存湀鏃{2,30})/],
        ['璐у彿', /璐у彿[锛?\s]*([A-Za-z0-9\-\u4e00-\u9fa5]+)/],
        ['浜у湴', /浜у湴[锛?\s]*(涓浗[^\s\n]*|[^\s\n]{2,20})/],
        ['鏉愯川', /鏉愯川[锛?\s]*([^\s\n]{2,20})/],
        ['瑙勬牸', /瑙勬牸[锛?\s]*([^\s\n]+)/],
        ['閲嶉噺', /閲嶉噺[锛?\s]*([\d.]+[kg鍗冨厠鍏媇+)/i],
        ['椋庢牸', /椋庢牸[锛?\s]*([^\s\n]+)/],
        ['闈㈡枡', /闈㈡枡[锛?\s]*([^\s\n]+)/],
        ['瀛ｈ妭', /瀛ｈ妭[锛?\s]*([^\s\n]+)/],
        ['鍥炬', /鍥炬[锛?\s]*([^\s\n]+)/],
        // 鏂板鏇村鍖归厤
        ['閫傜敤鑼冨洿', /閫傜敤鑼冨洿[锛?\s]*([^\s\n]+)/],
        ['鏄惁閲忚穿瑁?, /鏄惁閲忚穿瑁匸锛?\s]*([^\s\n]+)/],
        ['娲楄。娑插姛鏁?, /娲楄。娑插姛鏁圼锛?\s]*([^\s\n]+)/],
        ['瑙勬牸绫诲瀷', /瑙勬牸绫诲瀷[锛?\s]*([^\s\n]+)/],
        ['鎵ц鏍囧噯', /鎵ц鏍囧噯[锛?\s]*([^\s\n]+)/],
        ['娲绘€х墿鍚噺', /娲绘€х墿鍚噺[锛?\s]*([^\s\n]+)/],
        ['鐡跺彛璁捐绫诲瀷', /鐡跺彛璁捐绫诲瀷[锛?\s]*([^\s\n]+)/],
        ['璁′环鍗曚綅', /璁′环鍗曚綅[锛?\s]*([^\s\n]+)/],
        ['鍖呰绉嶇被', /鍖呰绉嶇被[锛?\s]*([^\s\n]+)/],
        ['鍘绘薄鑼冨洿', /鍘绘薄鑼冨洿[锛?\s]*([^\s\n]+)/],
        ['閰舵坊鍔犵绫?, /閰舵坊鍔犵绫籟锛?\s]*([^\s\n]+)/],
        ['鏄惁娴撶缉', /鏄惁娴撶缉[锛?\s]*([^\s\n]+)/],
        ['娆惧紡', /娆惧紡[锛?\s]*([^\s\n]+)/],
        ['棣欏懗鎸佷箙搴?, /棣欏懗鎸佷箙搴锛?\s]*([^\s\n]+)/],
        ['鏍稿績鍔熸晥', /鏍稿績鍔熸晥[锛?\s]*([^\s\n]+)/],
        ['鍑€鍚噺', /鍑€鍚噺[锛?\s]*([\d.]+[gGmlL姣崌鍗冨厠]+)/],
        ['淇濊川鏈?, /淇濊川鏈焄锛?\s]*([^\s\n]+)/],
        ['鎴愬垎', /鎴愬垎[锛?\s]*([^\s\n]+)/],
    ];

    // 璇勪环绫诲瀮鍦捐瘝
    const garbageWords = ['閫夋嫨', '濂界湅', '涓嶉敊', '寰堝ソ', '鎺ㄨ崘', '鍊煎緱', '鍠滄', '姝ｅ搧',
        '鎵胯', '璐拱', '鏀惧績', '閫€鎹㈣揣', '鏃犵悊鐢?, '鏈煡', '绠€绾︾幇浠?];

    for (const [label, pattern] of labelPatterns) {
        const match = pageText.match(pattern);
        if (match && match[1]) {
            const value = match[1].trim();
            const isGarbage = garbageWords.some(w => value.includes(w));
            if (value.length >= 1 && value.length <= 50 && !isGarbage &&
                !value.includes('璇勪环') && !value.includes('璇烽€夋嫨') && !value.includes('鏀惰棌')) {
                params[label] = value;
                console.log(`[Tmall Pro] 鎵惧埌: ${label}=${value}`);
            }
        }
    }

    // 濡傛灉鐩存帴鎻愬彇涓嶅锛屽皾璇曚粠涓讳笘鐣屾暟鎹?    if (Object.keys(params).length < 3 && cachedMainWorldData) {
        Object.entries(cachedMainWorldData).forEach(([k, v]) => {
            if (!params[k] && isValidSpec(k, v)) params[k] = v;
        });
    }

    console.log('[Tmall Pro] 鏈€缁堝弬鏁?', Object.keys(params).length, '椤?);
    if (Object.keys(params).length > 0) {
        console.log('[Tmall Pro] 鏍蜂緥:', Object.entries(params).slice(0, 5));
    }
    return params;
}

// 鏀块噰浜戞柟娉曪細鐐瑰嚮瑙勬牸Tab骞剁瓑寰呭鍣?async function clickSpecTabAndWaitTmall(): Promise<Element | null> {
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
            if ((text.includes('瑙勬牸') || text.includes('鍙傛暟') || text.includes('灞炴€?)) &&
                text.length < 20 && !text.includes('璇勪环')) {
                console.log('[Tmall Pro] 鐐瑰嚮Tab:', text);
                (tab as HTMLElement).click();
                clickedTab = tab;
                break;
            }
        }
        if (clickedTab) break;
    }

    if (!clickedTab) {
        console.log('[Tmall Pro] 鏈壘鍒拌鏍糡ab锛屽皾璇曟粴鍔?);
        window.scrollTo({ top: document.body.scrollHeight * 0.4, behavior: 'smooth' });
    }

    await sleep(1000);
    return waitForSpecContainerTmall();
}

// 鏀块噰浜戞柟娉曪細绛夊緟瑙勬牸瀹瑰櫒
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
                    const hasLabelValue = text.includes('鍝佺墝') || text.includes('鍨嬪彿');

                    if (hasRows || hasLabelValue) {
                        console.log('[Tmall Pro] 鎵惧埌瑙勬牸瀹瑰櫒:', sel);
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

// 鏀块噰浜戞柟娉曪細浠庡鍣ㄦ彁鍙栧弬鏁?function extractParamsFromContainerTmall(container: Element): Record<string, string> {
    const params: Record<string, string> = {};
    const seen = new Set<string>();

    // 鏂瑰紡1: li鏍煎紡锛堝ぉ鐚富瑕佹牸寮忥級
    container.querySelectorAll('li').forEach(li => {
        const text = li.textContent?.trim() || '';
        const match = text.match(/^([^锛?]{2,12})[锛?](.+)$/);
        if (match) {
            const label = cleanLabelTmall(match[1]);
            const value = match[2].trim();
            if (label && value && !seen.has(label) && isValidSpec(label, value)) {
                seen.add(label);
                params[label] = value;
            }
        }
    });

    // 鏂瑰紡2: span鏍煎紡
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
    return raw.replace(/[锛?锛歕s]/g, '').trim();
}


// 浠嶴cript鏍囩瑙ｆ瀽Tmall鍙傛暟
function extractTmallParamsFromScripts(): Record<string, string> {
    const params: Record<string, string> = {};
    const scripts = document.querySelectorAll('script:not([src])');

    for (const script of scripts) {
        const text = script.textContent || '';

        // 鏌ユ壘澶╃尗鐗规湁鐨勬暟鎹粨鏋?        if (text.includes('__INIT_DATA__') || text.includes('__GLOBAL_DATA__') ||
            text.includes('itemDO') || text.includes('props')) {

            // 灏濊瘯鎻愬彇鍙傛暟鍒楄〃
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
                            // 澶勭悊瀵硅薄鏍煎紡鐨?itemParams
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

// 杩囨护闈炶鏍煎弬鏁扮殑閿悕鍜屽€?function isValidSpec(key: string, value: string): boolean {
    // 鎺掗櫎鐨勯敭鍚嶅叧閿瘝锛堜績閿€銆佺墿娴併€佽喘涔拌褰曠瓑锛?    const invalidKeywords = [
        '浠锋牸', '淇冮攢', '浼樻儬', '婊″噺', '棰嗗埜', '绾㈠寘', '鎶樻墸',
        '鍙戣揣', '閰嶉€?, '閫佽揪', '杩愯垂', '蹇€?, '鐗╂祦', '鍖呴偖',
        '宸茶喘', '宸蹭拱', '璐拱', '涓嬪崟', '浠樻', '鏀粯',
        '璇勪环', '濂借瘎', '宸瘎', '鏅掑崟', '杩借瘎', '璇勮',
        '鏀惰棌', '鍏虫敞', '鍒嗕韩', '闂瓟', '鍜ㄨ',
        '搴撳瓨', '鏁伴噺', '浠?, '鏈堥攢', '閿€閲?,
        '寮傚父', '闂', '鎻愮ず', '璇存槑', '椤荤煡', '娉ㄦ剰',
        '閫夋嫨', '璇烽€夋嫨', '鍙€?, '榛樿',
        '鏈嶅姟', '淇濋殰', '鎵胯', '閫€鎹?, '淇濅慨'
    ];

    // 鎺掗櫎鐨勫€煎叧閿瘝
    const invalidValueKeywords = [
        '鍟嗗搧璇︽儏', '淇冮攢淇℃伅', '璇蜂互', '鍏蜂綋', '涓哄噯',
        '鐐瑰嚮鏌ョ湅', '浜嗚В鏇村', '鏌ョ湅璇︽儏',
        '閫夋嫨鍚?, '璇锋偍', '鎮ㄥ彲浠?, '濡傛湁鐤戦棶',
        '鏀惰棌', '鏃犲紓鍛?
    ];

    // 妫€鏌ラ敭鍚?    for (const kw of invalidKeywords) {
        if (key.includes(kw)) {
            return false;
        }
    }

    // 妫€鏌ュ€?    for (const kw of invalidValueKeywords) {
        if (value.includes(kw)) {
            return false;
        }
    }

    // 妫€鏌ラ敭鍚嶉暱搴?    if (key.length < 2 || key.length > 15) {
        return false;
    }

    // 妫€鏌ュ€奸暱搴?    if (value.length > 100) {
        return false;
    }

    // 妫€鏌ユ槸鍚﹀寘鍚棩鏈熸牸寮忥紙璐拱璁板綍锛?    if (/\d{4}-\d{2}-\d{2}/.test(key)) {
        return false;
    }

    return true;
}


// 澶╃尗鏍囬鎻愬彇
function getTmallTitle(doc: Document): string {
    const selectors = [
        // 鏂扮増澶╃尗
        '[class*="mainTitle"]',
        '[class*="ItemHeader--mainTitle"]',
        '.ItemHeader--mainTitle--',
        // 鑰佺増澶╃尗
        ".tb-detail-hd h1",
        ".tb-main-title",
        // 閫氱敤
        "h1.title",
        "h1",
        ".product-title",
        // JSON-LD (SEO鏁版嵁)
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

    // Fallback: 椤甸潰鏍囬
    return doc.title.split(/[-|鈥撯€擼/)[0].replace(/澶╃尗|娣樺疂|Tmall/gi, '').trim();
}

// 澶╃尗浠锋牸鎻愬彇
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

    // 姝ｅ垯浠庨〉闈㈡彁鍙?    const bodyText = doc.body.innerText || '';
    const priceMatch = bodyText.match(/[楼锟\s*([\d,]+\.?\d*)/);
    if (priceMatch) {
        return parseFloat(priceMatch[1].replace(/,/g, '')) || null;
    }

    return null;
}

// 澶╃尗鍥剧墖鎻愬彇
function getTmallImages(doc: Document): string[] {
    const images: string[] = [];
    const seen = new Set<string>();

    console.log('[Tmall Pro] 寮€濮嬪浘鐗囬噰闆?..');

    const addImage = (src: string, source: string = '') => {
        if (!src) return;

        let hdSrc = src;

        // 鍙Щ闄ゅ昂瀵稿悗缂€锛屼繚鐣欏畬鏁碪RL
        // 渚嬪: xxx_60x60q90.jpg -> xxx.jpg
        // 渚嬪: xxx_100x100.jpg -> xxx.jpg
        hdSrc = hdSrc.replace(/_\d+x\d+q?\d*\.(jpg|jpeg|png|webp|gif)/gi, '.$1');
        hdSrc = hdSrc.replace(/_\d+x\d+\.(jpg|jpeg|png|webp|gif)/gi, '.$1');

        // 绉婚櫎 .jpg_.webp 杩欑鍙屽悗缂€
        hdSrc = hdSrc.replace(/\.(jpg|jpeg|png)_\.webp$/i, '.$1');
        hdSrc = hdSrc.replace(/\.(jpg|jpeg|png)_.webp$/i, '.$1');

        // 纭繚鏄痟ttps
        if (hdSrc.startsWith('//')) hdSrc = 'https:' + hdSrc;

        // 楠岃瘉URL瀹屾暣鎬?        if (!hdSrc.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/i)) {
            console.log('[Tmall Pro] 璺宠繃涓嶅畬鏁碪RL:', hdSrc.substring(0, 50));
            return;
        }

        // 鏀惧鍩熷悕闄愬埗
        const isTmallImage = hdSrc.includes('alicdn.com') || hdSrc.includes('tbcdn.cn') || hdSrc.includes('tmall.com') || hdSrc.includes('taobao.com');
        if (!seen.has(hdSrc) && isTmallImage) {
            seen.add(hdSrc);
            images.push(hdSrc);
            console.log(`[Tmall Pro] 鎵惧埌鍥剧墖 #${images.length} [${source}]:`, hdSrc.substring(0, 80));
        }
    };

    // 鏂扮増澶╃尗鍥剧墖閫夋嫨鍣?    const selectors = [
        // 鏂扮増涓诲浘鍖哄煙
        '[class*="PicGallery"] img',
        '[class*="picGallery"] img',
        '[class*="sliderMain"] img',
        // 缂╃暐鍥?        '[class*="thumbnail"] img',
        '[class*="Thumbnail"] img',
        // 鑰佺増澶╃尗
        '#J_UlThumb img',
        '.tb-thumb img',
        '.tb-gallery img',
        '.main-image img',
        // 閫氱敤
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

    // Fallback: 浠庨〉闈S鍙橀噺鑾峰彇
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

    // Fallback: 鎵弿鎵€鏈塧licdn鍥剧墖锛堟斁瀹芥潯浠讹級
    if (images.length === 0) {
        console.log('[Tmall Pro] 浣跨敤鍏ㄩ〉鎵弿鍏滃簳...');
        const allImgs = doc.querySelectorAll('img');
        console.log('[Tmall Pro] 椤甸潰鍏辨湁鍥剧墖:', allImgs.length);

        allImgs.forEach((img: HTMLImageElement) => {
            const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || '';
            // 鏀惧鏉′欢锛氬彧瑕佹槸alicdn/tbcdn鍥剧墖
            if ((src.includes('alicdn.com') || src.includes('tbcdn.cn')) && !src.includes('icon') && !src.includes('logo') && !src.includes('avatar')) {
                addImage(src, 'fallback-scan');
            }
        });
    }

    // 鏈€鍚庡厹搴曪細浠庢墍鏈夊厓绱犵殑 data-* 灞炴€т腑鎻愬彇
    if (images.length === 0) {
        console.log('[Tmall Pro] 浣跨敤灞炴€ф壂鎻忓厹搴?..');
        doc.querySelectorAll('[data-src], [data-lazy-src], [data-ks-lazyload]').forEach((el) => {
            const src = el.getAttribute('data-src') || el.getAttribute('data-lazy-src') || el.getAttribute('data-ks-lazyload') || '';
            if (src.includes('alicdn.com') || src.includes('tbcdn.cn')) {
                addImage(src, 'attr-scan');
            }
        });
    }

    console.log('[Tmall Pro] 鏈€缁堝浘鐗囨暟閲?', images.length);
    return images.slice(0, 15);
}

// 澶╃尗鍙傛暟瑙ｆ瀽
function extractTmallParamsPro(): Record<string, string> {
    const params: Record<string, string> = {};

    console.log('[Tmall Pro] 寮€濮嬪弬鏁伴噰闆?..');

    try {
        const win = window as any;
        console.log('[Tmall Pro] 妫€鏌ュ叏灞€鍙橀噺...');
        console.log('[Tmall Pro] __INIT_DATA__瀛樺湪:', !!win.__INIT_DATA__);
        console.log('[Tmall Pro] __GLOBAL_DATA__瀛樺湪:', !!win.__GLOBAL_DATA__);
        console.log('[Tmall Pro] g_config瀛樺湪:', !!win.g_config);

        // 浠庡叏灞€鍙橀噺鑾峰彇
        const init = win.__INIT_DATA__ || win.__GLOBAL_DATA__ || win.g_config || win.g_page_config;

        if (init) {
            console.log('[Tmall Pro] 鍏ㄥ眬鏁版嵁閿?', Object.keys(init).slice(0, 10));
        }

        // 灏濊瘯澶氱璺緞
        const itemParams =
            init?.moduleData?.itemDO?.itemParams ||
            init?.itemDO?.itemParams ||
            init?.props ||
            init?.attributesMap ||
            init?.data?.itemInfoModel?.props;

        if (itemParams) {
            console.log('[Tmall Pro] 鎵惧埌itemParams:', typeof itemParams);
        }

        // props
        if (itemParams?.props) {
            console.log('[Tmall Pro] 浠巔rops鎻愬彇:', itemParams.props.length);
            itemParams.props.forEach((p: any) => {
                if (p?.name) params[p.name.trim()] = p.value?.trim() || "";
            });
        }

        // attrs
        if (itemParams?.attrs) {
            console.log('[Tmall Pro] 浠巃ttrs鎻愬彇:', itemParams.attrs.length);
            itemParams.attrs.forEach((p: any) => {
                if (p?.name) params[p.name.trim()] = p.value?.trim() || "";
            });
        }

        // 鐩存帴鏁扮粍鏍煎紡
        if (Array.isArray(itemParams)) {
            console.log('[Tmall Pro] itemParams鏄暟缁?', itemParams.length);
            itemParams.forEach((p: any) => {
                if (p?.name) params[p.name.trim()] = p.value?.trim() || "";
            });
        }
    } catch (e) {
        console.warn('[Tmall Pro] 鍏ㄥ眬鍙橀噺瑙ｆ瀽澶辫触:', e);
    }

    // DOM 琛ュ厖 - 鏂扮増澶╃尗
    console.log('[Tmall Pro] 寮€濮婦OM鎵弿...');
    const domSelectors = [
        // 鏂扮増灞炴€у尯鍩?        '[class*="Attributes"] li',
        '[class*="attributes"] li',
        '[class*="ItemAttributes"] li',
        '[class*="Props"] li',
        // 鑰佺増
        '#J_AttrUL li',
        '#J_AttrList li',
        '.attributes-list li',
        '.tb-attributes li',
        // 鏇村灏濊瘯
        '.tm-clear li',
        '#attributes li',
        'ul.attributes li'
    ];

    for (const sel of domSelectors) {
        try {
            const elements = document.querySelectorAll(sel);
            if (elements.length > 0) {
                console.log(`[Tmall Pro] 閫夋嫨鍣?"${sel}" 鎵惧埌 ${elements.length} 涓厓绱燻);
            }
            elements.forEach((li) => {
                const txt = (li as HTMLElement).innerText?.trim() || "";
                const match = txt.match(/^(.+?)[锛?](.+)$/);
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

    // 鏂瑰紡3: 寮哄姏鏂囨湰妯″紡鎻愬彇锛堜粠椤甸潰鍏ㄦ枃锛?    console.log('[Tmall Pro] 灏濊瘯浠庨〉闈㈡枃鏈彁鍙?..');
    const bodyText = document.body.innerText || '';

    // 甯歌鍟嗗搧鍙傛暟鍚嶇О鍒楄〃
    const commonParams = [
        '鍝佺墝', '鍨嬪彿', '浜у湴', '鏉愯川', '棰滆壊', '灏哄', '閲嶉噺', '鍖呰',
        '璐у彿', '娆惧紡', '閫傜敤浜虹兢', '閫傜敤鍦烘櫙', '闈㈡枡', '鍔熻兘',
        '鐢熶骇鏃ユ湡', '淇濊川鏈?, '瑙勬牸', '绫诲瀷', '绯诲垪', '涓婂競鏃堕棿',
        '鍟嗗搧鍚嶇О', '鍟嗗搧缂栧彿', '鍟嗗搧姣涢噸', '鍟嗗搧浜у湴',
        '鑳芥晥绛夌骇', '鍔熺巼', '瀹归噺', '鐗堟湰', '瀛樺偍', '鍐呭瓨',
        '灞忓箷', '鍒嗚鲸鐜?, '鍒锋柊鐜?, '澶勭悊鍣?, '鏄惧崱',
        '灞忓箷灏哄', '椋庢牸', '鍥炬', '褰㈢姸', '鍘氬害'
    ];

    for (const paramName of commonParams) {
        if (params[paramName]) continue;

        // 灏濊瘯澶氱鍒嗛殧绗︽牸寮?        const patterns = [
            new RegExp(`${paramName}[锛?锛歖\\s*([^\\n\\r\\t]+)`, 'i'),
            new RegExp(`${paramName}\\s*[锛?锛歖\\s*([^\\n\\r\\t]+)`, 'i'),
            new RegExp(`銆?{paramName}銆慭\s*([^\\n\\r銆怾+)`, 'i'),
        ];

        for (const pattern of patterns) {
            const match = bodyText.match(pattern);
            if (match && match[1]) {
                const value = match[1].trim();
                // 杩囨护鎺夊お闀挎垨鐪嬭捣鏉ヤ笉鍍忓€肩殑鍐呭
                if (value.length > 1 && value.length < 100 && !value.includes('鏆傛棤') && !value.includes('undefined')) {
                    params[paramName] = value.substring(0, 50);
                    console.log(`[Tmall Pro] 浠庢枃鏈彁鍙? ${paramName} = ${value.substring(0, 30)}`);
                    break;
                }
            }
        }
    }

    // 鏂瑰紡4: 鎵弿鎵€鏈夊寘鍚啋鍙风殑鏂囨湰锛堟渶鍚庡厹搴曪級
    if (Object.keys(params).length < 3) {
        console.log('[Tmall Pro] 浣跨敤鍐掑彿鎵弿鍏滃簳...');
        const lines = bodyText.split(/[\n\r]/);
        for (const line of lines) {
            const colonMatch = line.match(/^([^锛?]{2,15})[锛?]([^锛?]{2,80})$/);
            if (colonMatch) {
                const key = colonMatch[1].trim();
                const val = colonMatch[2].trim();
                if (key && val && !params[key] &&
                    !key.includes('璇勪环') && !key.includes('璐拱') && !key.includes('濂借瘎') &&
                    !key.includes('鍥剧墖') && !key.includes('鐐瑰嚮') && !key.includes('鏌ョ湅') &&
                    !key.includes('閫夋嫨') && !key.includes('鏁伴噺') &&
                    Object.keys(params).length < 20) {
                    params[key] = val.substring(0, 50);
                }
            }
        }
    }

    console.log('[Tmall Pro] 鍙傛暟閲囬泦:', Object.keys(params).length, '椤?);
    if (Object.keys(params).length > 0) {
        console.log('[Tmall Pro] 鍙傛暟鏍蜂緥:', Object.entries(params).slice(0, 5));
    }
    return params;
}

