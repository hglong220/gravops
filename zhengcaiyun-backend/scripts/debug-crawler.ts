import { searchImages } from '../lib/crawler';

async function main() {
    console.log('🔍 Debugging Crawler Direct Call...');
    try {
        const results = await searchImages('ThinkPad');
        console.log('✅ Crawler Result:', results.length, 'images found');
        if (results.length > 0) {
            console.log('First image:', results[0]);
        }
    } catch (error) {
        console.error('❌ Crawler Failed:', error);
    }
}

main();
