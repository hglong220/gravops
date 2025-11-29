import { NextRequest, NextResponse } from 'next/server';
import { createAlipayOrder } from '@/lib/payment-service';
import { prisma } from '@/lib/prisma';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, plan, licenseKey } = body;

        if (!userId || !plan) {
            return NextResponse.json({ error: '缺少参数' }, { status: 400 });
        }

        // Verify license
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license) {
            return NextResponse.json({ error: '无效的License' }, { status: 401 });
        }

        // Get plan price
        const planPrices: Record<string, number> = {
            basic: 299,
            standard: 599,
            professional: 1299
        };

        const amount = planPrices[plan] || 0;
        if (amount === 0) {
            return NextResponse.json({ error: '无效的套餐' }, { status: 400 });
        }

        // Create order in database
        const orderId = 'ORDER-' + nanoid();

        await prisma.order.create({
            data: {
                id: orderId,
                userId,
                plan,
                amount,
                status: 'pending',
                paymentMethod: 'alipay'
            }
        });

        // Create Alipay payment
        const payment = await createAlipayOrder({
            orderId,
            amount,
            subject: `政采云智能助手 - ${plan}版`,
            returnUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/payment/result`
        });

        if (!payment.success) {
            return NextResponse.json({ error: payment.error }, { status: 500 });
        }

        return NextResponse.json({
            orderId,
            payUrl: payment.payUrl
        });

    } catch (error) {
        console.error('Create payment error:', error);
        return NextResponse.json({ error: '创建支付失败' }, { status: 500 });
    }
}
