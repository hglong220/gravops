import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifySignature, decryptResource } from '@/lib/wechat-pay';
import { generateLicenseKey } from '@/lib/license-utils'; // Assuming this exists or I'll create it

export async function POST(request: NextRequest) {
    try {
        console.log('[WeChatPay] Received notification');

        // 1. Get Headers
        const timestamp = request.headers.get('Wechatpay-Timestamp') || '';
        const nonce = request.headers.get('Wechatpay-Nonce') || '';
        const signature = request.headers.get('Wechatpay-Signature') || '';
        const serial = request.headers.get('Wechatpay-Serial') || '';

        const bodyText = await request.text();
        const body = JSON.parse(bodyText);

        // 2. Verify Signature
        if (!verifySignature(timestamp, nonce, bodyText, signature, serial)) {
            console.error('[WeChatPay] Signature verification failed');
            return NextResponse.json({ code: 'FAIL', message: 'Signature error' }, { status: 401 });
        }

        // 3. Decrypt Resource
        const { resource } = body;
        const decrypted = decryptResource(resource.ciphertext, resource.associated_data, resource.nonce);

        console.log('[WeChatPay] Decrypted data:', decrypted);

        if (decrypted.trade_state === 'SUCCESS') {
            const orderId = decrypted.out_trade_no;
            const transactionId = decrypted.transaction_id;

            // 4. Update Order & License (Transaction)
            await prisma.$transaction(async (tx) => {
                const order = await tx.order.findUnique({
                    where: { id: orderId },
                    include: { user: true }
                });

                if (!order || order.status === 'paid') {
                    return; // Already processed or not found
                }

                // Update Order
                await tx.order.update({
                    where: { id: orderId },
                    data: {
                        status: 'paid',
                        transactionId: transactionId
                    }
                });

                // Generate or Extend License
                // Logic: If user has active license, extend it. Else create new.
                const existingLicense = await tx.license.findFirst({
                    where: { userId: order.userId, status: 'active' }
                });

                const durationDays = order.plan === 'yearly' ? 365 : 30;

                if (existingLicense) {
                    const newExpiresAt = new Date(existingLicense.expiresAt.getTime() + durationDays * 24 * 60 * 60 * 1000);
                    await tx.license.update({
                        where: { id: existingLicense.id },
                        data: { expiresAt: newExpiresAt }
                    });
                } else {
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + durationDays);

                    await tx.license.create({
                        data: {
                            key: generateLicenseKey(order.user.companyName || undefined),
                            userId: order.userId,
                            orderId: order.id,
                            companyName: order.user.companyName || 'Personal',
                            plan: order.plan,
                            expiresAt: expiresAt,
                            status: 'active'
                        }
                    });
                }
            });
        }

        return NextResponse.json({ code: 'SUCCESS', message: 'OK' });

    } catch (error) {
        console.error('[WeChatPay] Notify process failed:', error);
        return NextResponse.json({ code: 'FAIL', message: 'Internal error' }, { status: 500 });
    }
}
