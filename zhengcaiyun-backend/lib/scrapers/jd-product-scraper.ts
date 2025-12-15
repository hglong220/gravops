import puppeteer, { Browser, Page } from 'puppeteer';
import { buildPuppeteerArgs, resolvePuppeteerExecutablePath } from '@/lib/puppeteer-launch';

export interface JDProductData {
    title: string;
    price: string;
    images: string[];
    detailHtml: string;
    skuData: {
        price: string;
        stock: string;
        specs?: Record<string, string>;
    };
    attributes: Record<string, string>;
    shopName?: string;
}

/**
 * 爬取京东商品详情页完整数据
 * @param productUrl 京东商品详情页URL (e.g., https://item.jd.com/100012043978.html)
 */
export async function scrapeJDProduct(productUrl: string): Promise<JDProductData> {
    console.log(`[JD Scraper] Starting to scrape: ${productUrl}`);

    let browser: Browser | null = null;

    try {
        // 启动浏览器
        browser = await launchBrowser();
        const page = await browser.newPage();

        // 配置反爬虫
        await configureAntiDetection(page);

        // 访问商品页
        console.log(`[JD Scraper] Navigating to product page...`);
        await page.goto(productUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // 等待关键元素加载
        await page.waitForSelector('.sku-name, .itemInfo-wrap', { timeout: 15000 });
        await page
            .waitForSelector('.p-price .price, #priceSale, #J-p-price', { timeout: 8000 })
            .catch(() => undefined);

        // 等待页面内置变量（pageConfig / imageAndVideoJson）尽量就绪，提升图片/价格提取成功率
        await page
            .waitForFunction(
                () =>
                    Boolean((window as any).pageConfig?.product) ||
                    (Array.isArray((window as any).imageAndVideoJson) &&
                        (window as any).imageAndVideoJson.length > 0),
                { timeout: 8000 }
            )
            .catch(() => undefined);

        // 提取数据
        let productData = await page.evaluate(() => {
            const safeText = (el?: Element | null) =>
                (el as HTMLElement | null)?.textContent?.trim() || '';

            // 商品标题（兼容新版/旧版页面）
            const title =
                safeText(document.querySelector('.sku-name')) ||
                safeText(document.querySelector('.itemInfo-wrap h1')) ||
                safeText(document.querySelector('.p-name')) ||
                (document.title || '').split('-')[0]?.trim() ||
                '未知商品';

            const normalizeImageUrl = (raw: string): string | null => {
                let url = String(raw || '').trim();
                if (!url) return null;

                // 过滤占位/无效
                if (url.startsWith('data:')) return null;
                if (url === 'about:blank') return null;

                // 补全协议/路径
                if (url.startsWith('//')) url = `https:${url}`;
                if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/n1${url}`;
                if (url.startsWith('/jfs')) url = `https://img10.360buyimg.com/n1/${url.replace(/^\/+/, '')}`;
                if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/n1/${url}`;
                if (url.startsWith('jfs')) url = `https://img10.360buyimg.com/n1/${url}`;

                if (url.startsWith('/')) {
                    try {
                        url = new URL(url, window.location.origin).toString();
                    } catch {
                        // ignore
                    }
                }

                // 尽量替换为高清大图
                url = url
                    .replace('/n5/', '/n1/')
                    .replace('/n7/', '/n1/')
                    .replace('/n9/', '/n1/')
                    .replace('/s54x54_jfs/', '/n1/')
                    .replace('/s60x60_jfs/', '/n1/');

                // 只保留京东图片 CDN
                if (!url.includes('360buyimg.com')) return null;

                return url;
            };

            // 图片列表（优先使用页面内置 JSON，其次 DOM 兜底）
            const images: string[] = [];
            const seen = new Set<string>();
            const push = (raw?: string | null) => {
                if (!raw) return;
                const normalized = normalizeImageUrl(raw);
                if (!normalized) return;
                if (normalized.includes('avatar') || normalized.includes('icon')) return;
                if (seen.has(normalized)) return;
                seen.add(normalized);
                images.push(normalized);
            };

            const anyWin = window as any;
            if (Array.isArray(anyWin.imageAndVideoJson)) {
                for (const item of anyWin.imageAndVideoJson) {
                    if (!item) continue;
                    if (item.type !== undefined && item.type !== 1) continue;
                    push(item.img || item.imgUrl || item.url);
                }
            }

            // JSON-LD 兜底（部分页面会在 ld+json 里提供 image 列表）
            const ldScripts = Array.from(
                document.querySelectorAll('script[type="application/ld+json"]')
            ) as HTMLScriptElement[];
            for (const s of ldScripts) {
                const txt = s.textContent?.trim();
                if (!txt) continue;
                try {
                    const parsed = JSON.parse(txt);
                    const nodes = Array.isArray(parsed) ? parsed : [parsed];
                    for (const node of nodes) {
                        const imgs = (node as any)?.image;
                        if (typeof imgs === 'string') push(imgs);
                        if (Array.isArray(imgs)) imgs.forEach((u) => push(u));
                    }
                } catch {
                    // ignore
                }
            }

            const imgElements = document.querySelectorAll(
                '#spec-list img, #spec-n1 img, .spec-items img, .lh img, #spec-img'
            ) as NodeListOf<HTMLImageElement>;
            imgElements.forEach((img) => {
                const raw =
                    img.getAttribute('data-origin') ||
                    img.getAttribute('data-url') ||
                    img.getAttribute('data-src') ||
                    img.getAttribute('data-lazy-img') ||
                    img.getAttribute('data-lazyload') ||
                    img.getAttribute('src');
                push(raw);
            });

            // 价格：先尝试 pageConfig，其次 DOM 取值
            const rawPrice =
                anyWin?.pageConfig?.product?.price ||
                anyWin?.pageConfig?.product?.p ||
                safeText(document.querySelector('.p-price .price')) ||
                safeText(document.querySelector('.p-price [class*="price"]')) ||
                safeText(document.querySelector('#priceSale')) ||
                safeText(document.querySelector('#J-p-price')) ||
                safeText(document.querySelector('meta[itemprop="price"]')) ||
                '';

            const price =
                String(rawPrice || '')
                    .replace(/[^\d.]/g, '')
                    .trim() || '0';

            // 商品参数
            const attributes: Record<string, string> = {};
            const paramRows = document.querySelectorAll('#parameter-brand li, .parameter2 li, .Ptable-item');
            paramRows.forEach(row => {
                const text = row.textContent?.trim() || '';
                const match = text.match(/(.+?)[:：](.+)/);
                if (match) {
                    attributes[match[1].trim()] = match[2].trim();
                }
            });

            // 详情HTML (通常在iframe中,这里先获取主体描述)
            const detailEl = document.querySelector('#J-detail-content, .detail-content, #detail') as HTMLElement;
            let detailHtml = detailEl?.innerHTML || '';

            // 如果详情为空,尝试获取商品介绍
            if (!detailHtml) {
                const introEl = document.querySelector('.product-intro, .p-parameter') as HTMLElement;
                detailHtml = introEl?.innerHTML || '<p>详情加载中...</p>';
            }

            return {
                title,
                price,
                images: images.slice(0, 10), // 最多10张图
                detailHtml,
                attributes
            };
        });

        // 价格兜底：部分页面 DOM/变量抓不到时，尝试走 JD 公开价格接口
        if (!productData.price || productData.price === '0') {
            const skuId = extractJdSkuId(productUrl);
            if (skuId) {
                const apiPrice = await fetchJdPrice(skuId);
                if (apiPrice) {
                    productData = { ...productData, price: apiPrice };
                }
            }
        }

        // 获取库存信息 (可能需要额外API调用)
        const stock = await getJDStock(page, productUrl);

        console.log(`[JD Scraper] Successfully scraped: ${productData.title}`);

        return {
            ...productData,
            skuData: {
                price: productData.price,
                stock: stock || '999',
                specs: productData.attributes
            },
            shopName: '京东自营'
        };

    } catch (error) {
        console.error('[JD Scraper] Error:', error);
        throw new Error(`京东商品爬取失败: ${(error as Error).message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

/**
 * 启动浏览器(复用crawler.ts中的Chrome查找逻辑)
 */
async function launchBrowser(): Promise<Browser> {
    const executablePath = resolvePuppeteerExecutablePath();
    if (!executablePath) {
        console.warn('[JD Scraper] Chrome not found, using default');
    }

    return await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        timeout: 60000,
        args: [
            ...buildPuppeteerArgs()
        ]
    });
}

/**
 * 配置反爬虫检测
 */
async function configureAntiDetection(page: Page): Promise<void> {
    // 隐藏webdriver (Stealth plugin handles this mostly, but double check doesn't hurt)
    // await page.evaluateOnNewDocument(() => { ... }); // Removed as Stealth plugin covers it better

    // 设置User-Agent
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    // 设置额外请求头
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Referer': 'https://www.jd.com/',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-platform': '"Windows"'
    });

    // 设置视口
    await page.setViewport({ width: 1920, height: 1080 });
}

function extractJdSkuId(productUrl: string): string | null {
    const m = String(productUrl || '').match(/\/(\d+)\.html/i);
    return m ? m[1] : null;
}

async function fetchJdPrice(skuId: string): Promise<string | null> {
    try {
        const url = `https://p.3.cn/prices/mgets?skuIds=J_${encodeURIComponent(skuId)}`;
        const res = await fetch(url, {
            headers: {
                'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                Accept: 'application/json,text/plain,*/*',
                Referer: 'https://item.jd.com/'
            },
            cache: 'no-store'
        });
        if (!res.ok) return null;

        const data = (await res.json().catch(() => null)) as any;
        const item = Array.isArray(data) ? data[0] : null;
        const p = item?.p || item?.op || item?.m;
        if (typeof p !== 'string') return null;
        const cleaned = p.trim();
        return cleaned ? cleaned : null;
    } catch {
        return null;
    }
}

/**
 * 获取库存信息(简化版)
 */
async function getJDStock(page: Page, productUrl: string): Promise<string> {
    try {
        // 尝试从页面获取库存状态
        const stockText = await page.evaluate(() => {
            const stockEl = document.querySelector('.stock-txt, .J-stock') as HTMLElement;
            return stockEl?.textContent?.trim() || '';
        });

        if (stockText.includes('无货') || stockText.includes('缺货')) {
            return '0';
        }

        // 默认认为有货（发布常用默认库存）
        return '99';
    } catch (error) {
        console.warn('[JD Scraper] Failed to get stock, using default');
        return '99';
    }
}
