import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🕷️ Testing Image Crawler API...');

    // 1. Get a valid license
    const license = await prisma.license.findFirst({
        where: { status: 'active' }
    });

    if (!license) {
        console.error('❌ No active license found. Please run test-db.mjs first.');
        return;
    }

    console.log(`Using License: ${license.key}`);

    // 2. Mock API Call (Simulating fetch)
    // Note: This requires the server to be running and puppeteer to be installed.
    // If puppeteer install is still running, this might fail.

    const keyword = 'ThinkPad';
    const url = `http://localhost:3000/api/search-images?keyword=${keyword}&licenseKey=${license.key}`;

    console.log(`Fetching: ${url}`);

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (response.ok) {
            console.log(`✅ Success! Found ${data.count} images.`);
            if (data.images && data.images.length > 0) {
                console.log('First image:', data.images[0]);
            }
        } else {
            console.error('❌ API Error:', data);
        }
    } catch (e) {
        console.error('❌ Fetch Failed:', e.message);
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
