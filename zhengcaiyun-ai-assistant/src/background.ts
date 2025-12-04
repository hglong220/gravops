// Background Service Worker for Screenshot Capture & E-commerce Copy
// Handles chrome.tabs.captureVisibleTab requests from content scripts
// + Auto-Publish functionality for ZCY

import { storage, type PublishConfig } from "~src/utils/storage"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capturePage') {
        // Capture the visible tab as PNG
        if (sender.tab?.windowId) {
            chrome.tabs.captureVisibleTab(
                sender.tab.windowId,
                { format: 'png' },
                (dataUrl) => {
                    if (chrome.runtime.lastError) {
                        console.error('[Background] Capture error:', chrome.runtime.lastError);
                        sendResponse({ error: chrome.runtime.lastError.message });
                    } else {
                        // Remove data:image/png;base64, prefix
                        const imageBase64 = dataUrl.split(',')[1];
                        sendResponse({ imageBase64 });
                    }
                }
            );
            return true; // Keep message channel open for async response
        } else {
            sendResponse({ error: 'No active tab found' });
        }
    } else if (message.action === 'saveProduct') {
        // Handle client-side scraped product save
        handleSaveProduct(message.data).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    } else if (message.type === 'TRIGGER_PUBLISH') {
        // Handle auto-publish trigger
        handlePublishRequest(message.productData);
        sendResponse({ received: true });
        return true;
    } else if (message.type === 'PUBLISH_RESULT') {
        // Handle publish result
        handlePublishResult(message);
        sendResponse({ received: true });
        return true;
    } else if (message.type === 'SYNC_PERMISSIONS') {
        // Handle permission sync
        handleSyncPermissions(message.permissions);
        sendResponse({ received: true });
        return true;
    }
});

// Handle saving scraped product data to backend
async function handleSaveProduct(data: any): Promise<any> {
    console.log('[Background] Saving scraped product:', data.title);

    // Get License
    const storage = await chrome.storage.local.get('license');
    const license = storage.license;

    if (!license || !license.licenseKey) {
        throw new Error('未激活授权码,请先激活插件');
    }

    // Call Backend Save API
    const backendUrl = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    const apiUrl = `${backendUrl}/api/copy/save`;

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${license.licenseKey}`
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        const errorData = await response.json();
        // If backend returns 401/403, it means license is invalid/expired
        if (response.status === 401 || response.status === 403) {
            throw new Error('授权验证失败: ' + (errorData.error || '请检查授权码'));
        }
        throw new Error(errorData.error || '保存失败');
    }

    const result = await response.json();
    console.log('[Background] Save successful:', result);
    return { success: true, draft: result.draft };
}

console.log('[Background] Service worker initialized');

// ======================================
// Auto-Publish Functions
// ======================================

/**
 * 构造发布页面URL
 */
function buildPublishUrl(productData: any, config: PublishConfig): string {
    const params = new URLSearchParams({
        categoryId: productData.categoryId || config.defaultCategoryId || '',
        protocolId: config.protocolId,
        bidId: config.bidId,
        instanceCode: config.instanceCode
    });

    // 如果有spuId（编辑模式），添加到URL
    if (productData.spuId) {
        params.append('spuId', productData.spuId);
    }

    return `https://www.zcygov.cn/goods-center/goods/publish?${params.toString()}`;
}

/**
 * 处理发布请求
 */
