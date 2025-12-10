/**
 * 真正的 AI 类目匹配 - 使用 DeepSeek/GPT 判断商品类目
 * 
 * ⭐ 关键：AI 必须从政采云完整类目树中选择，100%匹配官方名称
 */

import OpenAI from 'openai'
import fs from 'fs'
import path from 'path'

// DeepSeek 客户端（使用 OpenAI 兼容接口）
const deepseek = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: 'https://api.deepseek.com/v1'
})

// OpenAI 客户端
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
})

const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek'

interface CategoryNode {
    id: number
    name: string
    categoryCode?: string
    level: number
    parentId?: number | null
    children?: CategoryNode[]
}

interface CategoryMatchResult {
    path: string[]
    confidence: 'high' | 'medium' | 'low'
    reason: string
    bid?: string  // ⭐ 新增：标项名称
}

// ⭐ 新增：标项映射结构
interface BidMapping {
    meta: { description: string }
    mappings: {
        [bidName: string]: {
            level1Categories: string[]
        }
    }
}

// 缓存
let categoryTreeCache: CategoryNode[] | null = null
let bidMappingCache: BidMapping | null = null

/**
 * 加载政采云完整类目树
 */
function loadCategoryTree(): CategoryNode[] {
    if (categoryTreeCache) return categoryTreeCache

    const filePath = path.join(process.cwd(), 'public', 'api', '政采云完整类目.json')
    const data = fs.readFileSync(filePath, 'utf-8')
    const json = JSON.parse(data)
    categoryTreeCache = json.categories || json
    console.log('[AI Category] 类目树已加载')
    return categoryTreeCache!
}

/**
 * ⭐ 加载标项映射文件
 */
function loadBidMapping(): BidMapping {
    if (bidMappingCache) return bidMappingCache

    const filePath = path.join(process.cwd(), 'public', 'api', '标项映射.json')
    const data = fs.readFileSync(filePath, 'utf-8')
    bidMappingCache = JSON.parse(data)
    console.log('[AI Category] 标项映射已加载')
    return bidMappingCache!
}

/**
 * ⭐ 根据一级类目找到对应的标项
 */
export function findBidByLevel1Category(level1Name: string): string | null {
    const mapping = loadBidMapping()

    for (const [bidName, config] of Object.entries(mapping.mappings)) {
        if (config.level1Categories.some(cat =>
            cat.includes(level1Name) || level1Name.includes(cat) ||
            cat.split('/')[0] === level1Name.split('/')[0]
        )) {
            return bidName
        }
    }
    return null
}

/**
 * ⭐ 获取标项下的所有一级类目
 */
function getLevel1CategoriesByBid(bidName: string): string[] {
    const mapping = loadBidMapping()
    return mapping.mappings[bidName]?.level1Categories || []
}

/**
 * 把类目树转成文本列表，供AI选择
 * 格式：一级类目 > 二级类目 > 三级类目
 */
function buildCategoryPathList(tree: CategoryNode[], maxPaths = 500): string[] {
    const paths: string[] = []

    function traverse(node: CategoryNode, parentPath: string[] = []) {
        const currentPath = [...parentPath, node.name]

        // 如果没有子节点，或者已经是第3级，就加入列表
        if (!node.children || node.children.length === 0 || currentPath.length >= 3) {
            if (currentPath.length >= 2) {
                paths.push(currentPath.slice(0, 3).join(' > '))
            }
        }

        // 继续遍历子节点
        if (node.children && currentPath.length < 3) {
            for (const child of node.children) {
                if (paths.length >= maxPaths) break
                traverse(child, currentPath)
            }
        }
    }

    for (const root of tree) {
        if (paths.length >= maxPaths) break
        traverse(root)
    }

    return paths
}

/**
 * 根据商品关键词过滤相关类目
 */
