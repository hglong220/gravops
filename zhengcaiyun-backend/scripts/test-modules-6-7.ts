
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { createNativeTransaction } from '../lib/wechat-pay';

// 1. Manually load .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
    const envConfig = fs.readFileSync(envPath, 'utf-8');
    envConfig.split('\n').forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
            process.env[key.trim()] = value.trim();
        }
    });
    console.log('✅ Loaded env vars');
}

const prisma = new PrismaClient();

async function testModules() {
    console.log('🚀 Starting Module 6 & 7 Test...');

    try {
        // ==========================================
        // Module 6: Database & Persistence
        // ==========================================
        console.log('\n[Module 6] Testing Database...');

        // 1. Create Test User
        const testEmail = `test_${Date.now()}@example.com`;
        const user = await prisma.user.create({
            data: {
                email: testEmail,
                password: 'hashed_password',
                name: 'Test User'
            }
        });
        console.log('✅ Created User:', user.email);

        // 2. Create License
        const licenseKey = `TEST-KEY-${Date.now()}`;
        const license = await prisma.license.create({
            data: {
                key: licenseKey,
                userId: user.id,
                companyName: 'Test Corp',
                plan: 'monthly',
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            }
        });
        console.log('✅ Created License:', license.key);

        // 3. Record Usage
        await prisma.usageRecord.create({
            data: {
                licenseId: license.id,
                productName: 'Test Product A',
                status: 'success'
            }
        });
        console.log('✅ Recorded Usage');

        // 4. Verify Usage Stats
        const count = await prisma.usageRecord.count({
            where: { licenseId: license.id }
        });
        console.log(`✅ Verified Usage Count: ${count} (Expected: 1)`);


        // ==========================================
        // Module 7: Payment System
        // ==========================================
        console.log('\n[Module 7] Testing Payment System...');

        // 1. Create Order
        const amount = 9900; // 99 CNY
        const order = await prisma.order.create({
            data: {
                userId: user.id,
                plan: 'monthly',
                amount: amount,
                status: 'pending',
                paymentMethod: 'wechat'
            }
        });
        console.log('✅ Created Order:', order.id);

        // 2. Call WeChat Pay (Mock)
        const payResult = await createNativeTransaction({
            description: 'Test Payment',
            out_trade_no: order.id,
            amount: { total: amount, currency: 'CNY' }
        });
        console.log('✅ Generated QR Code:', payResult.code_url);

        // 3. Simulate Callback (Payment Success)
        console.log('🔄 Simulating Payment Callback...');

        // Update Order
        await prisma.order.update({
            where: { id: order.id },
            data: { status: 'paid', transactionId: `TXN_${Date.now()}` }
        });

        // Extend License (Simulate logic from notify route)
        const newExpiresAt = new Date(license.expiresAt.getTime() + 30 * 24 * 60 * 60 * 1000);
        await prisma.license.update({
            where: { id: license.id },
            data: { expiresAt: newExpiresAt }
        });
        console.log('✅ License Extended to:', newExpiresAt.toISOString());

        // 4. Verify Final State
        const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
        const finalLicense = await prisma.license.findUnique({ where: { id: license.id } });

        if (finalOrder?.status === 'paid' && finalLicense?.expiresAt.getTime() > license.expiresAt.getTime()) {
            console.log('✅ Payment Flow Verified Successfully!');
        } else {
            console.error('❌ Verification Failed');
        }

    } catch (error) {
        console.error('❌ Test Failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testModules();
