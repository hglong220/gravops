/**
 * Backend Content Script
 * Runs only on the local task center page to bridge messages to background.
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    // Keep a non-empty match to satisfy manifest validation; scoped to local dev server.
    matches: ["http://localhost:3000/*"],
    run_at: "document_end"
}

// Listen for publish trigger messages from the task center page.
window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return

    if (event.data.type === 'TRIGGER_ZCY_PUBLISH') {
        console.log('[Backend CS] Received publish trigger from page:', event.data.data)

        if (typeof chrome === 'undefined' || !chrome.runtime) {
            console.error('[Backend CS] Chrome extension API not available!')
            return
        }

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
