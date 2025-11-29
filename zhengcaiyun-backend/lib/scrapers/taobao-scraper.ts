import puppeteer, { Browser, Page } from 'puppeteer';

export interface TaobaoProductData {
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
 * 爬取淘宝商品详情页完整数据
 * @param productUrl 淘宝商品详情页URL (e.g., https://item.taobao.com/item.htm?id=xxx)
 */
export async function scrapeTaobaoProduct(productUrl: string): Promise<TaobaoProductData> {
    console.log(`[Taobao Scraper] Starting to scrape: ${productUrl}`);

    let browser: Browser | null = null;

    try {
        browser = await launchBrowser();
        const page = await browser.newPage();

        await configureAntiDetection(page);

        console.log(`[Taobao Scraper] Navigating to product page...`);
        await page.goto(productUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await page.waitForTimeout(3000);

        // 提取数据
        const productData = await page.evaluate(() => {
            // 标题
            const titleSelectors = [
                '.tb-detail-hd h1',
                'h1[class*="Title"]',
                '.tb-main-title'
            ];

            let title = '未知商品';
            for (const selector of titleSelectors) {
                const titleEl = document.querySelector(selector) as HTMLElement;
                if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 0) {
                    title = titleEl.textContent.trim();
                    break;
                }
            }

            // 图片
            const images: string[] = [];
            const imgSelectors = [
                '#J_ImgBooth',
                'img[src*="img.alicdn.com"]',
                '.tb-booth-main img',
                'ul[id*="J_UlThumb"] img'
            ];

            imgSelectors.forEach(selector => {
                const imgElements = document.querySelectorAll(selector);
                imgElements.forEach((img) => {
                    let src = img.getAttribute('data-src') || img.getAttribute('src');
                    if (src) {
                        if (src.startsWith('//')) src = 'https:' + src;
                        src = src.replace(/_\d+x\d+\.jpg/, '.jpg');

                        if (!images.includes(src) && src.includes('img.alicdn.com')) {
                            images.push(src);
                        }
                    }
                });
            });

            // 价格
            const priceSelectors = [
                '#J_StrPrice .tb-rmb-num',
                '.tb-rmb-num',
                '[class*="price"] em'
            ];

            let price = '0';
            for (const selector of priceSelectors) {
                const priceEl = document.querySelector(selector) as HTMLElement;
                if (priceEl) {
                    price = priceEl.textContent?.replace(/[^0-9.]/g, '') || '0';
                    if (parseFloat(price) > 0) break;
                }
            }

            // 参数
            const attributes: Record<string, string> = {};
            const paramRows = document.querySelectorAll('#J_AttrUL li, .tb-property-cont li');
            paramRows.forEach(row => {
                const text = row.textContent?.trim() || '';
                const match = text.match(/(.+?)[:：](.+)/);
                if (match) {
                    attributes[match[1].trim()] = match[2].trim();
                }
            });

            // 详情
            let detailHtml = '';
            const detailEl = document.querySelector('#description, .tb-detail-bd') as HTMLElement;
            if (detailEl) {
                detailHtml = detailEl.innerHTML;
            } else {
                detailHtml = '<p>详情加载中...</p>';
            }

            // 店铺
            const shopEl = document.querySelector('.tb-seller-name a, .shop-name') as HTMLElement;
            const shopName = shopEl?.textContent?.trim() || '淘宝店铺';

            return {
                title,
                price,
                images: images.slice(0, 10),
                detailHtml,
                attributes,
                shopName
            };
        });

        console.log(`[Taobao Scraper] Successfully scraped: ${productData.title}`);

        return {
            ...productData,
            skuData: {
                price: productData.price,
                stock: '999',
                specs: productData.attributes
            }
        };

    } catch (error) {
        console.error('[Taobao Scraper] Error:', error);
        throw new Error(`淘宝商品爬取失败: ${(error as Error).message}`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function launchBrowser(): Promise<Browser> {
    const fs = require('fs');
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];

    const executablePath = chromePaths.find((path: string) => fs.existsSync(path));

    return await puppeteer.launch({
        headless: true,
        executablePath: executablePath,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security'
        ]
    });
}

async function configureAntiDetection(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
        (window.navigator as any).chrome = { runtime: {} };
    });

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.taobao.com/'
    });

    await page.setViewport({ width: 1920, height: 1080 });
}
