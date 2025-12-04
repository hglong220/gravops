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

console.log("[ZCY Assistant] content script loaded")

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
} else {
    init()
}

async function init() {
    console.log("[ZCY Assistant] init")

    if (!window.location.hostname.includes("zcygov.cn")) {
        console.log("[ZCY Assistant] not on Zhengcaiyun page, skip")
        return
    }

    const storedLicense = await getStoredLicense()
    let companyName = await getCompanyNameFromZCY()

    if (!companyName && storedLicense?.companyName) {
        console.warn("[ZCY Assistant] DOM company missing, fallback to stored license company:", storedLicense.companyName)
        companyName = storedLicense.companyName
    }

    if (companyName) {
        console.log("[ZCY Assistant] company:", companyName)
    } else {
        console.warn("[ZCY Assistant] cannot get company name, please login")
    }

    // 开发调试：跳过授权校验，直接启用功能，避免阻断页面
    initializeFeatures()
    checkTrojanTask()

    // Check for auto-publish flag
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("auto_publish") === "true") {
        console.log("[ZCY Assistant] 极速模式：自动发布开始")
        await handleAutoPublish()
    }
}

async function handleAutoPublish() {
    // Wait for page load and button availability
    await new Promise((r) => setTimeout(r, 3000))

    const publishBtn = Array.from(document.querySelectorAll("button")).find(
        (b) => b.textContent?.includes("发布") || b.textContent?.includes("提交")
    )

    if (publishBtn) {
        console.log("[ZCY Assistant] 点击发布按钮")
        publishBtn.click()

        // Wait for success message or redirect
        setTimeout(() => {
            alert("极速模式：商品已自动发布！")
            window.close()
        }, 2000)
    } else {
        console.error("[ZCY Assistant] 未找到发布按钮")
        alert("极速模式：自动发布失败，未找到按钮，请手动点击。")
    }
}

async function checkTrojanTask() {
    const storage = await chrome.storage.local.get("trojan_task")
    const task = storage.trojan_task

    if (!task) return

    console.log("[Trojan] Found active task:", task)

    // State Machine
    switch (task.step) {
        case "init":
            // Step 1: Upload Safe Product
            console.log("[Trojan] Step 1: Uploading Safe Product...")
            if (window.location.href.includes("/publish")) {
                const result = await uploadProduct(
                    task.substituteProduct || {
                        name: task.safeName || "办公用品",
                        category: "办公设备",
                        price: task.originalProduct.price,
                        stock: task.originalProduct.stock,
                        images: []
                    }
                )

                if (result.success) {
                    // Update task to monitoring
                    task.step = "monitoring"
                    task.startTime = Date.now()
                    await chrome.storage.local.set({ trojan_task: task })
                    console.log("[Trojan] Safe product uploaded. Switching to monitoring.")
                    alert("安全商品已上传！开始监控审核状态。")
                    // Navigate to list page to monitor
                    window.location.href = "https://www.zcygov.cn/back/goods/list"
                } else {
                    console.error("[Trojan] Upload failed:", result.error)
                    alert("安全商品上传失败: " + result.error)
                    await chrome.storage.local.remove("trojan_task")
                }
            } else {
                // Redirect to publish page
                window.location.href = "https://www.zcygov.cn/publish"
            }
            break

        case "monitoring":
            // Step 2: Monitor Approval
            console.log("[Trojan] Step 2: Monitoring Approval...")

            // Check if we are on list page
            if (!window.location.href.includes("/goods/list")) {
                window.location.href = "https://www.zcygov.cn/back/goods/list"
                return
            }

            // Check status from DOM
            // We need to find the product we just uploaded.
            // Assuming it's the first one or we search by name.
            await new Promise((r) => setTimeout(r, 3000)) // Wait for load

            const status = checkApprovalStatusFromDOM() // This function needs to be robust
            console.log("[Trojan] Current Status:", status)

            if (status === "approved") {
                console.log("[Trojan] Approved! Switching to replacing.")
                task.step = "replacing"
                await chrome.storage.local.set({ trojan_task: task })

                // Click edit
                const editSuccess = await clickEditButton() // Clicks first edit button
                if (!editSuccess) {
                    alert("审核通过，但未找到编辑按钮，请手动编辑。")
                }
            } else if (status === "rejected") {
                console.warn("[Trojan] Rejected.")
                alert("木马策略失败：安全商品被驳回。")
                await chrome.storage.local.remove("trojan_task")
            } else {
                // Still pending
                console.log("[Trojan] Still pending. Reloading in 10s...")
                setTimeout(() => {
                    window.location.reload()
                }, 10000)
            }
            break

        case "replacing":
            // Step 3: Upload Real Product
            console.log("[Trojan] Step 3: Uploading Real Product...")

            // We should be on the edit page now
            // Wait for page load
            await new Promise((r) => setTimeout(r, 2000))

            const restoreResult = await uploadProduct(task.originalProduct)

            if (restoreResult.success) {
                console.log("[Trojan] Real product restored!")
                alert("木马策略执行成功！真实商品已还原。")
                await chrome.storage.local.remove("trojan_task")
                // Submit
                const submitBtn = document.querySelector('button[type="submit"]') as HTMLElement
                if (submitBtn) submitBtn.click()
            } else {
                console.error("[Trojan] Restore failed:", restoreResult.error)
                alert("还原真实商品失败: " + restoreResult.error)
                // Don't clear task, let user retry
            }
            break
    }
}

