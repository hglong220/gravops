import puppeteer, { Browser, Page } from 'puppeteer';

export interface SuningProductData {
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
 * 爬取苏宁商品详情页完整数据
 * @param productUrl 苏宁商品详情页URL (e.g., https://product.suning.com/xxx/xxx.html)
 */
export async function scrapeSuningProduct(productUrl: string): Promise<SuningProductData> {
    console.log(`[Suning Scraper] Starting to scrape: ${productUrl}`);

    let browser: Browser | null = null;

    try {
        browser = await launchBrowser();
        const page = await browser.newPage();

        await configureAntiDetection(page);

        console.log(`[Suning Scraper] Navigating to product page...`);
        await page.goto(productUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await page.waitForTimeout(2000);

        const productData = await page.evaluate(() => {
            // 标题
            const titleSelectors = [
                '.proinfo-title',
                'h1.product-name',
                '.itemDisplayName'
            ];

            let title = '未知商品';
            for (const selector of titleSelectors) {
                const titleEl = document.querySelector(selector) as HTMLElement;
                if (titleEl && titleEl.textContent) {
                    title = titleEl.textContent.trim();
                    break;
                }
            }

            // 图片
            const images: string[] = [];
            const imgSelectors = [
                '#imageZoom img',
                '.imgzoom-thumb-main img',
                'img[id*="bigImg"]',
                'ul.imgzoom-thumb li img'
            ];

            imgSelectors.forEach(selector => {
                const imgElements = document.querySelectorAll(selector);
                imgElements.forEach((img) => {
                    let src = img.getAttribute('src') ||
                        img.getAttribute('data-src') ||
                        img.getAttribute('src-large');

                    if (src) {
                        if (src.startsWith('//')) src = 'https:' + src;
                        // 替换为高清大图
                        src = src.replace(/_[0-9]+x[0-9]+_/, '_800x800_');

                        if (!images.includes(src) &&
                            (src.includes('suning.cn') || src.includes('suning.com'))) {
                            images.push(src);
                        }
                    }
                });
            });

            // 价格
            const priceSelectors = [
                '#J-summary-promo .mainprice',
                '.price-box .mainprice',
                'em.price-num'
            ];

            let price = '0';
            for (const selector of priceSelectors) {
                const priceEl = document.querySelector(selector) as HTMLElement;
                if (priceEl) {
                    const priceText = priceEl.textContent?.replace(/[^0-9.]/g, '') || '0';
                    if (parseFloat(priceText) > 0) {
                        price = priceText;
                        break;
                    }
                }
            }

            // 商品参数
            const attributes: Record<string, string> = {};
            const paramRows = document.querySelectorAll('.product-param li, #itemParameter li');
            paramRows.forEach(row => {
                const text = row.textContent?.trim() || '';
                const match = text.match(/(.+?)[:：](.+)/);
                if (match) {
                    attributes[match[1].trim()] = match[2].trim();
                }
            });

            // 详情HTML
            let detailHtml = '';
            const detailEl = document.querySelector('#productdetail, .product-intro') as HTMLElement;
            if (detailEl) {
                detailHtml = detailEl.innerHTML;
            } else {
                detailHtml = '<p>详情加载中...</p>';
            }

            // 店铺
            const shopEl = document.querySelector('.store-info .store-name, .shopName') as HTMLElement;
            const shopName = shopEl?.textContent?.trim() || '苏宁易购';

            return {
                title,
                price,
                images: images.slice(0, 10),
                detailHtml,
                attributes,
                shopName
            };
        });

        console.log(`[Suning Scraper] Successfully scraped: ${productData.title}`);

        return {
            ...productData,
            skuData: {
                price: productData.price,
                stock: '999',
                specs: productData.attributes
            }
        };

    } catch (error) {
        console.error('[Suning Scraper] Error:', error);
        throw new Error(`苏宁商品爬取失败: ${(error as Error).message}`);
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
            '--disable-blink-features=AutomationControlled'
        ]
    });
}

async function configureAntiDetection(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });
    });

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Referer': 'https://www.suning.com/'
    });

    await page.setViewport({ width: 1920, height: 1080 });
}
