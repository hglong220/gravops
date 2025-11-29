import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('🧪 Testing AI API...');

    // 1. Get or Create a valid license
    let license = await prisma.license.findFirst({
        where: { status: 'active' }
    });

    if (!license) {
        console.log('Creating temporary license for test...');
        license = await prisma.license.create({
            data: {
                key: `TEST-AI-${Date.now()}`,
                companyName: 'AI Test Corp',
                plan: 'professional',
                expiresAt: new Date(Date.now() + 86400000),
                status: 'active'
            }
        });
    }

    console.log(`Using License: ${license.key}`);

    // 2. Mock API Call (Simulating fetch)
    // Since we are running in node script, we can't easily fetch localhost:3000 if server isn't running separately.
    // Ideally we should run this against the running dev server.

    const response = await fetch('http://localhost:3000/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            productName: '联想ThinkPad X1 Carbon 笔记本电脑',
            licenseKey: license.key
        })
    });

    const data = await response.json();
    console.log('🤖 AI Response:', JSON.stringify(data, null, 2));

    if (data.category && data.riskLevel) {
        console.log('✅ AI API Test PASSED');
    } else {
        console.error('❌ AI API Test FAILED');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
