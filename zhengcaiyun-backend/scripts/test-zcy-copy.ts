import puppeteer from 'puppeteer';
import * as fs from 'fs';
import * as path from 'path';

// Mock HTML content mimicking a ZCY product page
const MOCK_HTML = `
<!DOCTYPE html>
<html>
<head>
    <title>政采云商品详情页 - 测试</title>
</head>
<body>
    <div class="product-title">
        <h1>得力(deli) S855 黑色水笔 0.5mm</h1>
    </div>
    
    <div class="gallery-list">
        <img class="main-img" src="https://example.com/img1.jpg" />
        <img class="gallery-img" src="https://example.com/img2.jpg" />
    </div>
    
    <div class="price-wrap">
        <span class="price">¥ 12.50</span>
    </div>
    
    <div class="detail-content">
        <p>这是商品详情描述...</p>
        <img src="https://example.com/detail.jpg" />
    </div>
    
    <div class="parameter-table">
        <table>
            <tr><td>品牌：</td><td>得力</td></tr>
            <tr><td>型号：</td><td>S855</td></tr>
            <tr><td>颜色：</td><td>黑色</td></tr>
        </table>
    </div>
</body>
</html>
`;

async function testScraper() {
    console.log('🧪 Testing ZCY Internal Copy Scraper...');

    // 1. Create mock file
    const mockPath = path.join(__dirname, 'mock-zcy.html');
    fs.writeFileSync(mockPath, MOCK_HTML);
    const fileUrl = `file://${mockPath.replace(/\\/g, '/')}`;

    let browser;
    try {
        // Find Chrome (reusing logic)
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

        // 2. Inject Scraper Logic (Copied from zcy-scraper.tsx)
        const result = await page.evaluate(() => {
            const title = document.querySelector('h1, .product-title, .sku-name')?.textContent?.trim() || document.title;

            const images = Array.from(document.querySelectorAll('.gallery-img, .main-img, .swiper-slide img'))
                .map(img => (img as HTMLImageElement).src)
                .filter(src => src && !src.includes('avatar'))
                .slice(0, 5);

            const priceEl = document.querySelector('.price, .real-price, .sku-price');
            const price = priceEl?.textContent?.replace(/[^\d.]/g, '') || '0';

            const detailEl = document.querySelector('.detail-content, .product-detail, .intro-wrap');
            const detailHtml = detailEl ? detailEl.innerHTML : '';

            const attributes: Record<string, string> = {};
            const rows = document.querySelectorAll('.attr-list tr, .parameter-table tr, .attributes li');
            rows.forEach(row => {
                const text = row.textContent?.trim() || '';
                const parts = text.split(/[:：]/);
                if (parts.length >= 2) {
                    attributes[parts[0].trim()] = parts[1].trim();
                }
            });

            return { title, images, price, detailHtml, attributes };
        });

        console.log('✅ Extracted Data:', result);

        // 3. Assertions
        if (result.title.includes('得力') && result.price === '12.50' && result.images.length === 2) {
            console.log('🎉 Test PASSED: Scraper logic works correctly on mock page.');
        } else {
            console.error('❌ Test FAILED: Data mismatch.');
        }

    } catch (error) {
        console.error('❌ Test Error:', error);
    } finally {
        if (browser) await browser.close();
        if (fs.existsSync(mockPath)) fs.unlinkSync(mockPath);
    }
}

testScraper();