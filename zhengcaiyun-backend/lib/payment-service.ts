/**
 * 支付服务 - 支付宝集成
 */

import crypto from 'crypto';

const ALIPAY_APP_ID = process.env.ALIPAY_APP_ID || '';
const ALIPAY_PRIVATE_KEY = process.env.ALIPAY_PRIVATE_KEY || '';
const ALIPAY_PUBLIC_KEY = process.env.ALIPAY_PUBLIC_KEY || '';
const ALIPAY_GATEWAY = 'https://openapi.alipay.com/gateway.do';

export interface PaymentOrder {
    orderId: string;
    amount: number;
    subject: string;
    body: string;
}

/**
 * 创建支付宝支付订单
 */
export async function createAlipayOrder(params: {
    orderId: string;
    amount: number;
    subject: string;
    returnUrl: string;
}): Promise<{ success: boolean; payUrl?: string; error?: string }> {
    console.log('[Payment] Creating Alipay order:', params);

    // Mock mode
    if (!ALIPAY_APP_ID || !ALIPAY_PRIVATE_KEY) {
        console.warn('[Payment] Using mock payment');
        return {
            success: true,
            payUrl: `https://mock-payment.com/pay?order=${params.orderId}&amount=${params.amount}`
        };
    }

    try {
        const bizContent = {
            out_trade_no: params.orderId,
            total_amount: params.amount.toFixed(2),
            subject: params.subject,
            product_code: 'FAST_INSTANT_TRADE_PAY'
        };

        const commonParams = {
            app_id: ALIPAY_APP_ID,
            method: 'alipay.trade.page.pay',
            format: 'JSON',
            charset: 'utf-8',
            sign_type: 'RSA2',
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            version: '1.0',
            notify_url: 'https://your-domain.com/api/payment/notify',
            return_url: params.returnUrl,
            biz_content: JSON.stringify(bizContent)
        };

        const sign = generateSign(commonParams, ALIPAY_PRIVATE_KEY);
        const payUrl = `${ALIPAY_GATEWAY}?${buildQuery({ ...commonParams, sign })}`;

        return { success: true, payUrl };

    } catch (error: any) {
        console.error('[Payment] Create order error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 验证支付宝回调签名
 */
export function verifyAlipayNotify(params: Record<string, any>): boolean {
    if (!ALIPAY_PUBLIC_KEY) {
        console.warn('[Payment] Mock verify');
        return true;
    }

    const { sign, sign_type, ...restParams } = params;

    const signStr = Object.keys(restParams)
        .sort()
        .map(key => `${key}=${restParams[key]}`)
        .join('&');

    const verify = crypto.createVerify('RSA-SHA256');
    verify.update(signStr);

    return verify.verify(ALIPAY_PUBLIC_KEY, sign, 'base64');
}

/**
 * 生成签名
 */
function generateSign(params: Record<string, any>, privateKey: string): string {
    const signStr = Object.keys(params)
        .filter(key => params[key] && key !== 'sign')
        .sort()
        .map(key => `${key}=${params[key]}`)
        .join('&');

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    return sign.sign(privateKey, 'base64');
}

/**
 * 构建查询字符串
 */
function buildQuery(params: Record<string, any>): string {
    return Object.keys(params)
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');
}
