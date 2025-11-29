import puppeteer, { Browser, Page } from 'puppeteer';

export interface TmallProductData {
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
 * 爬取天猫商品详情页完整数据
 * @param productUrl 天猫商品详情页URL (e.g., https://detail.tmall.com/item.htm?id=xxx)
 */
export async function scrapeTmallProduct(productUrl: string): Promise<TmallProductData> {
    console.log(`[Tmall Scraper] Starting to scrape: ${productUrl}`);

    let browser: Browser | null = null;

    try {
        browser = await launchBrowser();
        const page = await browser.newPage();

        await configureAntiDetection(page);

        console.log(`[Tmall Scraper] Navigating to product page...`);
        await page.goto(productUrl, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        // 等待页面加载(天猫是React应用,需要等待动态渲染)
        await page.waitForTimeout(3000);

        // 检查是否遇到登录墙
        const hasLoginWall = await page.evaluate(() => {
            return !!document.querySelector('.login-box, .login-panel, #J_loginIframe');
        });

        if (hasLoginWall) {
            console.warn('[Tmall Scraper] Login wall detected, attempting to extract available data...');
        }

        // 提取数据
        const productData = await page.evaluate(() => {
            // 标题
            const titleEl = document.querySelector('.tb-detail-hd h1, h1[data-spm="1000983"], .ItemTitle--mainTitle') as HTMLElement;
            const title = titleEl?.textContent?.trim() ||
                document.querySelector('title')?.textContent?.split('_')[0] ||
                '未知商品';

            // 图片列表
            const images: string[] = [];

            // 尝试多种图片选择器
            const imgSelectors = [
                '#J_ImgBooth',  // 主图
                '.tb-booth-main img',
                '#J_UlThumb img',  // 缩略图列表
                '.tb-thumb img',
                'img[src*="img.alicdn.com"]'
            ];

            imgSelectors.forEach(selector => {
                const imgElements = document.querySelectorAll(selector);
                imgElements.forEach((img) => {
                    let src = img.getAttribute('data-src') ||
                        img.getAttribute('src') ||
                        img.getAttribute('data-ks-lazyload');

                    if (src) {
                        if (src.startsWith('//')) src = 'https:' + src;
                        // 替换为高清大图
                        src = src.replace(/_\d+x\d+\.jpg/, '.jpg')
                            .replace(/_[0-9]+\.[a-z]+/, '.jpg');

                        if (!images.includes(src) &&
                            src.includes('img.alicdn.com') &&
                            !src.includes('avatar') &&
                            !src.includes('icon')) {
                            images.push(src);
                        }
                    }
                });
            });

            // 价格
            const priceSelectors = [
                '.tb-rmb-num',
                '[class*="price"] em',
                '[class*="Price"]',
                '#J_PromoPrice',
                '.tm-price'
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
            const paramSelectors = [
                '#J_AttrUL li',
                '.tb-property-cont li',
                '.attributes-list li',
                'ul[class*="attributes"] li'
            ];

            paramSelectors.forEach(selector => {
                const paramRows = document.querySelectorAll(selector);
                paramRows.forEach(row => {
                    const text = row.textContent?.trim() || '';
                    const match = text.match(/(.+?)[:：](.+)/);
                    if (match) {
                        attributes[match[1].trim()] = match[2].trim();
                    }
                });
            });

            // 详情HTML
            const detailSelectors = [
                '#J_DetailMeta',
                '.detail-content',
                '#description',
                '.tb-detail-bd'
            ];

            let detailHtml = '';
            for (const selector of detailSelectors) {
                const detailEl = document.querySelector(selector) as HTMLElement;
                if (detailEl && detailEl.innerHTML.length > 100) {
                    detailHtml = detailEl.innerHTML;
                    break;
                }
            }

            if (!detailHtml) {
                detailHtml = '<p>详情加载中...</p>';
            }

            // 店铺名称
            const shopEl = document.querySelector('.slogo-shopname, .shop-name a') as HTMLElement;
            const shopName = shopEl?.textContent?.trim() || '天猫店铺';

            return {
                title,
                price,
                images: images.slice(0, 10),
                detailHtml,
                attributes,
                shopName
            };
        });

        console.log(`[Tmall Scraper] Successfully scraped: ${productData.title}`);
        console.log(`[Tmall Scraper] Found ${productData.images.length} images`);

        // 如果没有获取到图片,尝试截图获取
        if (productData.images.length === 0) {
            console.warn('[Tmall Scraper] No images found via selectors, attempting screenshot...');
            // 后续可以添加截图逻辑
        }

        return {
            ...productData,
            skuData: {
                price: productData.price,
                stock: '999',
                specs: productData.attributes
            }
        };

    } catch (error) {
        console.error('[Tmall Scraper] Error:', error);
        throw new Error(`天猫商品爬取失败: ${(error as Error).message}`);
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
            '--disable-web-security'  // 天猫可能需要
        ]
    });
}

async function configureAntiDetection(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });

        // 伪装成真实浏览器
        (window.navigator as any).chrome = {
            runtime: {},
        };

        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });
    });

    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );

    await page.setExtraHTTPHeaders({
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Referer': 'https://www.tmall.com/',
        'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        'sec-ch-ua-platform': '"Windows"'
    });

    await page.setViewport({ width: 1920, height: 1080 });
}