function filterRelevantCategories(tree: CategoryNode[], keywords: string[]): string[] {
    const paths: string[] = []

    function traverse(node: CategoryNode, parentPath: string[] = []) {
        const currentPath = [...parentPath, node.name]
        const pathStr = currentPath.join('')

        // 检查路径是否包含任何关键词
        const isRelevant = keywords.some(kw =>
            pathStr.toLowerCase().includes(kw.toLowerCase()) ||
            kw.toLowerCase().includes(node.name.toLowerCase())
        )

        // 如果相关，加入列表
        if (isRelevant && currentPath.length >= 2 && currentPath.length <= 4) {
            paths.push(currentPath.slice(0, Math.min(currentPath.length, 4)).join(' > '))
        }

        // 继续遍历子节点
        if (node.children) {
            for (const child of node.children) {
                traverse(child, currentPath)
            }
        }
    }

    for (const root of tree) {
        traverse(root)
    }

    // 去重并限制数量
    return [...new Set(paths)].slice(0, 100)
}

/**
 * 从商品标题提取关键词
 */
function extractKeywords(title: string): string[] {
    // 常见产品关键词
    const productWords = [
        '白板', '黑板', '打印机', '复印机', '装订机', '碎纸机', '扫描仪',
        '投影仪', '电脑', '笔记本', '显示器', '键盘', '鼠标', '硬盘',
        '打印纸', '复印纸', 'A4', '文件夹', '档案盒', '订书机', '计算器',
        '笔', '笔记本', '桌子', '椅子', '柜子', '沙发', '书架',
        '空调', '冰箱', '洗衣机', '电视', '饮水机', '净水器',
        '教学', '培训', '会议', '办公', '书写', '绘图'
    ]

    const keywords: string[] = []
    const lowerTitle = title.toLowerCase()

    for (const word of productWords) {
        if (lowerTitle.includes(word.toLowerCase())) {
            keywords.push(word)
        }
    }

    // 如果没匹配到，用标题分词
    if (keywords.length === 0) {
        // 简单分词：提取中文词组
        const matches = title.match(/[\u4e00-\u9fa5]{2,4}/g) || []
        keywords.push(...matches.slice(0, 5))
    }

    return keywords
}

/**
 * ⭐ 使用 AI 从政采云类目树中选择最匹配的类目
 * 
 * 关键：只从用户有权限的一级类目及其子类目中选择
 * 
 * @param productTitle - 商品标题
 * @param allowedCategories - 用户有权限的一级类目列表（可选，已废弃，优先使用 bid）
 * @param bid - ⭐ 当前标项名称（如 "办公用品"），用于限制匹配范围
 */
