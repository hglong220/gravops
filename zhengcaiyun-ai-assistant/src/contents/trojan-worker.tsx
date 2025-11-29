import type { PlasmoCSConfig } from "plasmo"
import { uploadProduct, checkApprovalStatusFromDOM, clickEditButton, type ProductData } from "~src/utils/zcy-dom"
import { generateSubstituteProduct, isHighRiskProduct } from "~src/utils/trojan-strategy"
import { analyzeApprovalStatus, captureScreenshot } from "~src/services/ai-service"
import { getStoredLicense } from "~src/utils/license"

export const config: PlasmoCSConfig = {
    matches: ["https://www.zcygov.cn/*", "https://*.zcygov.cn/*"],
    run_at: "document_idle"
}

interface TrojanTask {
    id: string;
    step: 'init' | 'monitoring' | 'replacing' | 'completed' | 'failed';
    originalProduct: ProductData;
    substituteProduct?: ProductData;
    safeName?: string;
    productId?: string;
    lastChecked?: number;
    startTime: number;
}

const STORAGE_KEY = 'trojan_task';
const MONITOR_INTERVAL = 30000; // 30s check interval

const initWorker = async () => {
    // 1. Check for active task
    const storage = await chrome.storage.local.get(STORAGE_KEY);
    const task = storage[STORAGE_KEY] as TrojanTask;

    if (!task) return;

    console.log(`[Trojan Worker] Active Task Found: ${task.step}`, task);

    // 2. State Machine
    try {
        switch (task.step) {
            case 'init':
                await handleInitStep(task);
                break;
            case 'monitoring':
                await handleMonitoringStep(task);
                break;
            case 'replacing':
                await handleReplacingStep(task);
                break;
        }
    } catch (error) {
        console.error('[Trojan Worker] Error:', error);
        // Don't clear task immediately on error, might be transient
    }
}

// Step 1: Initialize & Upload Substitute
async function handleInitStep(task: TrojanTask) {
    // Only run if we are on the publish page
    if (!window.location.href.includes('/publish')) {
        console.log('[Trojan Worker] Navigating to publish page...');
        window.location.href = 'https://www.zcygov.cn/publish'; // Adjust URL as needed
        return;
    }

    // Check if we already generated a substitute
    let substitute = task.substituteProduct;
    if (!substitute) {
        const license = await getStoredLicense();
        if (!license) throw new Error('No license found');

        console.log('[Trojan Worker] Generating substitute...');
        substitute = await generateSubstituteProduct(
            task.originalProduct,
            license.licenseKey,
            task.safeName
        );

        // Save substitute to storage
        task.substituteProduct = substitute;
        await updateTask(task);
    }

    console.log('[Trojan Worker] Uploading substitute...');
    const result = await uploadProduct(substitute);

    if (result.success) {
        console.log('[Trojan Worker] Substitute uploaded. Switching to monitoring.');

        // Start ID extraction by navigating to product list and searching for the unique ID
        console.log('[Trojan Worker] Upload successful. Navigating to product list to find ID...');
        task.step = 'monitoring';
        task.lastChecked = 0; // Force immediate check
        await updateTask(task);

        // Wait briefly for server processing then redirect
        setTimeout(() => {
            window.location.href = 'https://www.zcygov.cn/product-list';
        }, 2000);
    } else {
        console.error('[Trojan Worker] Upload failed');
    }
}

