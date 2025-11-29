import { Browser, Page } from 'puppeteer';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Add stealth plugin to evade detection
puppeteer.use(StealthPlugin());

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

        // 提取数据
        const productData = await page.evaluate(() => {
            // 商品标题
            const titleEl = document.querySelector('.sku-name, h1.product-intro .name') as HTMLElement;
            const title = titleEl?.textContent?.trim() || '未知商品';

            // 图片列表
            const images: string[] = [];
            const imgElements = document.querySelectorAll('#spec-list img, .spec-items img, .lh img');
            imgElements.forEach((img) => {
                let src = img.getAttribute('data-origin') ||
                    img.getAttribute('src') ||
                    img.getAttribute('data-lazy-img');

                if (src) {
                    if (src.startsWith('//')) src = 'https:' + src;
                    // 替换为高清大图
                    src = src.replace('/n5/', '/n1/').replace('/n7/', '/n1/').replace('/n9/', '/n1/');
                    if (!images.includes(src) && !src.includes('avatar') && !src.includes('icon')) {
                        images.push(src);
                    }
                }
            });

            // 价格 (可能需要异步加载,这里先获取页面价格)
            const priceEl = document.querySelector('.p-price .price, #J-p-price') as HTMLElement;
            const price = priceEl?.textContent?.replace(/[^0-9.]/g, '') || '0';

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
            const detailEl = document.querySelector('.detail-content, #detail') as HTMLElement;
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
    const fs = require('fs');
    const chromePaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
    ];

    const executablePath = chromePaths.find((path: string) => fs.existsSync(path));

    if (!executablePath) {
        console.warn('[JD Scraper] Chrome not found, using default');
    }

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

        // 如果显示"有货",返回默认库存
        if (stockText.includes('有货') || stockText.includes('现货')) {
            return '999';
        }

        return '0'; // 无货
    } catch (error) {
        console.warn('[JD Scraper] Failed to get stock, using default');
        return '999';
    }
}
