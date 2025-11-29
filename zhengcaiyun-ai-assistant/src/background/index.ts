import { fetchWithAuth } from "~src/utils/api"

// Background Service Worker for Batch Task Execution
console.log('[ZCY Task Worker] Service worker initialized');

let isProcessing = false;
let processingTabs = new Set<number>();
const MAX_CONCURRENT = 3; // Maximum concurrent scraping tasks
const POLL_INTERVAL = 10000; // Poll every 10 seconds
const SCRAPE_TIMEOUT = 30000; // 30 seconds timeout per task

// Start polling when extension is installed
chrome.runtime.onInstalled.addListener(() => {
    console.log('[ZCY Task Worker] Extension installed, starting task worker');
    startTaskWorker();
});

// Start polling when browser starts
chrome.runtime.onStartup.addListener(() => {
    console.log('[ZCY Task Worker] Browser started, starting task worker');
    startTaskWorker();
});

function startTaskWorker() {
    // Initial check
    checkPendingTasks();

    // Set up interval
    setInterval(checkPendingTasks, POLL_INTERVAL);
}

async function checkPendingTasks() {
    if (isProcessing && processingTabs.size >= MAX_CONCURRENT) {
        return;
    }

    try {
        // Calculate how many we can take
        const limit = MAX_CONCURRENT - processingTabs.size;
        if (limit <= 0) return;

        const response = await fetchWithAuth(`/api/copy/tasks/pending?limit=${limit}`);

        // Handle 401 or other errors gracefully
        if (!response.ok) {
            console.log('[ZCY Task Worker] Failed to fetch tasks (auth or network error)');
            return;
        }

        const data = await response.json();
        const { tasks } = data; // Note: API returns { tasks: [...] } based on previous code

        if (!tasks || tasks.length === 0) {
            return;
        }

        console.log(`[ZCY Task Worker] Found ${tasks.length} pending tasks`);

        // Process each task
        for (const task of tasks) {
            if (processingTabs.size >= MAX_CONCURRENT) {
                break;
            }
            // Avoid processing same task if already in progress (though API should filter)
            await processTask(task);
        }

    } catch (error) {
        console.error('[ZCY Task Worker] Error checking pending tasks:', error);
    }
}

async function processTask(draft: any) {
    try {
        console.log(`[ZCY Task Worker] Processing task: ${draft.id} - ${draft.originalUrl}`);

        // Mark as processing
        isProcessing = true;

        // Create a new tab to scrape the product
        const tab = await chrome.tabs.create({
            url: draft.originalUrl,
            active: false // Open in background
        });

        if (tab.id) {
            processingTabs.add(tab.id);
            const tabId = tab.id;

            // Set a timeout to kill the tab if it hangs
            const timeoutId = setTimeout(() => {
                if (processingTabs.has(tabId)) {
                    console.warn(`[ZCY Task Worker] Task timed out: ${draft.id}`);
                    chrome.tabs.remove(tabId);
                    processingTabs.delete(tabId);
                    if (processingTabs.size === 0) isProcessing = false;
                }
            }, SCRAPE_TIMEOUT);

            // Listen for tab completion
            const listener = (tid: number, changeInfo: chrome.tabs.TabChangeInfo) => {
                if (tid === tabId && changeInfo.status === 'complete') {
                    // Remove listener
                    chrome.tabs.onUpdated.removeListener(listener);

                    // Inject scraping script
                    setTimeout(async () => {
                        try {
                            await chrome.scripting.executeScript({
                                target: { tabId: tabId },
                                func: scrapeAndSave,
                                args: [draft.id, draft.originalUrl]
                            });

                            // Clear timeout and close tab after success (wait a bit for fetch to complete)
                            setTimeout(() => {
                                clearTimeout(timeoutId);
                                if (processingTabs.has(tabId)) {
                                    chrome.tabs.remove(tabId).catch(() => { });
                                    processingTabs.delete(tabId);
                                    if (processingTabs.size === 0) isProcessing = false;
                                }
                            }, 5000);

                        } catch (error) {
                            console.error('[ZCY Task Worker] Error injecting script:', error);
                            clearTimeout(timeoutId);
                            chrome.tabs.remove(tabId).catch(() => { });
                            processingTabs.delete(tabId);
                            if (processingTabs.size === 0) isProcessing = false;
                        }
                    }, 3000); // Wait 3 seconds for page to fully load
                }
            };

            chrome.tabs.onUpdated.addListener(listener);
        }

    } catch (error) {
        console.error('[ZCY Task Worker] Error processing task:', error);
    }
}

// This function is injected into the target page to scrape data
// NOTE: This runs in the context of the page, so it cannot use imported modules like fetchWithAuth directly
// It must use standard fetch, but since we need auth, we might need to pass the token or handle it differently.
// However, for scraping, we might not need auth to *read* the page. 
// BUT we need auth to *save* the result.
// SOLUTION: Send message back to background script to save!
async function scrapeAndSave(draftId: string, originalUrl: string) {
    console.log('[ZCY Scraper] Starting scrape for draft:', draftId);

    try {
        // Extract product data
        const title = document.querySelector('.product-title, h1, .sku-name')?.textContent?.trim() || document.title;

        let images = Array.from(document.querySelectorAll('img')).map(img => img.src);
        images = images.filter(src =>
            !src.includes('avatar') &&
            !src.includes('icon') &&
            !src.includes('logo') &&
            (src.includes('jpg') || src.includes('png') || src.includes('jpeg'))
        );

        // Extract price (basic heuristic)
        let price = '0';
        const priceEl = document.querySelector('.price, .p-price, .sku-price, .J-p-3000'); // JD/Tmall selectors
        if (priceEl) {
            const priceText = priceEl.textContent?.replace(/[^\d.]/g, '');
            if (priceText) price = priceText;
        }

        // Send result back to background
        chrome.runtime.sendMessage({
            type: 'SCRAPE_RESULT',
            taskId: draftId,
            success: true,
            data: {
                title,
                images: [...new Set(images)].slice(0, 15),
                price,
                originalUrl
            }
        });

    } catch (error) {
        console.error('[ZCY Scraper] Error:', error);
        chrome.runtime.sendMessage({
            type: 'SCRAPE_RESULT',
            taskId: draftId,
            success: false,
            error: (error as Error).message
        });
    }
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPE_RESULT') {
        handleScrapeResult(message);
    }
    return true;
});

async function handleScrapeResult(message: any) {
    const { taskId, success, data, error } = message;

    try {
        if (success) {
            await fetchWithAuth('/api/copy/save', {
                method: 'POST',
                body: JSON.stringify({
                    id: taskId,
                    ...data,
                    status: 'scraped'
                })
            });
            console.log(`[ZCY Task Worker] Saved result for task ${taskId}`);
        } else {
            console.error(`[ZCY Task Worker] Task ${taskId} failed: ${error}`);
            // Optionally update status to failed
        }
    } catch (err) {
        console.error('[ZCY Task Worker] Save result failed:', err);
    }
}
