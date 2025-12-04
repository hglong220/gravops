/**
 * Backend Content Script
 * 运行在 localhost:3000 (任务中心页面)
 * 负责监听页面消息并转发给 Background Script
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["http://localhost:3000/*"],
    run_at: "document_end"
}

// 监听来自任务中心页面的发布触发消息
window.addEventListener('message', (event) => {
    // 只接受来自同源的消息
    if (event.origin !== window.location.origin) return

    if (event.data.type === 'TRIGGER_ZCY_PUBLISH') {
        console.log('[Backend CS] Received publish trigger from page:', event.data.data)

        // 检查 Chrome Extension API 是否可用
        if (typeof chrome === 'undefined' || !chrome.runtime) {
            console.error('[Backend CS] Chrome extension API not available!')
            return
        }

        // 转发给 background script
        chrome.runtime.sendMessage({
            type: 'TRIGGER_PUBLISH',
            productData: event.data.data
        }).then(() => {
            console.log('[Backend CS] Publish trigger sent to background successfully')
        }).catch(err => {
            console.error('[Backend CS] Failed to send publish trigger to background:', err)
        })
    }
})

console.log('[Backend CS] Content script loaded on localhost:3000')
