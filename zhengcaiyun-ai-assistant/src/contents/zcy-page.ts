import type { PlasmoCSConfig } from "plasmo"
import { getCompanyNameFromZCY } from "~src/utils/zcy-extractor"
import { visualAnalyze } from "~src/services/api-client"
import { checkAuthorization, getStoredLicense } from "~src/utils/license"
import { uploadProduct, type ProductData, checkApprovalStatusFromDOM, clickEditButton } from "~src/utils/zcy-dom"
import { executeTrojanStrategy } from "~src/utils/trojan-strategy"
import { withRetry, logError } from "~src/utils/error-handler"
import { executeSmartUpload, type SmartUploadOptions } from "~src/utils/smart-upload"

export const config: PlasmoCSConfig = {
    matches: ["https://*.zcygov.cn/*"],
    all_frames: true
}

console.log('[政采云智能助手] Content Script已加载');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

async function init() {
    console.log('[ZCY助手] 初始化...');

    if (!window.location.hostname.includes('zcygov.cn')) {
        console.log('[ZCY助手] 不在政采云页面');
        return;
    }

    const companyName = await getCompanyNameFromZCY();
    if (companyName) {
        console.log('[ZCY助手] 检测到公司:', companyName);

        const authorized = await checkAuthorization(companyName);
        if (authorized) {
            console.log('[ZCY助手] 授权验证通过');
            initializeFeatures();
            checkTrojanTask(); // Check for pending tasks
        } else {
            console.warn('[ZCY助手] 未授权');
            showUnauthorizedNotice();
        }
    } else {
        console.warn('[ZCY助手] 无法提取公司名称');
    }

    // Check for auto-publish flag
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('auto_publish') === 'true') {
        console.log('[ZCY助手] ⚡ 急速模式：自动发布中...');
        await handleAutoPublish();
    }
}

async function handleAutoPublish() {
    // Wait for page load and button availability
    await new Promise(r => setTimeout(r, 3000));

    const publishBtn = Array.from(document.querySelectorAll('button')).find(b =>
        b.textContent?.includes('发布') || b.textContent?.includes('提交')
    );

    if (publishBtn) {
        console.log('[ZCY助手] 找到发布按钮，点击中...');
        publishBtn.click();

        // Wait for success message or redirect
        setTimeout(() => {
            // Optional: Close tab if successful? 
            // window.close() only works if script opened it, which is true here.
            // But let's just show a notification for safety.
            alert('⚡ 急速模式：商品已自动发布！');
            window.close();
        }, 2000);
    } else {
        console.error('[ZCY助手] 未找到发布按钮');
        alert('⚡ 急速模式：自动发布失败，未找到按钮，请手动点击。');
    }
}

async function checkTrojanTask() {
    const storage = await chrome.storage.local.get('trojan_task');
    const task = storage.trojan_task;

    if (!task) return;

    console.log('[Trojan] Found active task:', task);

    // State Machine
    switch (task.step) {
        case 'init':
            // Step 1: Upload Safe Product
            console.log('[Trojan] Step 1: Uploading Safe Product...');
            if (window.location.href.includes('/publish')) {
                const result = await uploadProduct(task.substituteProduct || {
                    name: task.safeName || '办公用品',
                    category: '办公设备',
                    price: task.originalProduct.price,
                    stock: task.originalProduct.stock,
                    images: []
                });

                if (result.success) {
                    // Update task to monitoring
                    task.step = 'monitoring';
                    task.startTime = Date.now();
                    await chrome.storage.local.set({ 'trojan_task': task });
                    console.log('[Trojan] Safe product uploaded. Switching to monitoring.');
                    alert('安全商品已上传！开始监控审核状态...');
                    // Navigate to list page to monitor
                    window.location.href = 'https://www.zcygov.cn/back/goods/list';
                } else {
                    console.error('[Trojan] Upload failed:', result.error);
                    alert('安全商品上传失败: ' + result.error);
                    await chrome.storage.local.remove('trojan_task');
                }
            } else {
                // Redirect to publish page
                window.location.href = 'https://www.zcygov.cn/publish';
            }
            break;

        case 'monitoring':
            // Step 2: Monitor Approval
            console.log('[Trojan] Step 2: Monitoring Approval...');

            // Check if we are on list page
            if (!window.location.href.includes('/goods/list')) {
                window.location.href = 'https://www.zcygov.cn/back/goods/list';
                return;
            }

            // Check status from DOM
            // We need to find the product we just uploaded. 
            // Assuming it's the first one or we search by name.
            // For MVP, let's assume it's the top one.
            await new Promise(r => setTimeout(r, 3000)); // Wait for load

            const status = checkApprovalStatusFromDOM(); // This function needs to be robust
            console.log('[Trojan] Current Status:', status);

            if (status === 'approved') {
                console.log('[Trojan] Approved! Switching to replacing.');
                task.step = 'replacing';
                await chrome.storage.local.set({ 'trojan_task': task });

                // Click edit
                const editSuccess = await clickEditButton(); // Clicks first edit button
                if (!editSuccess) {
                    alert('审核通过，但无法找到编辑按钮。请手动编辑。');
                }
            } else if (status === 'rejected') {
                console.warn('[Trojan] Rejected.');
                alert('木马策略失败：安全商品被驳回。');
                await chrome.storage.local.remove('trojan_task');
            } else {
                // Still pending
                console.log('[Trojan] Still pending. Reloading in 10s...');
                setTimeout(() => {
                    window.location.reload();
                }, 10000);
            }
            break;

        case 'replacing':
            // Step 3: Upload Real Product
            console.log('[Trojan] Step 3: Uploading Real Product...');

            // We should be on the edit page now
            // Wait for page load
            await new Promise(r => setTimeout(r, 2000));

            const restoreResult = await uploadProduct(task.originalProduct);

            if (restoreResult.success) {
                console.log('[Trojan] Real product restored!');
                alert('✅ 木马策略执行成功！真实商品已还原。');
                await chrome.storage.local.remove('trojan_task');
                // Submit
                const submitBtn = document.querySelector('button[type="submit"]') as HTMLElement;
                if (submitBtn) submitBtn.click();
            } else {
                console.error('[Trojan] Restore failed:', restoreResult.error);
                alert('还原真实商品失败: ' + restoreResult.error);
                // Don't clear task, let user retry
            }
            break;
    }
}

