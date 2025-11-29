import { searchImages } from '../lib/crawler';

async function test() {
    console.log('🧪 Testing Crawler directly...');
    const keyword = '海尔冰箱';

    try {
        const results = await searchImages(keyword);
        console.log('----------------------------------------');
        console.log(`✅ Found ${results.length} results for "${keyword}"`);

        if (results.length > 0) {
            console.log('First item:', results[0]);
        } else {
            console.log('❌ No results found. Check if JD is blocking or selector changed.');
        }
    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

test();
