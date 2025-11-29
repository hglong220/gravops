import { NextRequest, NextResponse } from 'next/server';
import { verifyAlipayNotify } from '@/lib/payment-service';
import { prisma } from '@/lib/prisma';

/**
 * 支付宝异步通知处理
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Verify signature
        if (!verifyAlipayNotify(body)) {
            console.error('[Payment] Invalid signature');
            return NextResponse.json('fail');
        }

        const { out_trade_no, trade_status, total_amount } = body;

        if (trade_status === 'TRADE_SUCCESS') {
            // Update order status
            const order = await prisma.order.update({
                where: { id: out_trade_no },
                data: {
                    status: 'paid',
                    paidAt: new Date()
                }
            });

            // Activate or extend license
            const license = await prisma.license.findFirst({
                where: { userId: order.userId }
            });

            if (license) {
                const expiresAt = new Date();
                expiresAt.setFullYear(expiresAt.getFullYear() + 1);

                await prisma.license.update({
                    where: { id: license.id },
                    data: {
                        status: 'active',
                        expiresAt
                    }
                });
            }

            console.log('[Payment] Order paid:', out_trade_no);
        }

        return NextResponse.json('success');

    } catch (error) {
        console.error('[Payment] Notify error:', error);
        return NextResponse.json('fail');
    }
}