function initializeFeatures() {
    createFloatingButton();

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startUpload') {
            handleProductUpload(message.data).then(result => {
                sendResponse(result);
            });
            return true;
        } else if (message.action === 'startTrojanUpload') {
            handleTrojanUpload(message.data).then(result => {
                sendResponse(result);
            });
            return true;
        } else if (message.action === 'startSmartUpload') {
            // 新增：智能上传
            handleSmartUpload(message.data).then(result => {
                sendResponse(result);
            });
            return true;
        } else if (message.action === 'getCompanyName') {
            getCompanyNameFromZCY().then(name => {
                sendResponse({ companyName: name });
            });
            return true;
        }
    });
}

function createFloatingButton() {
    const button = document.createElement('div');
    button.id = 'zcy-ai-assistant-button';
    button.innerHTML = '🤖 AI助手';
    button.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 12px 20px;
    border-radius: 25px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    transition: all 0.3s;
    user-select: none;
  `;

    button.addEventListener('mouseenter', () => {
        button.style.transform = 'translateY(-2px)';
        button.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
    });

    button.addEventListener('mouseleave', () => {
        button.style.transform = 'translateY(0)';
        button.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    });

    button.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'openPopup' });
    });

    document.body.appendChild(button);
}

function showUnauthorizedNotice() {
    const notice = document.createElement('div');
    notice.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10001;
    background: #fff3cd;
    border: 1px solid #ffc107;
    color: #856404;
    padding: 16px;
    border-radius: 8px;
    max-width: 300px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  `;
    notice.innerHTML = `<strong>⚠️ 未授权</strong><br>请先激活政采云智能助手插件`;

    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 5000);
}

async function handleProductUpload(productData: ProductData): Promise<any> {
    console.log('[ZCY助手] 开始上传商品:', productData);

    try {
        const result = await withRetry(
            () => uploadProduct(productData),
            { maxRetries: 2, delayMs: 2000 }
        );

        console.log('[ZCY助手] 上传结果:', result);
        return result;
    } catch (error) {
        logError('商品上传', error as Error, { productData });
        return { success: false, error: (error as Error).message };
    }
}

async function handleTrojanUpload(productData: ProductData): Promise<any> {
    console.log('[ZCY助手] 使用木马策略上传:', productData);

    try {
        const license = await getStoredLicense();
        if (!license) throw new Error('License not found');

        const result = await executeTrojanStrategy(
            productData,
            license.licenseKey,
            (status) => {
                console.log('[Trojan] 状态:', status);
                chrome.runtime.sendMessage({
                    action: 'trojanProgress',
                    status
                });
            }
        );

        return result;
    } catch (error) {
        logError('木马策略上传', error as Error, { productData });
        return { success: false, error: (error as Error).message };
    }
}

async function handleSmartUpload(options: SmartUploadOptions): Promise<any> {
    console.log('[ZCY助手] 开始智能上传 (含视觉分析):', options);
    try {
        // 1️⃣ 通过后台脚本截图
        const response = await chrome.runtime.sendMessage({ action: 'capturePage' });
        if (response.error) {
            throw new Error(`截图失败: ${response.error}`);
        }
        const { imageBase64 } = response;

        // 2️⃣ 调用后端视觉分析
        const visualResult = await visualAnalyze(imageBase64, options.licenseKey);
        console.log('[ZCY助手] 视觉分析结果:', visualResult);

        // 3️⃣ 将视觉分析结果合并到 options
        const enrichedOptions = { ...options, visualResult };

        // 4️⃣ 执行原有智能上传流程
        const result = await executeSmartUpload(enrichedOptions);
        console.log('[ZCY助手] 智能上传结果:', result);
        return result;
    } catch (error) {
        logError('智能上传', error as Error, { options });
        return { success: false, error: (error as Error).message };
    }
}

(window as any).zcyAssistant = {
    getCompanyName: getCompanyNameFromZCY,
    uploadProduct: handleProductUpload,
    trojanUpload: handleTrojanUpload,
    smartUpload: handleSmartUpload
};
