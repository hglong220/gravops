/**
 * 支付宝支付回调（安全版本）
 * POST /api/payment/notify
 * 
 * ✅ 验证支付宝签名
 * ✅ 防止重复处理
 * ✅ 验证金额
 * ✅ 自动生成License
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        console.log('[Payment] Alipay notification received:', body.out_trade_no);

        // 1. ✅ 验证支付宝签名
        const signValid = verifyAlipaySign(body);

        if (!signValid) {
            console.error('[Payment] Invalid signature');

            return NextResponse.json({
                error: '签名验证失败'
            }, { status: 403 });
        }

        // 2. 获取订单
        const orderId = body.out_trade_no;
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            console.error('[Payment] Order not found:', orderId);

            return NextResponse.json({
                error: '订单不存在'
            }, { status: 404 });
        }

        // 3. ✅ 防止重复处理
        if (order.status === 'paid' || order.status === 'completed') {
            console.log('[Payment] Order already processed:', orderId);

            return NextResponse.json({
                success: true,
                message: '订单已处理'
            });
        }

        // 4. ✅ 验证交易状态
        const tradeStatus = body.trade_status;

        if (tradeStatus !== 'TRADE_SUCCESS' && tradeStatus !== 'TRADE_FINISHED') {
            console.warn('[Payment] Invalid trade status:', tradeStatus);

            return NextResponse.json({
                success: false,
                message: '交易状态异常'
            });
        }

        // 5. ✅ 验证金额
        const paidAmount = parseFloat(body.total_amount);

        if (Math.abs(paidAmount - order.amount) > 0.01) {
            console.error('[Payment] Amount mismatch:', {
                expected: order.amount,
                paid: paidAmount
            });

            // 创建异常记录
            await prisma.paymentAnomaly.create({
                data: {
                    orderId: orderId,
                    type: 'amount_mismatch',
                    expected: order.amount,
                    actual: paidAmount,
                    detail: body
                }
            });

            return NextResponse.json({
                error: '金额不匹配'
            }, { status: 400 });
        }

        // 6. 更新订单状态
        await prisma.order.update({
            where: { id: orderId },
            data: {
                status: 'paid',
                paidAt: new Date(),
                transactionId: body.trade_no
            }
        });

        // 7. ✅ 自动生成License（调用管理员API）
        const licenseResult = await generateLicenseForOrder(order);

        if (!licenseResult.success) {
            console.error('[Payment] Failed to generate license:', licenseResult.error);

            // 不返回错误给支付宝（避免重复回调）
            // 但记录异常，需要人工处理
            await prisma.paymentAnomaly.create({
                data: {
                    orderId: orderId,
                    type: 'license_generation_failed',
                    detail: licenseResult.error
                }
            });
        }

        // 8. ✅ 发送License给用户（邮件/短信）
        if (licenseResult.success) {
            await sendLicenseToUser(order.userId, licenseResult.licenseKey);
        }

        // 9. 记录日志
        await prisma.paymentLog.create({
            data: {
                orderId: orderId,
                action: 'payment_success',
                transactionId: body.trade_no,
                amount: paidAmount,
                detail: body
            }
        });

        console.log('[Payment] Order processed successfully:', orderId);

        // 10. 返回success给支付宝
        return NextResponse.json({
            success: true
        });

    } catch (error) {
        console.error('[Payment] Callback error:', error);

        return NextResponse.json({
            error: '处理失败'
        }, { status: 500 });
    }
}

/**
 * 验证支付宝签名
 */
function verifyAlipaySign(params: any): boolean {
    try {
        // 1. 获取支付宝公钥
        const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY;

        if (!alipayPublicKey) {
            console.error('[Payment] Alipay public key not configured');
            return false;
        }

        // 2. 提取sign和sign_type
        const { sign, sign_type, ...otherParams } = params;

        // 3. 构建待签名字符串
        const sortedParams = Object.keys(otherParams)
            .sort()
            .filter(key => otherParams[key] !== '' && otherParams[key] !== null)
            .map(key => `${key}=${otherParams[key]}`)
            .join('&');

        // 4. 验证签名
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(sortedParams);

        const isValid = verify.verify(
            `-----BEGIN PUBLIC KEY-----\n${alipayPublicKey}\n-----END PUBLIC KEY-----`,
            sign,
            'base64'
        );

        return isValid;

    } catch (error) {
        console.error('[Payment] Sign verification error:', error);
        return false;
    }
}

/**
 * 为订单生成License
 */
async function generateLicenseForOrder(order: any): Promise<{
    success: boolean;
    licenseKey?: string;
    error?: string;
}> {
    try {
        // 调用管理员API生成License
        const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/generate-license`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-token': process.env.ADMIN_SECRET_TOKEN || ''
            },
            body: JSON.stringify({
                orderId: order.id,
                companyName: order.companyName || 'Unknown',
                plan: order.plan
            })
        });

        if (!response.ok) {
            const error = await response.json();
            return { success: false, error: error.error };
        }

        const result = await response.json();

        return {
            success: true,
            licenseKey: result.licenseKey
        };

    } catch (error: any) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 发送License给用户
 */
async function sendLicenseToUser(userId: string, licenseKey: string) {
    // TODO: 实现邮件/短信发送
    console.log(`[Payment] Send license ${licenseKey} to user ${userId}`);

    // 发送邮件
    // await sendEmail({
    //     to: user.email,
    //     subject: '您的授权码',
    //     body: `感谢购买！您的授权码是：${licenseKey}`
    // });
}