export async function matchCategoryWithAI(
    productTitle: string,
    allowedCategories: string[] = [],
    bid?: string  // ⭐ 新增：当前标项
): Promise<CategoryMatchResult> {

    console.log('[AI Category] 开始AI类目匹配:', productTitle)
    console.log('[AI Category] 当前标项:', bid || '未指定')
    console.log('[AI Category] 用户权限类目:', allowedCategories)

    // 1. 加载类目树
    const fullTree = loadCategoryTree()

    // ⭐ 2. 根据标项过滤类目树
    let effectiveCategories = allowedCategories

    // ⭐⭐⭐ 关键：如果指定了 bid，只使用该标项下的一级类目
    if (bid) {
        const bidCategories = getLevel1CategoriesByBid(bid)
        if (bidCategories.length > 0) {
            effectiveCategories = bidCategories
            console.log(`[AI Category] ✅ 使用标项 "${bid}" 下的一级类目:`, bidCategories)
        } else {
            console.log(`[AI Category] ⚠️ 标项 "${bid}" 未在映射表中找到，使用用户权限类目`)
        }
    }

    // 过滤类目树（只保留指定的一级类目）
    let tree = fullTree
    if (effectiveCategories.length > 0) {
        tree = fullTree.filter(node => {
            // 检查一级类目名称是否在允许列表中
            const nodeName = node.name.toLowerCase()
            return effectiveCategories.some(cat => {
                const catName = cat.toLowerCase()
                // 模糊匹配：办公设备 匹配 办公设备/耗材
                return nodeName.includes(catName) || catName.includes(nodeName) ||
                    nodeName.split('/')[0] === catName.split('/')[0]
            })
        })
        console.log(`[AI Category] 过滤后类目树: ${tree.length} 个一级类目 (${tree.map(n => n.name).join(', ')})`)

        // 如果过滤后没有类目，报错
        if (tree.length === 0) {
            console.log('[AI Category] ⚠️ 没有匹配的类目')
            return {
                path: [],
                confidence: 'low',
                reason: bid
                    ? `标项 "${bid}" 下没有可用的类目，请检查标项映射配置`
                    : '用户没有匹配的类目权限，请检查标项设置',
                bid
            }
        }
    }

    // 3. 提取关键词
    const keywords = extractKeywords(productTitle)
    console.log('[AI Category] 提取关键词:', keywords)

    // 4. 过滤相关类目（从用户有权限的类目中过滤）
    let relevantPaths = filterRelevantCategories(tree, keywords)

    // 如果过滤后太少，补充一些常用类目
    if (relevantPaths.length < 20) {
        const defaultPaths = buildCategoryPathList(tree, 50)
        relevantPaths = [...new Set([...relevantPaths, ...defaultPaths])].slice(0, 100)
    }

    console.log('[AI Category] 候选类目数:', relevantPaths.length)

    // 4. 构建 Prompt
    const categoryList = relevantPaths.join('\n')

    const systemPrompt = `你是政采云电商平台的类目匹配专家。

⚠️ 极其重要：你只能从下面的【可选类目列表】中选择，不能自己编造类目名称！

【可选类目列表】
${categoryList}

你的任务：
1. 分析商品标题
2. 从上面的列表中选择最匹配的一个类目路径
3. 必须100%使用列表中的原始名称，一个字都不能改`

    const userPrompt = `商品标题：${productTitle}

请从可选类目列表中选择最匹配的类目路径。

返回格式（只返回JSON，不要其他文字）：
{
  "path": ["一级类目", "二级类目", "三级类目"],
  "confidence": "high/medium/low",
  "reason": "选择理由"
}

注意：path 中的每个类目名称必须与可选列表中的完全一致！`

    try {
        const client = AI_PROVIDER === 'deepseek' ? deepseek : openai
        const model = AI_PROVIDER === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'

        console.log(`[AI Category] 使用 ${AI_PROVIDER} (${model})`)

        const response = await client.chat.completions.create({
            model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt }
            ],
            temperature: 0.1,  // 低温度，确保输出稳定
            max_tokens: 300
        })

        const content = response.choices[0]?.message?.content || ''
        console.log('[AI Category] AI 返回:', content)

        // 解析JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            throw new Error('无法解析AI返回的JSON')
        }

        const result: CategoryMatchResult = JSON.parse(jsonMatch[0])

        // 验证结果是否在候选列表中
        const resultPath = result.path.join(' > ')
        const isValid = relevantPaths.some(p => p.includes(resultPath) || resultPath.includes(p))

        if (!isValid) {
            console.log('[AI Category] ⚠️ AI返回的类目不在候选列表中，尝试模糊匹配...')
            // 尝试找到最相似的
            const similar = relevantPaths.find(p =>
                result.path.some(part => p.includes(part))
            )
            if (similar) {
                result.path = similar.split(' > ')
                result.confidence = 'medium'
            }
        }

        // ⭐ 设置标项
        // 如果调用时指定了 bid，直接使用；否则根据一级类目反查
        if (bid) {
            result.bid = bid
            console.log(`[AI Category] 使用调用指定的标项: ${bid}`)
        } else if (result.path.length > 0) {
            const foundBid = findBidByLevel1Category(result.path[0])
            if (foundBid) {
                result.bid = foundBid
                console.log(`[AI Category] 根据一级类目确定标项: ${foundBid}`)
            } else {
                console.log(`[AI Category] ⚠️ 未找到一级类目 "${result.path[0]}" 对应的标项`)
            }
        }

        console.log('[AI Category] 最终结果:', result.path.join(' > '), result.bid ? `(标项: ${result.bid})` : '')
        return result

    } catch (error) {
        console.error('[AI Category] AI匹配失败:', error)

        // 失败时尝试用关键词匹配
        if (relevantPaths.length > 0) {
            const fallbackPath = relevantPaths[0].split(' > ')
            return {
                path: fallbackPath,
                confidence: 'low',
                reason: 'AI匹配失败，使用关键词匹配结果'
            }
        }

        return {
            path: ['文化用品', '其他文化用品', '其他'],
            confidence: 'low',
            reason: 'AI匹配失败，使用默认类目'
        }
    }
}
