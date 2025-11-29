import axios from 'axios';
import * as cheerio from 'cheerio';
import * as fs from 'fs';

async function debugJD() {
    const keyword = 'ThinkPad';
    const searchUrl = `https://search.jd.com/Search?keyword=${encodeURIComponent(keyword)}&enc=utf-8`;

    console.log(`Fetching: ${searchUrl}`);

    try {
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            }
        });

        // Save HTML for inspection
        fs.writeFileSync('jd-response.html', response.data);
        console.log('✅ HTML saved to jd-response.html');

        const $ = cheerio.load(response.data);

        console.log('\n📊 Analyzing page structure:');
        console.log(`- .gl-item count: ${$('.gl-item').length}`);
        console.log(`- .goods-item count: ${$('.goods-item').length}`);
        console.log(`- #J_goodsList exists: ${$('#J_goodsList').length > 0}`);
        console.log(`- img tags total: ${$('img').length}`);

        // Check first few img tags
        console.log('\n🖼️ First 5 img tags:');
        $('img').slice(0, 5).each((i, el) => {
            const $img = $(el);
            console.log(`  ${i + 1}. src="${$img.attr('src')}" data-lazy-img="${$img.attr('data-lazy-img')}"`);
        });

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    }
}

debugJD();
