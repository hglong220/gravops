// Background Service Worker for Screenshot Capture & E-commerce Copy
// Handles chrome.tabs.captureVisibleTab requests from content scripts
// + Auto-Publish functionality for ZCY

import { storage, type PublishConfig } from "~src/utils/storage"
import { fetchWithAuth } from "~src/utils/api"

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'capturePage') {
        // Capture the visible tab as PNG
        (async () => {
            try {
                // 优先使用 sender.tab 的 windowId，否则获取当前 active window
                let windowId = sender.tab?.windowId;

                if (!windowId) {
                    // 获取当前激活的窗口
                    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
                    windowId = tab?.windowId;
                }

                if (!windowId) {
                    sendResponse({ error: 'No active window found' });
                    return;
                }

                chrome.tabs.captureVisibleTab(
                    windowId,
                    { format: 'png' },
                    (dataUrl) => {
                        if (chrome.runtime.lastError) {
                            console.error('[Background] Capture error:', chrome.runtime.lastError);
                            sendResponse({ error: chrome.runtime.lastError.message });
                        } else {
                            // Remove data:image/png;base64, prefix
                            const imageBase64 = dataUrl.split(',')[1];
                            console.log('[Background] Screenshot captured, size:', Math.round(imageBase64.length / 1024), 'KB');
                            sendResponse({ imageBase64 });
                        }
                    }
                );
            } catch (error: any) {
                console.error('[Background] Capture exception:', error);
                sendResponse({ error: error.message || 'Capture failed' });
            }
        })();
        return true; // Keep message channel open for async response
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
    } else if (message.type === 'API_PROXY') {
        // 代理 API 请求到后端，绕过 Mixed Content 限制
        // Content Script (HTTPS页面) 无法直接访问 HTTP localhost
        // 但 Background Script (Service Worker) 可以
        (async () => {
            try {
                const { url, method, headers, body } = message;
                console.log('[Background] API_PROXY:', method, url);

                const response = await fetch(url, {
                    method: method || 'GET',
                    headers: headers || {},
                    body: body ? JSON.stringify(body) : undefined
                });

                const contentType = response.headers.get('content-type');
                let data;
                if (contentType?.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }

                sendResponse({
                    ok: response.ok,
                    status: response.status,
                    data
                });
            } catch (error: any) {
                console.error('[Background] API_PROXY error:', error);
                sendResponse({
                    ok: false,
                    status: 0,
                    error: error.message || 'Network error'
                });
            }
        })();
        return true; // Keep channel open for async response
    } else if (message.type === 'JD_DESCRIPTION_PROXY') {
        // 专门用于京东详情图 API，绕过 CORS 限制
        // Content Script 无法直接调用 cd.jd.com，但 Background Script 可以
        (async () => {
            try {
                const { skuId } = message;
                console.log('[Background] JD_DESCRIPTION_PROXY:', skuId);

                // 使用正确的 API 格式
                const apiUrl = `https://cd.jd.com/description/channel?skuId=${skuId}&channel=pc`;
                console.log('[Background] 请求 URL:', apiUrl);

                const response = await fetch(apiUrl, {
                    method: 'GET',
                    headers: {
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': `https://item.jd.com/${skuId}.html`,
                        'Origin': 'https://item.jd.com'
                    },
                    credentials: 'omit'  // 不发送 cookies，避免权限问题
                });

                console.log('[Background] 响应状态:', response.status);

                if (!response.ok) {
                    sendResponse({ ok: false, error: `HTTP ${response.status}` });
                    return;
                }

                // API 返回的是 JSONP 或纯 JSON 或 HTML
                const text = await response.text();
                console.log('[Background] 响应长度:', text.length, '前100字符:', text.substring(0, 100));

                // 尝试解析 JSON
                let data;
                try {
                    data = JSON.parse(text);
                } catch {
                    // 可能是 JSONP 格式，尝试提取
                    const jsonMatch = text.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        try {
                            data = JSON.parse(jsonMatch[0]);
                        } catch {
                            // 直接返回 HTML 内容
                            data = { content: text };
                        }
                    } else {
                        // 直接返回 HTML 内容
                        data = { content: text };
                    }
                }

                sendResponse({ ok: true, data });
            } catch (error: any) {
                console.error('[Background] JD_DESCRIPTION_PROXY error:', error);
                sendResponse({ ok: false, error: error.message || 'Network error' });
            }
        })();
        return true;
    } else if (message.type === 'GET_CURRENT_PRODUCT') {
        // 返回当前待填写的商品数据
        (async () => {
            try {
                const result = await chrome.storage.local.get(['currentProduct', 'pendingProduct']);
                const productData = result.pendingProduct || result.currentProduct;
                console.log('[Background] GET_CURRENT_PRODUCT:', productData?.title || 'none');
                sendResponse({ productData });
            } catch (e) {
                console.error('[Background] GET_CURRENT_PRODUCT error:', e);
                sendResponse({ productData: null });
            }
        })();
        return true;
    }
});

// Handle saving scraped product data to backend
async function handleSaveProduct(data: any): Promise<any> {
    console.log('[Background] Saving scraped product:', data.title);

    const response = await fetchWithAuth('/api/copy/save', {
        method: 'POST',
        body: JSON.stringify(data)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            (result as any)?.error ||
            (result as any)?.message ||
            `保存失败 (${response.status})`
        );
    }

    console.log('[Background] Save successful:', result);
    return { success: true, draft: (result as any).draft };
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

        // 2. 保存商品数据到 storage，供 auto-publisher 读取
        await chrome.storage.local.set({
            pendingProduct: {
                ...productData,
                config
            }
        });
        console.log('[Background] Saved pending product to storage');

        // 3. 构造发布页面URL
        const publishUrl = buildPublishUrl(productData, config);
        console.log('[Background] Publish URL:', publishUrl);

        // 4. 创建新Tab
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
        const backendUrl = process.env.PLASMO_PUBLIC_BACKEND_URL || '';
        if (!backendUrl) return;
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
    let response: Response;
    try {
        response = await fetchWithAuth('/api/copy/tasks/next-batch');
    } catch (error) {
        console.warn('[Task Runner] Failed to fetch tasks:', error);
        return;
    }

    if (!response.ok) {
        console.warn('[Task Runner] Failed to fetch tasks:', response.status);
        return;
    }

    const data = await response.json().catch(() => ({} as any));
    if (!data.task) {
        // No tasks pending
        return;
    }

    console.log('[Task Runner] Found task:', data.task);

    // 2. Open tab to process task
    // Append auto_scrape=true to trigger zcy-scraper.tsx
    let taskUrl = data.task.originalUrl;

    // Validate URL before constructing
    if (!taskUrl || typeof taskUrl !== 'string') {
        console.error('[Task Runner] Invalid task URL:', taskUrl);
        return;
    }

    // Ensure URL starts with http/https
    if (!taskUrl.startsWith('http://') && !taskUrl.startsWith('https://')) {
        console.error('[Task Runner] Task URL missing protocol:', taskUrl);
        return;
    }

    try {
        const targetUrl = new URL(taskUrl);
        targetUrl.searchParams.set('auto_scrape', 'true');

        await chrome.tabs.create({
            url: targetUrl.toString(),
            active: true // Set to false if we want background processing, but true is better for stability
        });
    } catch (e) {
        console.error('[Task Runner] Failed to parse task URL:', taskUrl, e);
    }

    // Note: The content script (zcy-scraper.tsx) will handle:
    // 1. Scrape data
    // 2. Save to backend (which updates status to 'scraped')
    // 3. Redirect to publish page (auto_publish=true)
    // 4. zcy-page.ts handles publish and closes tab
}