// Step 2: Monitor Approval Status
async function handleMonitoringStep(task: TrojanTask) {
    if (!task.productId) {
        // We need to find the product ID. 
        // Heuristic: Look for the unique ID we injected into the substitute product name
        const nameToFind = task.substituteProduct?.name;
        if (!nameToFind) return;

        // Extract the unique ID tag [#XXXXXX]
        const uniqueIdMatch = nameToFind.match(/\[#([A-Z0-9]+)\]/);
        const uniqueTag = uniqueIdMatch ? uniqueIdMatch[0] : nameToFind;

        console.log(`[Trojan Worker] Looking for product with tag "${uniqueTag}"...`);

        // Basic DOM search for product name in list
        const rows = document.querySelectorAll('tr, .product-card, .list-item'); // Generic selectors
        for (const row of Array.from(rows)) {
            if (row.textContent?.includes(uniqueTag)) {
                // Try to find ID in links or data attributes or buttons
                // 1. Check link
                const link = row.querySelector('a[href*="product/"], a[href*="detail/"]');
                if (link) {
                    const match = link.getAttribute('href')?.match(/(?:product|detail)[/-](\d+)/);
                    if (match) {
                        task.productId = match[1];
                        console.log(`[Trojan Worker] Found Product ID via Link: ${task.productId}`);
                        await updateTask(task);
                        break;
                    }
                }

                // 2. Check edit button data attribute
                const editBtn = row.querySelector('[data-id], [data-product-id]');
                if (editBtn) {
                    const id = editBtn.getAttribute('data-id') || editBtn.getAttribute('data-product-id');
                    if (id) {
                        task.productId = id;
                        console.log(`[Trojan Worker] Found Product ID via Attribute: ${task.productId}`);
                        await updateTask(task);
                        break;
                    }
                }
            }
        }

        if (!task.productId) {
            console.log('[Trojan Worker] Product ID not found yet. Retrying in 5s...');
            setTimeout(() => window.location.reload(), 5000);
            return;
        }
    }

    // We have ID, check if we are on the detail page
    if (!window.location.href.includes(task.productId)) {
        console.log('[Trojan Worker] Navigating to product detail...');
        window.location.href = `https://www.zcygov.cn/product/${task.productId}`;
        return;
    }

    // Check interval
    if (task.lastChecked && Date.now() - task.lastChecked < MONITOR_INTERVAL) {
        console.log('[Trojan Worker] Too soon to check. Reloading in 30s...');
        setTimeout(() => window.location.reload(), MONITOR_INTERVAL);
        return;
    }

    // Check Status
    const domStatus = checkApprovalStatusFromDOM();
    console.log(`[Trojan Worker] Current Status: ${domStatus}`);

    if (domStatus === 'approved') {
        console.log('[Trojan Worker] Approved! Switching to replacing...');
        task.step = 'replacing';
        await updateTask(task);
        window.location.reload(); // Trigger next step
        return;
    } else if (domStatus === 'rejected') {
        console.warn('[Trojan Worker] Rejected. Task Failed.');
        task.step = 'failed';
        await updateTask(task);
        alert('木马策略失败：商品被驳回');
        return;
    }

    // Update last checked
    task.lastChecked = Date.now();
    await updateTask(task);
    setTimeout(() => window.location.reload(), MONITOR_INTERVAL);
}

// Step 3: Replace with Real Product
async function handleReplacingStep(task: TrojanTask) {
    // 1. Enter Edit Mode
    if (!window.location.href.includes('edit')) { // Assume edit url has 'edit'
        console.log('[Trojan Worker] Clicking Edit Button...');
        const success = await clickEditButton(task.productId);
        if (success) {
            // Wait for navigation
            return;
        } else {
            // Maybe we are already on edit page?
            // If not, try navigating to edit url directly if known
        }
    }

    // 2. Fill Real Data
    console.log('[Trojan Worker] Filling Real Data...');

    let retryCount = 0;
    const maxRetries = 3;
    let success = false;
    let lastError = '';

    while (retryCount < maxRetries && !success) {
        if (retryCount > 0) {
            console.log(`[Trojan Worker] Retry replacement (${retryCount}/${maxRetries})...`);
            await new Promise(r => setTimeout(r, 2000)); // Wait before retry
        }

        const result = await uploadProduct(task.originalProduct);
        if (result.success) {
            success = true;
        } else {
            lastError = result.error || 'Unknown error';
            retryCount++;
        }
    }

    if (success) {
        console.log('[Trojan Worker] Replacement Done!');
        task.step = 'completed';
        await updateTask(task);
        alert('木马策略成功！真实商品已上传。');
        // Clear task
        await chrome.storage.local.remove(STORAGE_KEY);
    } else {
        console.error('[Trojan Worker] Replacement Failed after retries:', lastError);
        task.step = 'failed';
        // Add specific error info to task for debugging
        // task.error = lastError;
        await updateTask(task);
        alert(`木马策略最终替换失败: ${lastError}\n请手动检查并修改商品信息。`);
    }
}

async function updateTask(task: TrojanTask) {
    await chrome.storage.local.set({ [STORAGE_KEY]: task });
}

// Run init
if (document.readyState === 'complete') {
    initWorker();
} else {
    window.addEventListener('load', initWorker);
}