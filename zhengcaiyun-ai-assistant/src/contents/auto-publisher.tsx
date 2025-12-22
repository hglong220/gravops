/**
 * Auto Publisher Content Script
 * 
 * 自动填写ZCY商品发布表单并提交
 * 只在发布页面(/goods/publish)运行
 */

import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: ["https://www.zcygov.cn/goods-center/goods/publish*"],
    run_at: "document_end"
}

// 立即打印，确认脚本加载
console.log('🔵 [AutoPublisher] ========== CONTENT SCRIPT LOADED ==========')
console.log('🔵 [AutoPublisher] URL:', window.location.href)

class AutoPublisher {
    private productData: any
    private config: any
    private maxRetries = 3
    private retryCount = 0
    private overlay: HTMLDivElement | null = null

    /**
     * 创建状态浮窗
     */
    private createOverlay() {
        if (this.overlay) return

        this.overlay = document.createElement('div')
        this.overlay.id = 'zcy-auto-publish-overlay'
        this.overlay.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 10000;
            background: rgba(0,0,0,0.8); color: white; padding: 15px;
            border-radius: 8px; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            display: flex; flex-direction: column; gap: 8px; min-width: 200px;
        `
        this.overlay.innerHTML = `
            <div style="font-weight: bold; border-bottom: 1px solid rgba(255,255,255,0.2); padding-bottom: 5px; margin-bottom: 5px;">
                🤖 智能发布助手
            </div>
            <div id="zcy-status-text">准备就绪...</div>
        `
        document.body.appendChild(this.overlay)
    }

    /**
     * 更新状态
     */
    private updateStatus(text: string, type: 'info' | 'success' | 'error' = 'info') {
        if (!this.overlay) this.createOverlay()

        const statusEl = document.getElementById('zcy-status-text')
        if (statusEl) {
            statusEl.innerText = text
            if (this.overlay) {
                if (type === 'success') this.overlay.style.background = 'rgba(82, 196, 26, 0.9)'
                if (type === 'error') this.overlay.style.background = 'rgba(255, 77, 79, 0.9)'
                else this.overlay.style.background = 'rgba(0,0,0,0.8)'
            }
        }
    }

    /**
     * 开始自动发布流程（集成智能填表）
     */
    async start(data: any) {
        this.createOverlay()
        this.productData = data
        this.config = data.config

        console.log('[AutoPublisher] Starting auto-publish with data:', this.productData)
        this.updateStatus('正在启动智能发布...')

        try {
            // 1. 等待表单加载
            console.log('[AutoPublisher] Waiting for form...')
            this.updateStatus('正在等待表单加载...')
            await this.waitForForm()

            // 2. 尝试智能填表
            console.log('[AutoPublisher] Starting smart fill...')
            this.updateStatus('正在智能填写表单...')
            const smartResult = await this.smartFill()

            if (smartResult.success) {
                console.log(`[AutoPublisher] Smart fill completed: ${smartResult.filled}/${smartResult.total} fields`)
                this.updateStatus(`智能填写完成: ${smartResult.filled}/${smartResult.total} 个字段`)
            }

            // 3. 填写动态属性（智能填表可能没覆盖的）
            console.log('[AutoPublisher] Filling dynamic attributes...')
            this.updateStatus('正在补充填写属性...')
            await this.fillDynamicAttributes()

            // 4. 上传图片
            console.log('[AutoPublisher] Uploading images...')
            this.updateStatus('正在上传图片 (可能需要较长时间)...')
            await this.uploadImages()

            // 5. 填写商品描述
            console.log('[AutoPublisher] Filling description...')
            this.updateStatus('正在填写商品详情...')
            await this.fillDescription()

            // 6. 填写SKU信息
            console.log('[AutoPublisher] Filling SKU...')
            this.updateStatus('正在填写SKU信息...')
            await this.fillSKU()

            // 7. 提交表单 - 暂时禁用
            console.log('[AutoPublisher] ⚠️ Auto-submit disabled - please review and submit manually')

            // 8. 完成
            console.log('[AutoPublisher] ✅ Form filling completed!')
            const method = smartResult.method === 'cache' ? '(缓存模式)' : '(AI 学习模式)'
            this.updateStatus(`✅ 填写完成！${method} 请人工核对后提交`, 'success')

        } catch (error) {
            console.error('[AutoPublisher] Auto publish failed:', error)
            this.handleError(error as Error)
        }
    }

    /**
     * 智能填表 - 先查缓存，没有则AI学习
     */
    private async smartFill(): Promise<{ success: boolean; filled: number; total: number; method: string }> {
        const API_BASE = 'http://localhost:3000'
        const { templateId, categoryId } = this.getUrlParams()

        // 方案一：查询缓存
        try {
            if (templateId || categoryId) {
                console.log('[SmartFill] 查询缓存...')
                const response = await fetch(
                    `${API_BASE}/api/form-mapping?templateId=${templateId}&categoryId=${categoryId}`
                )
                const data = await response.json()

                if (data.found) {
                    console.log('[SmartFill] ✓ 使用缓存映射')
                    const mapping = data.mapping.fieldMapping.fields
                    let filled = 0

                    for (const field of mapping) {
                        const value = this.getProductValue(field.dataKey)
                        if (value && this.fillFieldBySelector(field.selector, value)) {
                            filled++
                        }
                        await this.sleep(50) // 小延迟防止过快
                    }

                    // 更新成功计数
                    await fetch(`${API_BASE}/api/form-mapping`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: data.mapping.id, success: true })
                    })

                    return { success: true, filled, total: mapping.length, method: 'cache' }
                }
            }
        } catch (e) {
            console.warn('[SmartFill] 缓存查询失败:', e)
        }

        // 方案二：AI 学习
        console.log('[SmartFill] 无缓存，启动 AI 学习...')
        this.updateStatus('正在 AI 分析表单...')

        try {
            const fields = this.extractFormFields()
            console.log(`[SmartFill] 提取到 ${fields.length} 个表单字段`)

            const response = await fetch(`${API_BASE}/api/ai-form-analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields, productData: this.productData })
            })
            const data = await response.json()

            if (!data.mapping) {
                return { success: false, filled: 0, total: 0, method: 'ai' }
            }

            const mapping = data.mapping
            let filled = 0

            for (const field of mapping) {
                const value = this.getProductValue(field.dataKey)
                if (value && this.fillFieldBySelector(field.selector, value)) {
                    filled++
                }
                await this.sleep(50)
            }

            // 保存学习结果
            if (templateId && categoryId && filled > 0) {
                console.log('[SmartFill] 保存学习结果...')
                await fetch(`${API_BASE}/api/form-mapping`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        templateId,
                        categoryId,
                        categoryPath: this.productData.category,
                        urlPattern: window.location.pathname,
                        fields: mapping
                    })
                })
            }

            return { success: true, filled, total: mapping.length, method: 'ai' }

        } catch (e) {
            console.error('[SmartFill] AI 学习失败:', e)
            return { success: false, filled: 0, total: 0, method: 'ai' }
        }
    }

    /**
     * 从 URL 获取参数
     */
    private getUrlParams(): { templateId: string; categoryId: string } {
        const url = new URL(window.location.href)
        return {
            templateId: url.searchParams.get('templateId') || '',
            categoryId: url.searchParams.get('categoryId') || ''
        }
    }

    /**
     * 提取表单字段
     */
    private extractFormFields(): any[] {
        const results: any[] = []
        const inputs = document.querySelectorAll('input, select, textarea')

        inputs.forEach((el) => {
            const input = el as HTMLInputElement
            let label = ''

            if (input.id) {
                const labelEl = document.querySelector(`label[for="${input.id}"]`)
                if (labelEl) label = labelEl.textContent?.trim() || ''
            }

            if (!label) {
                let parent = input.parentElement
                for (let i = 0; i < 5 && parent; i++) {
                    const labelEl = parent.querySelector('label, .label, .ant-form-item-label')
                    if (labelEl) {
                        label = labelEl.textContent?.trim() || ''
                        break
                    }
                    parent = parent.parentElement
                }
            }

            if (!label && input.placeholder) label = input.placeholder
            if (!label && input.name) label = input.name

            let selector = ''
            if (input.id) selector = '#' + input.id
            else if (input.name) selector = `${input.tagName.toLowerCase()}[name="${input.name}"]`

            if ((label || input.name) && selector) {
                results.push({
                    label: label.replace(/[*：:]/g, '').trim(),
                    selector,
                    type: input.tagName.toLowerCase(),
                    required: input.required
                })
            }
        })

        return results
    }

    /**
     * 根据 dataKey 获取商品数据值
     */
    private getProductValue(dataKey: string): any {
        if (!dataKey) return null

        // 处理 specs.xxx 格式
        if (dataKey.startsWith('specs.')) {
            const specKey = dataKey.replace('specs.', '')
            const attrs = this.productData.attributes
            if (typeof attrs === 'string') {
                try {
                    const parsed = JSON.parse(attrs)
                    return parsed[specKey]
                } catch { }
            } else if (typeof attrs === 'object') {
                return attrs[specKey]
            }
            return null
        }

        return this.productData[dataKey]
    }

    /**
     * 通过选择器填写字段
     */
    private fillFieldBySelector(selector: string, value: any): boolean {
        try {
            const el = document.querySelector(selector) as HTMLInputElement
            if (!el) return false

            // React 兼容的填写方式
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype, 'value'
            )?.set

            if (nativeInputValueSetter) {
                nativeInputValueSetter.call(el, String(value))
            } else {
                el.value = String(value)
            }

            el.dispatchEvent(new Event('input', { bubbles: true }))
            el.dispatchEvent(new Event('change', { bubbles: true }))

            console.log(`[SmartFill] ✓ ${selector}: ${value}`)
            return true
        } catch (e) {
            console.warn(`[SmartFill] 填写失败 ${selector}:`, e)
            return false
        }
    }

    /**
     * 等待表单加载
     */
    private async waitForForm(): Promise<void> {
        const maxWait = 10000
        const start = Date.now()

        while (Date.now() - start < maxWait) {
            // 检查表单是否已加载（找任意一个表单元素）
            const form = document.querySelector('form, .ant-form, [class*="form"]')
            const inputs = document.querySelectorAll('input, select, textarea')

            if (form || inputs.length > 3) {
                console.log('[AutoPublisher] Form loaded')
                await this.sleep(1000) // 额外等待确保完全加载
                return
            }

            await this.sleep(500)
        }

        console.warn('[AutoPublisher] Form load timeout, proceeding anyway')
    }

    /**
     * 填写动态属性（智能填表可能没覆盖的字段）
     */
    private async fillDynamicAttributes(): Promise<void> {
        // 使用现有数据填写属性
        const attrs = this.productData.attributes
        if (!attrs) return

        let attrObj = attrs
        if (typeof attrs === 'string') {
            try {
                attrObj = JSON.parse(attrs)
            } catch {
                return
            }
        }

        // 尝试通过标签名匹配填写
        for (const [key, value] of Object.entries(attrObj)) {
            // 查找包含该属性名的输入框
            const labels = document.querySelectorAll('label, .ant-form-item-label')
            for (const label of labels) {
                if (label.textContent?.includes(key)) {
                    const parent = label.closest('.ant-form-item, .form-group')
                    if (parent) {
                        const input = parent.querySelector('input, select, textarea') as HTMLInputElement
                        if (input && !input.value) {
                            input.value = String(value)
                            input.dispatchEvent(new Event('input', { bubbles: true }))
                            input.dispatchEvent(new Event('change', { bubbles: true }))
                            console.log(`[AutoPublisher] Filled attr ${key} = ${value}`)
                        }
                    }
                    break
                }
            }
        }
    }

    /**
     * 上传图片
     */
    private async uploadImages(): Promise<void> {
        console.log('[AutoPublisher] 开始上传图片...')

        const images = this.productData.images || []
        const detailImages = this.productData.detailImages || []

        console.log('[AutoPublisher] 📷 主图数量:', Array.isArray(images) ? images.length : 'not array')
        console.log('[AutoPublisher] 📷 详情图数量:', Array.isArray(detailImages) ? detailImages.length : 'not array')
        if (detailImages.length > 0) {
            console.log('[AutoPublisher] 📷 详情图列表:', detailImages.slice(0, 5))
        }

        if (images.length === 0 && detailImages.length === 0) {
            console.log('[AutoPublisher] 没有图片需要上传')
            return
        }

        try {
            // 使用 AutoFillAIEngine 的图片上传功能（更完善，支持素材库）
            const { AutoFillAIEngine } = await import('../rpa/autofill-ai-engine')

            // 合并主图和详情图，按顺序上传
            // AutoFillAIEngine 会自动处理：前 8 张作为主图，之后作为详情图
            const allImages = [...images, ...detailImages]
            console.log('[AutoPublisher] 📷 合并后总图片数:', allImages.length)

            const { mainCount, detailCount } = await AutoFillAIEngine.uploadAllImages(allImages)
            console.log(`[AutoPublisher] ✓ 图片上传完成: 主图 ${mainCount} 张, 详情图 ${detailCount} 张`)
        } catch (e) {
            console.error('[AutoPublisher] 图片上传异常:', e)
        }
    }

    /**
     * 填写商品描述
     */
    private async fillDescription(): Promise<void> {
        // TODO: 实现描述填写
        console.log('[AutoPublisher] Description fill not implemented yet')
    }

    /**
     * 填写 SKU 信息
     */
    private async fillSKU(): Promise<void> {
        // 填写价格和库存
        const price = this.productData.price
        const stock = this.productData.stock || 99

        // 尝试填写价格
        const priceInputs = document.querySelectorAll('input[name*="price"], input[id*="price"], input[placeholder*="价格"]')
        for (const input of priceInputs) {
            const el = input as HTMLInputElement
            if (!el.value && price) {
                el.value = String(price)
                el.dispatchEvent(new Event('input', { bubbles: true }))
                el.dispatchEvent(new Event('change', { bubbles: true }))
            }
        }

        // 尝试填写库存
        const stockInputs = document.querySelectorAll('input[name*="stock"], input[id*="stock"], input[placeholder*="库存"]')
        for (const input of stockInputs) {
            const el = input as HTMLInputElement
            if (!el.value) {
                el.value = String(stock)
                el.dispatchEvent(new Event('input', { bubbles: true }))
                el.dispatchEvent(new Event('change', { bubbles: true }))
            }
        }
    }

    /**
     * 处理错误
     */
    private handleError(error: Error) {
        console.error('[AutoPublisher] Error:', error)
        this.updateStatus(`❌ 错误: ${error.message}`, 'error')

        // 是否重试
        if (this.retryCount < this.maxRetries) {
            this.retryCount++
            console.log(`[AutoPublisher] Retrying... (${this.retryCount}/${this.maxRetries})`)
            this.updateStatus(`出错，正在重试 (${this.retryCount}/${this.maxRetries})...`)
            setTimeout(() => this.start(this.productData), 2000)
            return
        }

        // 通知background失败
        chrome.runtime.sendMessage({
            type: 'PUBLISH_RESULT',
            success: false,
            message: error.message,
            productData: this.productData
        })

        // 禁用自动关闭，让用户看到错误
        console.log('[AutoPublisher] ⚠️ Auto-close disabled on error for debugging')
        // setTimeout(() => {
        //     window.close()
        // }, 3000)
    }

    /**
     * 填写单个字段 (React兼容)
     */
    private fillField(name: string, value: string): boolean {
        // ZCY使用id而不是name属性
        const input = document.querySelector(`#${name}`) as HTMLInputElement
        if (!input) {
            console.warn(`[AutoPublisher] Field not found: ${name}`)
            return false
        }

        // React兼容的setValue方法
        // 获取原生的value setter
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        )?.set

        if (nativeInputValueSetter) {
            nativeInputValueSetter.call(input, value)
        } else {
            input.value = value
        }

        // 触发React需要的所有事件
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        input.dispatchEvent(new Event('blur', { bubbles: true }))

        console.log(`[AutoPublisher] Filled ${name} = ${value}`)
        return true
    }

    /**
     * 延迟函数
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message) => {
    console.log('[AutoPublisher] Received message:', message.type)

    if (message.type === 'START_AUTO_PUBLISH') {
        console.log('[AutoPublisher] Starting auto-publish...')
        const publisher = new AutoPublisher()
        publisher.start(message.productData)
    }
})

// 自动检测并启动填写
async function autoDetectAndStart() {
    console.log('[AutoPublisher] Content script loaded, checking for pending product data...')

    // 等待页面完全加载
    await new Promise(resolve => setTimeout(resolve, 2000))

    // 1. 先检查 chrome.storage 中是否有待填写的商品数据
    try {
        const result = await chrome.storage.local.get(['pendingProduct', 'currentProduct'])
        const productData = result.pendingProduct || result.currentProduct

        if (productData && productData.title) {
            console.log('[AutoPublisher] Found pending product in storage:', productData.title)
            const publisher = new AutoPublisher()
            publisher.start(productData)
            return
        }
    } catch (e) {
        console.warn('[AutoPublisher] Failed to check storage:', e)
    }

    // 2. 检查 localStorage
    try {
        const localData = localStorage.getItem('zcy_pending_product')
        if (localData) {
            const productData = JSON.parse(localData)
            if (productData && productData.title) {
                console.log('[AutoPublisher] Found pending product in localStorage:', productData.title)
                const publisher = new AutoPublisher()
                publisher.start(productData)
                // 清除已使用的数据
                localStorage.removeItem('zcy_pending_product')
                return
            }
        }
    } catch (e) {
        console.warn('[AutoPublisher] Failed to check localStorage:', e)
    }

    // 3. 向 background 请求当前商品数据
    try {
        chrome.runtime.sendMessage({ type: 'GET_CURRENT_PRODUCT' }, (response) => {
            if (response && response.productData && response.productData.title) {
                console.log('[AutoPublisher] Got product from background:', response.productData.title)
                const publisher = new AutoPublisher()
                publisher.start(response.productData)
            } else {
                console.log('[AutoPublisher] No pending product data found, waiting for manual trigger...')
            }
        })
    } catch (e) {
        console.warn('[AutoPublisher] Failed to get product from background:', e)
    }
}

// 页面加载后自动检测
autoDetectAndStart()
