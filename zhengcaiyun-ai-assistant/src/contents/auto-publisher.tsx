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
     * 开始自动发布流程
     */
    async start(data: any) {
        this.createOverlay()
        this.productData = data
        this.config = data.config

        console.log('[AutoPublisher] Starting auto-publish with data:', this.productData)
        this.updateStatus('正在启动自动发布...')

        try {
            // 1. 等待表单加载
            console.log('[AutoPublisher] Waiting for form...')
            this.updateStatus('正在等待表单加载...')
            await this.waitForForm()

            // 2. 填写基本信息
            console.log('[AutoPublisher] Filling basic info...')
            this.updateStatus('正在填写基本信息...')
            await this.fillBasicInfo()

            // 3. 填写动态属性
            console.log('[AutoPublisher] Filling dynamic attributes...')
            this.updateStatus('正在填写属性...')
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

            // 7. 提交表单 - 暂时禁用，让用户检查填写结果
            console.log('[AutoPublisher] ⚠️ Auto-submit disabled - please review and submit manually')
            // console.log('[AutoPublisher] Submitting form...')
            // await this.submitForm()

            // 8. 等待结果 - 暂时跳过
            // console.log('[AutoPublisher] Waiting for result...')
            // const result = await this.waitForResult()

            // 9. 通知background成功 - 暂时只显示完成消息
            console.log('[AutoPublisher] ✅ Form filling completed! Please review and submit manually.')
            this.updateStatus('✅ 填写完成！请人工核对后提交', 'success')
            // this.notifySuccess(result)

        } catch (error) {
            console.error('[AutoPublisher] Auto publish failed:', error)
            this.handleError(error as Error)
        }
    }

    // ... (keep existing methods) ...

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

console.log('[AutoPublisher] Content script loaded')
