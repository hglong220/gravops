/**
 * Chrome Storage 工具 - 用于保存和读取发布配置
 */

export interface PublishConfig {
    protocolId: string
    bidId: string
    instanceCode: string
    defaultCategoryId?: string
    folderId?: string // 素材库文件夹ID
}

export interface PublishHistory {
    id: string
    productName: string
    publishTime: number
    status: 'success' | 'failed'
    errorMessage?: string
}

/**
 * Storage工具类
 */
export const storage = {
    /**
     * 获取发布配置
     * HARDCODED TEST CONFIG - 用于开发测试
     */
    async getConfig(): Promise<PublishConfig | null> {
        console.log('[Storage] Using hardcoded test config')
        return {
            protocolId: '907367',
            bidId: '15167',
            instanceCode: 'QHWC',
            // defaultCategoryId: '5124', // Removed to prevent wrong category
            folderId: '264861'
        }
    },

    /**
     * 保存发布配置
     */
    async saveConfig(config: PublishConfig): Promise<boolean> {
        try {
            await chrome.storage.local.set({
                protocolId: config.protocolId,
                bidId: config.bidId,
                instanceCode: config.instanceCode,
                defaultCategoryId: config.defaultCategoryId,
                folderId: config.folderId || '264861'
            })
            console.log('[Storage] Config saved successfully')
            return true
        } catch (error) {
            console.error('[Storage] Failed to save config:', error)
            return false
        }
    },

    /**
     * 获取发布历史
     */
    async getHistory(): Promise<PublishHistory[]> {
        try {
            const result = await chrome.storage.local.get('publishHistory')
            return result.publishHistory || []
        } catch (error) {
            console.error('[Storage] Failed to get history:', error)
            return []
        }
    },

    /**
     * 添加发布历史记录
     */
    async addHistory(record: Omit<PublishHistory, 'id'>): Promise<void> {
        try {
            const history = await this.getHistory()
            const newRecord: PublishHistory = {
                ...record,
                id: Date.now().toString()
            }

            // 只保留最近50条记录
            const updatedHistory = [newRecord, ...history].slice(0, 50)

            await chrome.storage.local.set({ publishHistory: updatedHistory })
            console.log('[Storage] History record added')
        } catch (error) {
            console.error('[Storage] Failed to add history:', error)
        }
    },

    /**
     * 清空发布历史
     */
    async clearHistory(): Promise<void> {
        try {
            await chrome.storage.local.set({ publishHistory: [] })
            console.log('[Storage] History cleared')
        } catch (error) {
            console.error('[Storage] Failed to clear history:', error)
        }
    }
}
