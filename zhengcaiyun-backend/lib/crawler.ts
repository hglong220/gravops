import puppeteer from 'puppeteer';

export interface ImageResult {
    url: string;
    title: string;
    source: 'jd' | 'tmall' | 'suning' | 'bing';
    price?: string;
}

export async function searchImages(keyword: string): Promise<ImageResult[]> {
    console.log(`[Crawler] Starting search for: ${keyword}`);

    // 1. Try JD First
    const jdResults = await crawlJD(keyword);
    if (jdResults.length > 0) {
        return jdResults;
    }

    console.log('[Crawler] JD failed, trying Suning...');

    // 2. Try Suning
    const suningResults = await crawlSuning(keyword);
    if (suningResults.length > 0) {
        return suningResults;
    }

    console.log('[Crawler] Suning failed, trying Tmall...');

    // 3. Try Tmall (Experimental)
    const tmallResults = await crawlTmall(keyword);
    if (tmallResults.length > 0) {
        return tmallResults;
    }

    console.log('[Crawler] Tmall failed, trying Bing...');

    // 4. Fallback to Bing
    return await crawlBing(keyword);
}

async function crawlJD(keyword: string): Promise<ImageResult[]> {
    let browser;
    try {
        // Auto-detect Chrome path on Windows
        const fs = require('fs');
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];

        const executablePath = chromePaths.find((path: string) => fs.existsSync(path));

        if (!executablePath) {
            console.warn('[Crawler] Chrome executable not found in standard locations. Trying default launch...');
        } else {
            console.log(`[Crawler] Using Chrome at: ${executablePath}`);
        }

        browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath, // Use local Chrome if found
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Set viewport to desktop size
        await page.setViewport({ width: 1920, height: 1080 });

        // 1. Hide WebDriver property
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
        });

        // 2. Set realistic User-Agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        // 3. Add extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Referer': 'https://www.jd.com/',
            'sec-ch-ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
            'sec-ch-ua-platform': '"Windows"'
        });

        // Navigate to JD Search
        const searchUrl = `https://search.jd.com/Search?keyword=${encodeURIComponent(keyword)}&enc=utf-8`;
        console.log(`[Crawler] Navigating to: ${searchUrl}`);

        await page.goto(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Wait for goods list
        try {
            // Try multiple selectors
            await page.waitForSelector('#J_goodsList li, .gl-item', { timeout: 20000 });
        } catch (e) {
            console.log('[Crawler] No items found or timeout waiting for selector');
            return [];
        }

        // Auto-scroll to trigger lazy loading
        console.log('[Crawler] Scrolling to load images...');
        await autoScroll(page);

        // Extract Data
        const results = await page.evaluate(() => {
            // Try multiple selectors for items
            const items = document.querySelectorAll('#J_goodsList li, .gl-item');
            const data: any[] = [];

            items.forEach((item) => {
                const imgEl = item.querySelector('.p-img img');
                const priceEl = item.querySelector('.p-price i');
                const titleEl = item.querySelector('.p-name em');

                if (imgEl && titleEl) {
                    // JD uses data-lazy-img for lazy loaded images
                    let src = imgEl.getAttribute('data-lazy-img') || imgEl.getAttribute('src');

                    if (src && src.startsWith('//')) {
                        src = 'https:' + src;
                    }

                    // Get high-res image (n7/n1 replacement)
                    if (src) {
                        src = src.replace('/n7/', '/n1/').replace('/n9/', '/n1/');
                    }

                    data.push({
                        url: src || '',
                        title: titleEl.textContent?.trim() || '',
                        price: priceEl?.textContent || '',
                        source: 'jd'
                    });
                }
            });

            return data;
        });

        console.log(`[Crawler] JD Found ${results.length} images`);
        return results.filter((r: any) => r.url && r.title);

    } catch (error) {
        console.error('[Crawler] JD Error:', error);
        return [];
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function crawlBing(keyword: string): Promise<ImageResult[]> {
    let browser;
    try {
        // Re-use Chrome finding logic
        const fs = require('fs');
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];
        const executablePath = chromePaths.find((path: string) => fs.existsSync(path));

        browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(keyword)}`;
        console.log(`[Crawler] Bing Navigating to: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        try {
            await page.waitForSelector('.iusc', { timeout: 10000 });
        } catch (e) {
            console.log('[Crawler] Bing: No items found');
            return [];
        }

        await autoScroll(page);

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('.iusc');
            const data: any[] = [];

            items.forEach((item) => {
                try {
                    const m = item.getAttribute('m'); // Metadata JSON string
                    if (m) {
                        const meta = JSON.parse(m);
                        if (meta.murl && meta.t) {
                            data.push({
                                url: meta.murl, // High res URL
                                title: meta.t,   // Title
                                source: 'bing'
                            });
                        }
                    }
                } catch (e) { }
            });
            return data;
        });

        console.log(`[Crawler] Bing Found ${results.length} images`);
        return results;

    } catch (error) {
        console.error('[Crawler] Bing Error:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

async function crawlSuning(keyword: string): Promise<ImageResult[]> {
    let browser;
    try {
        // Re-use Chrome finding logic
        const fs = require('fs');
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];
        const executablePath = chromePaths.find((path: string) => fs.existsSync(path));

        browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const searchUrl = `https://search.suning.com/${encodeURIComponent(keyword)}/`;
        console.log(`[Crawler] Suning Navigating to: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        try {
            await page.waitForSelector('.item-wrap, .product-box', { timeout: 10000 });
        } catch (e) {
            console.log('[Crawler] Suning: No items found');
            return [];
        }

        await autoScroll(page);

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('.item-wrap, .product-box, li[id^="007"]');
            const data: any[] = [];

            items.forEach((item) => {
                try {
                    const imgEl = item.querySelector('.img-block img, .res-img img');
                    const titleEl = item.querySelector('.title-selling-point a, .title-box a');
                    const priceEl = item.querySelector('.price-box .def-price, .price-box .price');

                    if (imgEl && titleEl) {
                        let src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src');
                        if (src && src.startsWith('//')) src = 'https:' + src;

                        const title = titleEl.textContent?.trim() || '';
                        const price = priceEl?.textContent?.trim().replace(/¥/g, '') || '0';

                        if (src && title) {
                            data.push({
                                url: src,
                                title: title,
                                price: price,
                                source: 'suning'
                            });
                        }
                    }
                } catch (e) { }
            });
            return data;
        });

        console.log(`[Crawler] Suning Found ${results.length} images`);
        return results;

    } catch (error) {
        console.error('[Crawler] Suning Error:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

async function crawlTmall(keyword: string): Promise<ImageResult[]> {
    let browser;
    try {
        // Re-use Chrome finding logic
        const fs = require('fs');
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];
        const executablePath = chromePaths.find((path: string) => fs.existsSync(path));

        browser = await puppeteer.launch({
            headless: true,
            executablePath: executablePath,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

        const searchUrl = `https://list.tmall.com/search_product.htm?q=${encodeURIComponent(keyword)}`;
        console.log(`[Crawler] Tmall Navigating to: ${searchUrl}`);

        await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

        try {
            await page.waitForSelector('.product, .item', { timeout: 10000 });
        } catch (e) {
            console.log('[Crawler] Tmall: No items found (Login wall likely)');
            return [];
        }

        await autoScroll(page);

        const results = await page.evaluate(() => {
            const items = document.querySelectorAll('.product, .item');
            const data: any[] = [];

            items.forEach((item) => {
                try {
                    const imgEl = item.querySelector('.productImg img, .photo img');
                    const titleEl = item.querySelector('.productTitle a, .title a');
                    const priceEl = item.querySelector('.productPrice em, .price em');

                    if (imgEl && titleEl) {
                        let src = imgEl.getAttribute('src') || imgEl.getAttribute('data-src');
                        if (src && src.startsWith('//')) src = 'https:' + src;

                        const title = titleEl.textContent?.trim() || '';
                        const price = priceEl?.textContent?.trim() || '0';

                        if (src && title) {
                            data.push({
                                url: src,
                                title: title,
                                price: price,
                                source: 'tmall'
                            });
                        }
                    }
                } catch (e) { }
            });
            return data;
        });

        console.log(`[Crawler] Tmall Found ${results.length} images`);
        return results;

    } catch (error) {
        console.error('[Crawler] Tmall Error:', error);
        return [];
    } finally {
        if (browser) await browser.close();
    }
}

// Helper function to scroll page
async function autoScroll(page: any) {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight || totalHeight > 5000) { // Limit scroll depth
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}
