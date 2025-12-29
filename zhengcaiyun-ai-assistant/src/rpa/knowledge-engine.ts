import { Logger } from "../lib/logger"

/**
 * 知识引擎 (Knowledge Engine)
 * 实现 "AI 拓荒 + 数据沉淀 + RPA 闪速填写"
 */

export const KnowledgeEngine = {
    async getBackendUrl(): Promise<string> {
        return new Promise<string>(r =>
            chrome.storage.local.get(['apiUrl'], res => r(
                res.apiUrl || (window as any).PLASMO_PUBLIC_BACKEND_URL || 'http://localhost:3000'
            ))
        )
    },

    /**
     * 查询服务器沉淀的商品属性知识
     * @param categoryId 政采云类目ID
     * @param brand 品牌
     * @param model 型号
     */
    async queryProductKnowledge(categoryId: string, brand: string, model: string): Promise<Record<string, string> | null> {
        const baseUrl = await this.getBackendUrl()
        try {
            const url = `${baseUrl}/api/product-attribute-cache?categoryId=${categoryId}&brand=${encodeURIComponent(brand)}&model=${encodeURIComponent(model)}`

            // 使用 API_PROXY 绕过同源限制
            return new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'API_PROXY',
                    url: url,
                    method: 'GET'
                }, (response) => {
                    if (response?.ok && response.data?.found) {
                        Logger.log(`✨ [知识库] 命中服务器记录: ${brand} / ${model}`)
                        resolve(response.data.attributes)
                    } else {
                        resolve(null)
                    }
                })
            })
        } catch (e) {
            Logger.warn("[知识库] 查询异常:", e)
            return null
        }
    },

    /**
     * 沉淀学习到的知识到服务器
     * @param categoryId 类目ID
     * @param categoryPath 类目路径数组
     * @param brand 品牌
     * @param model 型号
     * @param attributes 属性键值对
     */
    async saveProductKnowledge(
        categoryId: string,
        categoryPath: string[],
        brand: string,
        model: string,
        attributes: Record<string, string>
    ): Promise<boolean> {
        const baseUrl = await this.getBackendUrl()
        try {
            const url = `${baseUrl}/api/product-attribute-cache`

            return new Promise((resolve) => {
                chrome.runtime.sendMessage({
                    type: 'API_PROXY',
                    url: url,
                    method: 'POST',
                    body: {
                        categoryId,
                        categoryPath: categoryPath.join('/'),
                        brand,
                        model,
                        attributes
                    }
                }, (response) => {
                    if (response?.ok) {
                        Logger.log(`✅ [知识库] 成功沉淀知识给服务器: ${brand} / ${model} (${Object.keys(attributes).length} 个属性)`)
                        resolve(true)
                    } else {
                        Logger.warn("[知识库] 知识沉淀失败:", response?.error)
                        resolve(false)
                    }
                })
            })
        } catch (e) {
            Logger.warn("[知识库] 保存异常:", e)
            return false
        }
    }
}
