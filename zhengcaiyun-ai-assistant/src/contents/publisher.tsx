import type { PlasmoCSConfig } from "plasmo"
import { fetchWithAuth } from "~src/utils/api"
import { uploadProduct } from "~src/utils/zcy-dom"

export const config: PlasmoCSConfig = {
    matches: ["https://www.zcygov.cn/publish*", "https://*.zcygov.cn/publish*"],
    run_at: "document_idle"
}

const initPublisher = async () => {
    const params = new URLSearchParams(window.location.search)
    const draftId = params.get('draft_id')

    if (!draftId) return

    console.log('[ZCY Publisher] 检测到自动发布任务，Draft ID:', draftId)

    // Show status overlay
    const overlay = document.createElement('div')
    overlay.id = 'zcy-auto-publish-overlay'
    overlay.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 10000;
    background: rgba(0,0,0,0.8); color: white; padding: 15px;
    border-radius: 8px; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex; flex-direction: column; gap: 8px; min-width: 200px;
  `
    overlay.innerHTML = `
        <div style="font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px; margin-bottom: 5px;">
            🤖 智能发布助手
        </div>
        <div id="zcy-status-text">正在获取商品数据...</div>
    `
    document.body.appendChild(overlay)

    const updateStatus = (text: string, type: 'info' | 'success' | 'error' = 'info') => {
        const statusEl = document.getElementById('zcy-status-text')
        if (statusEl) {
            statusEl.innerText = text
            if (type === 'success') overlay.style.background = 'rgba(82, 196, 26, 0.9)'
            if (type === 'error') overlay.style.background = 'rgba(255, 77, 79, 0.9)'
        }
    }

    try {
        // 1. Fetch Draft Data
        const res = await fetchWithAuth(`/api/copy/get?id=${draftId}`)
        if (!res.ok) throw new Error('获取数据失败')

        const { draft } = await res.json()
        const images = JSON.parse(draft.images || '[]')
        const attributes = JSON.parse(draft.attributes || '{}')
        const skuData = JSON.parse(draft.skuData || '{}')

        updateStatus(`正在自动填写: ${draft.title}`)

        // 2. Fill Form using zcy-dom
        const result = await uploadProduct({
            name: draft.title,
            category: draft.categoryPath?.split('/').pop(),
            images: images,
            description: draft.detailHtml,
            price: skuData.price || '0',
            stock: skuData.stock || '999',
            attributes: attributes
        })

        if (result.success) {
            updateStatus('✅ 填写完成，请人工核对后提交', 'success')
        } else {
            updateStatus(`❌ 填写中断: ${result.error}`, 'error')
        }

    } catch (err) {
        console.error(err)
        updateStatus(`❌ 错误: ${(err as Error).message}`, 'error')
    }
}

// Run init
if (document.readyState === 'complete') {
    initPublisher()
} else {
    window.addEventListener('load', initPublisher)
}
