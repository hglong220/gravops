/**
 * AI 类目匹配服务 - 任务2
 * 
 * 功能：
 * 1. 接收商品标题、属性、用户权限类目树
 * 2. 在权限树中查找最可能的类目路径
 * 3. 输出结构化JSON结果
 */

import type { UserCategoryTree } from './user-category-tree'
import { searchPaths, isPathAllowed } from './user-category-tree'

// ========== 类型定义 ==========

/** AI 匹配请求 */
export interface CategoryMatchRequest {
    title: string                           // 商品标题
    brand?: string                          // 品牌
    model?: string                          // 型号
    attributes?: Record<string, string>     // 其他属性
    userTree: UserCategoryTree              // 用户权限类目树
}

/** AI 匹配成功结果 */
export interface CategoryMatchSuccess {
    category_path: string[]                 // 类目路径 1-5级
    confidence: number                      // 置信度 0-1
}

/** AI 匹配失败结果 */
export interface CategoryMatchError {
    error: 'NO_PERMISSION' | 'NO_MATCH' | 'AMBIGUOUS'
    candidates?: string[][]                 // 候选路径（用于AMBIGUOUS情况）
}

/** AI 匹配结果 */
export type CategoryMatchResult = CategoryMatchSuccess | CategoryMatchError

// ========== 关键词提取 ==========

/** 从标题中提取关键词 */
function extractKeywords(title: string): string[] {
    // 移除常见无意义词
    const stopWords = ['的', '和', '与', '或', '个', '只', '件', '套', '台', '把', '支', '盒', '包', '箱']

    // 按空格、斜杠、括号等分割
    const segments = title.split(/[\s\/\\()（）【】\[\]]+/)

    const keywords: string[] = []
    for (const seg of segments) {
        const cleaned = seg.trim()
        if (cleaned.length >= 2 && !stopWords.includes(cleaned)) {
            keywords.push(cleaned)
        }
    }

    return keywords
}

/** 从品牌和型号中提取关键信息 */
function extractBrandModelKeywords(brand?: string, model?: string): string[] {
    const keywords: string[] = []
    if (brand && brand.trim()) {
        keywords.push(brand.trim())
    }
    if (model && model.trim()) {
        keywords.push(model.trim())
    }
    return keywords
}

// ========== 匹配算法 ==========

/** 计算路径与关键词的匹配分数 */
function calculateMatchScore(path: string[], keywords: string[]): number {
    let score = 0
    const pathText = path.join(' ').toLowerCase()

    for (const keyword of keywords) {
        const lowerKeyword = keyword.toLowerCase()

        // 完全包含关键词
        if (pathText.includes(lowerKeyword)) {
            score += 10
        }

        // 检查每个层级
        for (const level of path) {
            const lowerLevel = level.toLowerCase()

            // 层级名完全匹配关键词
            if (lowerLevel === lowerKeyword) {
                score += 20
            }
            // 层级名包含关键词
            else if (lowerLevel.includes(lowerKeyword)) {
                score += 8
            }
            // 关键词包含层级名
            else if (lowerKeyword.includes(lowerLevel) && lowerLevel.length >= 2) {
                score += 5
            }
        }
    }

    // 奖励更深的路径（更精确）
    score += path.length * 2

    return score
}

/** 
 * 在权限树中查找最匹配的类目路径
 * 这是核心匹配函数
 */
export function findBestCategoryPath(request: CategoryMatchRequest): CategoryMatchResult {
    const { title, brand, model, attributes, userTree } = request

    // 1. 提取关键词
    const titleKeywords = extractKeywords(title)
    const brandModelKeywords = extractBrandModelKeywords(brand, model)
    const allKeywords = [...titleKeywords, ...brandModelKeywords]

    // 2. 从属性中提取额外关键词
    if (attributes) {
        for (const [key, value] of Object.entries(attributes)) {
            if (value && typeof value === 'string' && value.length >= 2 && value.length <= 20) {
                allKeywords.push(value)
            }
        }
    }

    console.log(`[CategoryMatcher] 提取关键词: ${allKeywords.join(', ')}`)

    // 3. 使用关键词搜索候选路径
    const candidatePaths: string[][] = []
    const seenPaths = new Set<string>()

    for (const keyword of allKeywords) {
        const matched = searchPaths(userTree, keyword)
        for (const path of matched) {
            const pathKey = path.join('>')
            if (!seenPaths.has(pathKey)) {
                seenPaths.add(pathKey)
                candidatePaths.push(path)
            }
        }
    }

    console.log(`[CategoryMatcher] 候选路径数: ${candidatePaths.length}`)

    // 4. 如果没有候选路径，返回NO_PERMISSION
    if (candidatePaths.length === 0) {
        return { error: 'NO_PERMISSION' }
    }

    // 5. 对候选路径打分
    const scoredPaths = candidatePaths.map(path => ({
        path,
        score: calculateMatchScore(path, allKeywords)
    }))

    // 按分数降序排序
    scoredPaths.sort((a, b) => b.score - a.score)

    const topPath = scoredPaths[0]
    const secondPath = scoredPaths[1]

    console.log(`[CategoryMatcher] 最佳路径: ${topPath.path.join(' > ')} (分数: ${topPath.score})`)

    // 6. 计算置信度
    let confidence: number

    if (!secondPath) {
        // 只有一个候选，高置信度
        confidence = Math.min(topPath.score / 50, 0.95)
    } else {
        // 多个候选，根据分数差计算置信度
        const scoreDiff = topPath.score - secondPath.score
        if (scoreDiff >= 20) {
            confidence = 0.9
        } else if (scoreDiff >= 10) {
            confidence = 0.75
        } else if (scoreDiff >= 5) {
            confidence = 0.6
        } else {
            // 分数接近，可能有歧义
            confidence = 0.4
        }
    }

    // 7. 如果置信度过低且有多个相近候选，返回AMBIGUOUS
    if (confidence < 0.5 && scoredPaths.length > 1) {
        const topCandidates = scoredPaths
            .filter(p => p.score >= topPath.score - 5)
            .slice(0, 3)
            .map(p => p.path)

        return {
            error: 'AMBIGUOUS',
            candidates: topCandidates
        }
    }

    // 8. 返回最佳匹配
    return {
        category_path: topPath.path,
        confidence: Math.round(confidence * 100) / 100
    }
}

// ========== 验证函数 ==========

/**
 * 验证路径是否在用户权限内
 */
export function validatePathPermission(
    path: string[],
    userTree: UserCategoryTree
): boolean {
    return isPathAllowed(userTree, path)
}

// ========== 简化输出 ==========

/**
 * 返回纯JSON结果，不含任何文字解释
 * 用于直接传递给RPA执行
 */
export function matchCategoryToJSON(request: CategoryMatchRequest): string {
    const result = findBestCategoryPath(request)
    return JSON.stringify(result)
}
