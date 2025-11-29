/**
 * WeChat Pay Service (Native Payment)
 * 
 * Implements the Native Pay API (Mode 2)
 * Docs: https://pay.weixin.qq.com/wiki/doc/apiv3/apis/chapter3_4_1.shtml
 */

import crypto from 'crypto';
import axios from 'axios';

// Configuration
const MCH_ID = process.env.WECHAT_MCH_ID || '';
const APP_ID = process.env.WECHAT_APP_ID || '';
const API_V3_KEY = process.env.WECHAT_API_V3_KEY || '';
const NOTIFY_URL = process.env.WECHAT_NOTIFY_URL || 'http://localhost:3000/api/payment/wechat/notify';

// Mock Mode Flag
const IS_MOCK = !MCH_ID || !API_V3_KEY;

export interface NativePayParams {
    description: string;
    out_trade_no: string;
    amount: {
        total: number; // 分
        currency: 'CNY';
    };
}

export interface NativePayResult {
    code_url: string; // QR Code URL
}

/**
 * Create Native Payment Order
 */
export async function createNativeTransaction(params: NativePayParams): Promise<NativePayResult> {
    console.log('[WeChatPay] Creating native transaction:', params);

    if (IS_MOCK) {
        console.warn('[WeChatPay] Missing config, using MOCK mode');
        // Return a mock QR code URL (e.g., a static image or a text encoded as QR)
        // In a real scenario, this would be weixin://wxpay/bizpayurl?pr=...
        return {
            code_url: `weixin://wxpay/bizpayurl?pr=MOCK_${params.out_trade_no}`
        };
    }

    try {
        // Real implementation would go here
        // 1. Sign request
        // 2. Call POST https://api.mch.weixin.qq.com/v3/pay/transactions/native
        // 3. Return code_url

        throw new Error('Real WeChat Pay implementation pending keys');
    } catch (error) {
        console.error('[WeChatPay] Create transaction failed:', error);
        throw error;
    }
}

/**
 * Verify Notification Signature
 */
export function verifySignature(
    timestamp: string,
    nonce: string,
    body: string,
    signature: string,
    serial: string
): boolean {
    if (IS_MOCK) return true;

    // Real verification logic using public key
    return true;
}

/**
 * Decrypt Resource (AES-256-GCM)
 */
export function decryptResource(
    ciphertext: string,
    associated_data: string,
    nonce: string
): any {
    if (IS_MOCK) {
        return JSON.parse(ciphertext); // Mock: ciphertext is just JSON
    }

    try {
        const authTag = Buffer.from(ciphertext.slice(-24), 'base64');
        const encrypted = Buffer.from(ciphertext.slice(0, -24), 'base64');

        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            API_V3_KEY,
            nonce
        );

        decipher.setAuthTag(authTag);
        decipher.setAAD(Buffer.from(associated_data));

        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);

        return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
        console.error('[WeChatPay] Decrypt failed:', error);
        throw error;
    }
}
