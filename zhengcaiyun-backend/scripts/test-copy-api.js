const axios = require('axios');

const API_BASE = 'http://localhost:3000/api';

async function testCopyFlow() {
    console.log('🚀 Starting Product Replication API Test...');

    // 1. Test Save Draft
    console.log('\n1️⃣ Testing /api/copy/save...');
    const mockData = {
        originalUrl: 'https://www.zcygov.cn/product/test-123',
        title: '【测试商品】得力A4打印纸 (API Test)',
        categoryPath: '办公用品/纸张/复印纸',
        categoryId: 'cat_001',
        brand: 'Deli',
        model: '70g',
        images: ['https://example.com/img1.jpg', 'https://example.com/img2.jpg'],
        attributes: { '颜色': '白色', '规格': 'A4' },
        skuData: { price: '25.00', stock: '100' },
        detailHtml: '<p>Product Detail HTML</p>',
        shopName: 'Test Shop',
        userId: 'demo-user'
    };

    try {
        const saveRes = await axios.post(`${API_BASE}/copy/save`, mockData);
        console.log('✅ Save Success:', saveRes.data);

        const draftId = saveRes.data.id;

        // 2. Test Get Draft
        console.log(`\n2️⃣ Testing /api/copy/get?id=${draftId}...`);
        const getRes = await axios.get(`${API_BASE}/copy/get?id=${draftId}`);

        if (getRes.data.draft.title === mockData.title) {
            console.log('✅ Get Success: Data matches!');
            console.log('   Title:', getRes.data.draft.title);
            console.log('   Images:', getRes.data.draft.images);
        } else {
            console.error('❌ Data mismatch:', getRes.data);
        }

    } catch (error) {
        console.error('❌ Test Failed:', error.response ? error.response.data : error.message);
    }
}

testCopyFlow();
