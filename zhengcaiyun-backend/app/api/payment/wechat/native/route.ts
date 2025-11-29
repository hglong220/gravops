import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNativeTransaction } from '@/lib/wechat-pay';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, plan, amount } = body; // amount in cents

        if (!userId || !plan || !amount) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 1. Create Order in Database
        const order = await prisma.order.create({
            data: {
                userId,
                plan,
                amount,
                status: 'pending',
                paymentMethod: 'wechat'
            }
        });

        // 2. Call WeChat Pay API
        const result = await createNativeTransaction({
            description: `政采云助手-${plan}套餐`,
            out_trade_no: order.id,
            amount: {
                total: amount,
                currency: 'CNY'
            }
        });

        // 3. Return QR Code URL
        return NextResponse.json({
            success: true,
            orderId: order.id,
            codeUrl: result.code_url
        });

    } catch (error) {
        console.error('[Payment] Create order failed:', error);
        return NextResponse.json({ error: 'Create order failed' }, { status: 500 });
    }
}
