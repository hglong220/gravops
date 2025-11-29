// Background Service Worker for Screenshot Capture & E-commerce Copy
// Handles chrome.tabs.captureVisibleTab requests from content scripts

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

// Task Runner Configuration
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
