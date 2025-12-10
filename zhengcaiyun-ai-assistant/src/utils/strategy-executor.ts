/**
 * 策略执行器 - 从服务端获取策略并执行
 * 
 * 插件只是"执行器"，所有采集逻辑来自服务端
 */

import CryptoJS from 'crypto-js';

// 策略解密密钥
const STRATEGY_SECRET = 'gravops-strategy-secret-key-2024';
const BACKEND_URL = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

// 缓存
let cachedStrategies: any = null;
let cacheExpiry: number = 0;

// 解密策略
function decryptStrategy(encrypted: string): any {
    try {
        const bytes = CryptoJS.AES.decrypt(encrypted, STRATEGY_SECRET);
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return JSON.parse(decrypted);
    } catch (error) {
        console.error('[Executor] Strategy decryption failed:', error);
        return null;
    }
}

// 从服务端获取策略
export async function fetchStrategy(platform?: string): Promise<any> {
    // 检查缓存
    if (cachedStrategies && Date.now() < cacheExpiry) {
        if (platform) {
            return cachedStrategies[platform] || null;
        }
        return cachedStrategies;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/plugin/strategy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, action: platform ? undefined : 'all' })
        });

        if (!response.ok) {
            console.error('[Executor] Failed to fetch strategy');
            return null;
        }

        const data = await response.json();
        const payload = decryptStrategy(data.data);

        if (!payload) return null;

        // 缓存策略
        cachedStrategies = payload.strategy;
        cacheExpiry = Date.now() + (payload.expiresIn || 3600000);

        if (platform) {
            return payload.strategy[platform] || payload.strategy;
        }
        return payload.strategy;

    } catch (error) {
        console.error('[Executor] Error fetching strategy:', error);
        return null;
    }
}

// 检测当前页面平台
export function detectPlatform(url: string): string | null {
    if (url.includes('item.jd.com') || url.includes('item.m.jd.com')) {
        return 'jd';
    }
    if (url.includes('detail.tmall.com') || url.includes('chaoshi.detail.tmall.com')) {
        return 'tmall';
    }
    if (url.includes('product.suning.com') || url.includes('item.suning.com')) {
        return 'suning';
    }
    if (url.includes('zcygov.cn')) {
        return 'zcy';
    }
    return null;
}

// 执行策略脚本 - 通过background service worker执行
export async function executeScript(scriptCode: string): Promise<any> {
    return new Promise((resolve) => {
        try {
            // 发送消息给background执行脚本（使用IIFE包装）
            chrome.runtime.sendMessage(
                { action: 'executeStrategy', scriptCode: `(function() { ${scriptCode} })()` },
                (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('[Executor] Message error:', chrome.runtime.lastError);
                        resolve(null);
                    } else if (response?.success) {
                        resolve(response.data);
                    } else {
                        console.error('[Executor] Execution error:', response?.error);
                        resolve(null);
                    }
                }
            );
        } catch (error) {
            console.error('[Executor] Script execution failed:', error);
            resolve(null);
        }
    });
}

// 使用策略采集商品数据
export async function scrapeWithStrategy(strategy: any): Promise<any> {
    const result: any = {
        platform: strategy.platform,
        timestamp: Date.now()
    };

    try {
        // 执行各个采集脚本
        if (strategy.scripts) {
            if (strategy.scripts.getTitle) {
                result.title = await executeScript(strategy.scripts.getTitle);
            }
            if (strategy.scripts.getPrice) {
                result.price = await executeScript(strategy.scripts.getPrice);
            }
            if (strategy.scripts.getImages) {
                result.images = await executeScript(strategy.scripts.getImages);
            }
            if (strategy.scripts.getParams) {
                result.params = await executeScript(strategy.scripts.getParams);
            }
            if (strategy.scripts.getDetailImages) {
                result.detailImages = await executeScript(strategy.scripts.getDetailImages);
            }
        }

        console.log('[Executor] Scrape result:', result);
        return result;

    } catch (error) {
        console.error('[Executor] Scrape failed:', error);
        return null;
    }
}

// 主入口：自动检测平台并采集
export async function autoScrape(): Promise<any> {
    const url = window.location.href;
    const platform = detectPlatform(url);

    if (!platform) {
        console.warn('[Executor] Unknown platform:', url);
        return null;
    }

    console.log('[Executor] Detected platform:', platform);

    // 获取策略
    const strategy = await fetchStrategy(platform);
    if (!strategy) {
        console.error('[Executor] No strategy available for:', platform);
        return null;
    }

    console.log('[Executor] Got strategy for:', platform);

    // 执行采集
    return await scrapeWithStrategy(strategy);
}

// 清除缓存
export function clearCache() {
    cachedStrategies = null;
    cacheExpiry = 0;
}
