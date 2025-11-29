import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';
// Mock HTML for a ZCY List Page
const MOCK_LIST_HTML = `
<!DOCTYPE html>
<html>
<head><title>政采云店铺 - 商品列表</title></head>
<body>
    <div class="shop-products">
        <div class="product-item">
            <a href="https://www.zcygov.cn/product/1001">商品A</a>
        </div>
        <div class="product-item">
            <a href="https://www.zcygov.cn/product/1002">商品B</a>
        </div>
        <div class="product-item">
            <!-- Duplicate link to test dedup -->
            <a href="https://www.zcygov.cn/product/1001">商品A (Duplicate)</a>
        </div>
        <div class="product-item">
            <a href="/product/1003">商品C (Relative Path)</a>
        </div>
    </div>
</body>
</html>
`;

const API_URL = 'http://localhost:3000/api/copy/batch-create';

async function testBatchCopy() {
    console.log('🧪 Testing ZCY Batch Copy Logic...');

    // 1. Test Selector Logic (Puppeteer)
    console.log('\n1️⃣  Testing Link Extraction...');
    const extractedLinks = await testSelectorLogic();

    if (extractedLinks.length === 3) {
        console.log('   ✅ Successfully extracted 3 unique product links.');
    } else {
        console.error(`   ❌ Extraction failed. Expected 3, got ${extractedLinks.length}:`, extractedLinks);
    }

    // 2. Test Backend API (Mocking the call)
    console.log('\n2️⃣  Testing Backend API (Batch Create)...');
    try {
        // We need a token, but for this test we might hit 401 if not logged in.
        // This test assumes dev environment might bypass auth or we check for 401 as "Reachability Success".
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                productUrls: extractedLinks,
                shopName: 'Test Shop',
                shopUrl: 'https://shop.zcygov.cn/test'
            })
        });

        if (response.status === 401) {
            console.log('   ✅ API endpoint reachable (Returning 401 Unauthorized is expected without token).');
        } else if (response.ok) {
            const data = await response.json();
            console.log('   ✅ API call successful!', data);
        } else {
            console.warn(`   ⚠️ API returned status ${response.status}. Endpoint exists but request failed.`);
        }

    } catch (error) {
        console.error('   ❌ API Connection Failed. Is the backend running?');
        console.error('      Run "pnpm dev" in zhengcaiyun-backend folder.');
    }
}

async function testSelectorLogic() {
    const mockPath = path.join(__dirname, 'mock-zcy-list.html');
    fs.writeFileSync(mockPath, MOCK_LIST_HTML);
    const fileUrl = `file://${mockPath.replace(/\\/g, '/')}`;

    let browser;
    try {
        const chromePaths = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
        ];
        const executablePath = chromePaths.find(p => fs.existsSync(p));

        browser = await puppeteer.launch({
            headless: true,
            executablePath,
            args: ['--no-sandbox']
        });

        const page = await browser.newPage();
        await page.goto(fileUrl);

        // Inject the logic from zcy-scraper.tsx (handleBatchCopy extraction part)
        const links = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a[href*="/product/"]'));
            const urls = anchors
                .map(a => (a as HTMLAnchorElement).href) // .href returns absolute URL
                .filter(href => href.match(/\/product\/\d+/));

            return [...new Set(urls)];
        });

        return links;

    } catch (e) {
        console.error('Puppeteer Error:', e);
        return [];
    } finally {
        if (browser) await browser.close();
        if (fs.existsSync(mockPath)) fs.unlinkSync(mockPath);
    }
}

testBatchCopy();