async function handlePublishRequest(productData: any) {
    console.log('[Background] Received publish request:', productData);

    try {
        // 1. 读取配置
        const config = await storage.getConfig();
        if (!config) {
            console.error('[Background] No config found');
            chrome.runtime.sendMessage({
                type: 'PUBLISH_ERROR',
                message: '请先在插件设置中配置发布参数'
            });
            return;
        }

        console.log('[Background] Using config:', config);

        // 2. 构造发布页面URL
        const publishUrl = buildPublishUrl(productData, config);
        console.log('[Background] Publish URL:', publishUrl);

        // 3. 创建新Tab
        const tab = await chrome.tabs.create({
            url: publishUrl,
            active: true // 前台打开，确保用户看到
        });

        console.log('[Background] Created tab:', tab.id);

        // 4. 等待页面加载完成
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
            if (tabId === tab.id && changeInfo.status === 'complete') {
                console.log('[Background] Tab loaded, sending data to content script');

                // 移除监听器
                chrome.tabs.onUpdated.removeListener(listener);

                // 5. 向content script发送数据
                chrome.tabs.sendMessage(tab.id!, {
                    type: 'START_AUTO_PUBLISH',
                    productData: {
                        ...productData,
                        config // 同时传递配置
                    }
                }).catch(err => {
                    console.error('[Background] Failed to send message to content script:', err);
                });
            }
        });

        // 设置超时保护（5分钟）
        setTimeout(() => {
            chrome.tabs.get(tab.id!).then(t => {
                if (t && t.status !== 'complete') {
                    console.warn('[Background] Tab load timeout');
                    // chrome.tabs.remove(tab.id!); // Disable auto-close for now
                }
            }).catch(() => {
                // Tab可能已经关闭
            });
        }, 300000);

    } catch (error) {
        console.error('[Background] Error handling publish request:', error);
        chrome.runtime.sendMessage({
            type: 'PUBLISH_ERROR',
            message: '发布失败: ' + (error as Error).message
        });
    }
}

/**
 * 处理发布结果
 */
async function handlePublishResult(result: any) {
    console.log('[Background] Received publish result:', result);

    // 记录到历史
    await storage.addHistory({
        productName: result.productData?.title || '未知商品',
        publishTime: Date.now(),
        status: result.success ? 'success' : 'failed',
        errorMessage: result.success ? undefined : result.message
    });

    // 通知用户
    if (result.success) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '发布成功',
            message: result.message
        });
    } else {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: '发布失败',
            message: result.message
        });
    }
}

/**
 * 同步权限到后端
 */
async function handleSyncPermissions(permissions: any[]) {
    console.log('[Background] Syncing permissions:', permissions.length);

    try {
        const backendUrl = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
        await fetch(`${backendUrl}/api/user/permissions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permissions })
        });
        console.log('[Background] Permissions synced to backend');
    } catch (error) {
        console.error('[Background] Failed to sync permissions:', error);
    }
}

// ======================================
// Task Runner Configuration
// ======================================
const POLLING_INTERVAL = 5000; // 5 seconds
let isPolling = false;

// Start Polling Loop
setInterval(async () => {
    if (isPolling) return;

    // Check if Rapid Mode is enabled
    const storage = await chrome.storage.local.get('rapidMode');
    if (!storage.rapidMode) return;

    isPolling = true;
    try {
        await checkAndRunTask();
    } catch (error) {
        console.error('[Task Runner] Error:', error);
    } finally {
        isPolling = false;
    }
}, POLLING_INTERVAL);

async function checkAndRunTask() {
    // 1. Get next task from backend
    const backendUrl = process.env.PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
    // Use test user for now as background script auth is tricky
    // In production, we should pass the token
    const response = await fetch(`${backendUrl}/api/copy/tasks/next-batch`);

    if (!response.ok) {
        console.warn('[Task Runner] Failed to fetch tasks');
        return;
    }

    const data = await response.json();
    if (!data.task) {
        // No tasks pending
        return;
    }

    console.log('[Task Runner] Found task:', data.task);

    // 2. Open tab to process task
    // Append auto_scrape=true to trigger zcy-scraper.tsx
    const targetUrl = new URL(data.task.originalUrl);
    targetUrl.searchParams.set('auto_scrape', 'true');

    await chrome.tabs.create({
        url: targetUrl.toString(),
        active: true // Set to false if we want background processing, but true is better for stability
    });

    // Note: The content script (zcy-scraper.tsx) will handle:
    // 1. Scrape data
    // 2. Save to backend (which updates status to 'scraped')
    // 3. Redirect to publish page (auto_publish=true)
    // 4. zcy-page.ts handles publish and closes tab
}
