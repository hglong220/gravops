// const fetch = require('node-fetch'); // Native fetch in Node 18+

const BASE_URL = 'http://localhost:3000';
const TEST_USER = {
    email: 'demo@example.com',
    password: 'password123'
};

// Mock product data
const MOCK_PRODUCT = {
    originalUrl: 'https://item.jd.com/1000123456.html',
    title: 'Test Product from Extension Script',
    images: ['https://img14.360buyimg.com/n0/jfs/t1/123/45/6789/123456/test.jpg'],
    attributes: { 'Brand': 'TestBrand' },
    detailHtml: '<p>Test Detail</p>',
    skuData: { price: '99.00', stock: '100' },
    shopName: 'JD Test Shop'
};

async function runTest() {
    console.log('🚀 Starting Extension Integration Test...\n');

    let token = '';

    // 1. Test Login (Extension Options Page)
    try {
        console.log('1️⃣  Testing Login...');
        // Note: You might need to ensure this user exists or use a registration endpoint if available.
        // For now, assuming the auth system allows login or we might need to register first.
        // Let's try to register first just in case, or login.

        // Try Login
        let res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });

        if (res.status === 401 || res.status === 404) {
            console.log('   Login failed (expected if user not exists), trying Register...');
            res = await fetch(`${BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...TEST_USER, name: 'Test User' })
            });
        }

        const data = await res.json();

        if (data.token) {
            token = data.token;
            console.log('   ✅ Login Successful! Token received.');
        } else {
            throw new Error('No token returned: ' + JSON.stringify(data));
        }

    } catch (error) {
        console.error('   ❌ Login Failed:', error.message);
        return;
    }

    // 2. Test Save Product (Copy Button)
    try {
        console.log('\n2️⃣  Testing Save Product (Copy Button)...');
        const res = await fetch(`${BASE_URL}/api/copy/save`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(MOCK_PRODUCT)
        });

        const data = await res.json();
        if (data.success) {
            console.log('   ✅ Product Saved Successfully! Draft ID:', data.draft.id);
        } else {
            throw new Error('Save failed: ' + JSON.stringify(data));
        }

    } catch (error) {
        console.error('   ❌ Save Product Failed:', error.message);
    }

    // 3. Test Fetch Drafts (Dashboard/Popup)
    try {
        console.log('\n3️⃣  Testing Fetch Drafts...');
        const res = await fetch(`${BASE_URL}/api/copy/drafts`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await res.json();
        if (data.success) {
            console.log(`   ✅ Fetched ${data.count} drafts.`);
            const savedDraft = data.drafts.find(d => d.originalUrl === MOCK_PRODUCT.originalUrl);
            if (savedDraft) {
                console.log('   ✅ Verified saved draft exists in list.');
            } else {
                console.warn('   ⚠️ Saved draft not found in list (might be pagination or delay).');
            }
        } else {
            throw new Error('Fetch failed: ' + JSON.stringify(data));
        }

    } catch (error) {
        console.error('   ❌ Fetch Drafts Failed:', error.message);
    }

    // 4. Test Image Proxy (Auto Publish)
    try {
        console.log('\n4️⃣  Testing Image Proxy...');
        // Use a real image URL that would usually trigger hotlink protection if not proxied, 
        // or just any external URL to test connectivity.
        const testImageUrl = 'https://www.baidu.com/img/flexible/logo/pc/result.png';
        const res = await fetch(`${BASE_URL}/api/copy/image-proxy?url=${encodeURIComponent(testImageUrl)}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            const contentType = res.headers.get('content-type');
            console.log(`   ✅ Image Proxy working. Content-Type: ${contentType}`);
        } else {
            throw new Error(`Proxy failed: ${res.status} ${res.statusText}`);
        }

    } catch (error) {
        console.error('   ❌ Image Proxy Failed:', error.message);
    }

    console.log('\n🎉 Test Complete.');
}

runTest();