function initializeFeatures() {
    // Floating button handled by zcy-scraper.tsx

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "startUpload") {
            handleProductUpload(message.data).then((result) => {
                sendResponse(result)
            })
            return true
        } else if (message.action === "startTrojanUpload") {
            handleTrojanUpload(message.data).then((result) => {
                sendResponse(result)
            })
            return true
        } else if (message.action === "startSmartUpload") {
            // 新增：智能上传
            handleSmartUpload(message.data).then((result) => {
                sendResponse(result)
            })
            return true
        } else if (message.action === "getCompanyName") {
            getCompanyNameFromZCY().then((name) => {
                sendResponse({ companyName: name })
            })
            return true
        }
    })
}

// Floating button is now handled by zcy-scraper.tsx

async function handleProductUpload(productData: ProductData): Promise<any> {
    console.log("[ZCY Assistant] 开始上传商品", productData)

    try {
        const result = await withRetry(() => uploadProduct(productData), {
            maxRetries: 2,
            delayMs: 2000
        })

        console.log("[ZCY Assistant] 上传结果:", result)
        return result
    } catch (error) {
        logError("商品上传", error as Error, { productData })
        return { success: false, error: (error as Error).message }
    }
}

async function handleTrojanUpload(productData: ProductData): Promise<any> {
    console.log("[ZCY Assistant] 使用木马策略上传:", productData)

    try {
        const license = await getStoredLicense()
        if (!license) throw new Error("License not found")

        const result = await executeTrojanStrategy(productData, license.licenseKey, (status) => {
            console.log("[Trojan] 状态", status)
            chrome.runtime.sendMessage({
                action: "trojanProgress",
                status
            })
        })

        return result
    } catch (error) {
        logError("木马策略上传", error as Error, { productData })
        return { success: false, error: (error as Error).message }
    }
}

async function handleSmartUpload(options: SmartUploadOptions): Promise<any> {
    console.log("[ZCY Assistant] 开始智能上传(含视觉分析):", options)
    try {
        // 1️⃣ 后台脚本截图
        const response = await chrome.runtime.sendMessage({ action: "capturePage" })
        if (response.error) {
            throw new Error(`截图失败: ${response.error}`)
        }
        const { imageBase64 } = response

        // 2️⃣ 视觉分析
        const visualResult = await visualAnalyze(imageBase64, options.licenseKey)
        console.log("[ZCY Assistant] 视觉分析结果:", visualResult)

        // 3️⃣ 合并视觉分析结果
        const enrichedOptions = { ...options, visualResult }

        // 4️⃣ 执行智能上传流程
        const result = await executeSmartUpload(enrichedOptions)
        console.log("[ZCY Assistant] 智能上传结果:", result)
        return result
    } catch (error) {
        logError("智能上传", error as Error, { options })
        return { success: false, error: (error as Error).message }
    }
}

; (window as any).zcyAssistant = {
    getCompanyName: getCompanyNameFromZCY,
    uploadProduct: handleProductUpload,
    trojanUpload: handleTrojanUpload,
    smartUpload: handleSmartUpload
}
