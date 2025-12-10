/**
 * 用户权限类目树 - 任务1
 * 
 * 功能：
 * 1. 解析用户已开通的类目权限文件
 * 2. 转换为树状结构，支持快速查询
 * 3. 提供路径匹配能力
 */

// ========== 类型定义 ==========

/** 类目节点 */
export interface CategoryNode {
    name: string           // 类目名称
    level: number          // 层级 1-5
    children: Map<string, CategoryNode>  // 子类目
    fullPath: string[]     // 完整路径
}

/** 权限类目树 */
export interface UserCategoryTree {
    roots: Map<string, CategoryNode>  // 一级类目
    allPaths: string[][]              // 所有合法路径（叶子节点的完整路径）
    totalCount: number                // 总类目数
}

/** 权限文件中的类目条目 */
export interface CategoryEntry {
    level1?: string
    level2?: string
    level3?: string
    level4?: string
    level5?: string
}

/** 政采云类目节点（包含ID和代码） */
export interface ZcyCategoryNode {
    id: number
    categoryCode: string
    name: string
    level: number
    parentId: number | null
    hasChildren: boolean
    hasSpu: boolean
    children: ZcyCategoryNode[]
}

/** 政采云完整类目文件格式 */
export interface ZcyFullCategoryFile {
    meta: {
        name: string
        description: string
        totalCategories: number
        level1Count: number
        level2Count: number
        level3Count: number
        level4Count: number
        level5Count: number
    }
    categories: ZcyCategoryNode[]
}

// ========== 解析函数 ==========

/**
 * 从权限文件解析类目树
 * @param entries 类目条目数组，每条包含1-5级类目
 * @returns 可查询的类目树结构
 */
export function parseUserCategoryTree(entries: CategoryEntry[]): UserCategoryTree {
    const roots = new Map<string, CategoryNode>()
    const allPaths: string[][] = []
    let totalCount = 0

    for (const entry of entries) {
        const path = buildPath(entry)
        if (path.length === 0) continue

        // 插入到树中
        insertPath(roots, path)

        // 收集叶子路径
        allPaths.push(path)
        totalCount++
    }

    console.log(`[UserCategoryTree] 解析完成: ${totalCount} 条路径, ${roots.size} 个一级类目`)

    return { roots, allPaths, totalCount }
}

/** 从条目构建路径数组 */
function buildPath(entry: CategoryEntry): string[] {
    const path: string[] = []
    if (entry.level1?.trim()) path.push(entry.level1.trim())
    if (entry.level2?.trim()) path.push(entry.level2.trim())
    if (entry.level3?.trim()) path.push(entry.level3.trim())
    if (entry.level4?.trim()) path.push(entry.level4.trim())
    if (entry.level5?.trim()) path.push(entry.level5.trim())
    return path
}

/** 将路径插入树结构 */
function insertPath(roots: Map<string, CategoryNode>, path: string[]): void {
    if (path.length === 0) return

    let currentLevel = roots
    const fullPath: string[] = []

    for (let i = 0; i < path.length; i++) {
        const name = path[i]
        fullPath.push(name)

        if (!currentLevel.has(name)) {
            currentLevel.set(name, {
                name,
                level: i + 1,
                children: new Map(),
                fullPath: [...fullPath]
            })
        }

        const node = currentLevel.get(name)!
        currentLevel = node.children
    }
}

// ========== 查询函数 ==========

/**
 * 检查路径是否在权限树中存在
 * @param tree 权限树
 * @param path 要检查的路径
 * @returns 是否存在（精确匹配或前缀匹配）
 */
export function isPathAllowed(tree: UserCategoryTree, path: string[]): boolean {
    if (path.length === 0) return false

    let currentLevel = tree.roots

    for (const name of path) {
        const node = currentLevel.get(name)
        if (!node) return false
        currentLevel = node.children
    }

    return true
}

/**
 * 获取某一级下的所有子类目名称
 * @param tree 权限树
 * @param parentPath 父级路径，空数组表示获取一级类目
 * @returns 子类目名称列表
 */
export function getChildCategories(tree: UserCategoryTree, parentPath: string[]): string[] {
    if (parentPath.length === 0) {
        return Array.from(tree.roots.keys())
    }

    let currentLevel = tree.roots
    for (const name of parentPath) {
        const node = currentLevel.get(name)
        if (!node) return []
        currentLevel = node.children
    }

    return Array.from(currentLevel.keys())
}

/**
 * 查找包含关键词的所有合法路径
 * @param tree 权限树
 * @param keyword 关键词
 * @returns 匹配的路径数组
 */
export function searchPaths(tree: UserCategoryTree, keyword: string): string[][] {
    const lowerKeyword = keyword.toLowerCase()
    return tree.allPaths.filter(path =>
        path.some(name => name.toLowerCase().includes(lowerKeyword))
    )
}

/**
 * 获取指定节点
 * @param tree 权限树
 * @param path 路径
 * @returns 节点或null
 */
export function getNode(tree: UserCategoryTree, path: string[]): CategoryNode | null {
    if (path.length === 0) return null

    let currentLevel = tree.roots
    let node: CategoryNode | undefined

    for (const name of path) {
        node = currentLevel.get(name)
        if (!node) return null
        currentLevel = node.children
    }

    return node || null
}

/**
 * 将树结构序列化为JSON（用于存储）
 */
export function serializeTree(tree: UserCategoryTree): string {
    return JSON.stringify({
        allPaths: tree.allPaths,
        totalCount: tree.totalCount
    })
}

/**
 * 从JSON恢复树结构
 */
export function deserializeTree(json: string): UserCategoryTree {
    const data = JSON.parse(json)
    const entries: CategoryEntry[] = data.allPaths.map((path: string[]) => ({
        level1: path[0],
        level2: path[1],
        level3: path[2],
        level4: path[3],
        level5: path[4]
    }))
    return parseUserCategoryTree(entries)
}

// ========== 从多种格式解析 ==========

/**
 * 从政采云完整类目.json解析（官方嵌套格式）
 * 这是最常用的解析方法
 */
export function parseFromZcyFullCategory(data: ZcyFullCategoryFile): UserCategoryTree {
    const entries: CategoryEntry[] = []

    function traverse(node: ZcyCategoryNode, path: string[]) {
        const currentPath = [...path, node.name]

        if (!node.children || node.children.length === 0) {
            // 叶子节点 - 添加完整路径
            entries.push({
                level1: currentPath[0],
                level2: currentPath[1],
                level3: currentPath[2],
                level4: currentPath[3],
                level5: currentPath[4]
            })
        } else {
            // 继续遍历子节点
            for (const child of node.children) {
                traverse(child, currentPath)
            }
        }
    }

    for (const root of data.categories) {
        traverse(root, [])
    }

    console.log(`[UserCategoryTree] 从政采云类目文件解析: ${entries.length} 条路径`)
    return parseUserCategoryTree(entries)
}

/**
 * 从CSV文本解析（假设列顺序：一级,二级,三级,四级,五级）
 */
export function parseFromCSV(csvText: string): UserCategoryTree {
    const lines = csvText.split('\n').filter(line => line.trim())
    const entries: CategoryEntry[] = []

    for (let i = 1; i < lines.length; i++) { // 跳过标题行
        const cols = lines[i].split(',')
        entries.push({
            level1: cols[0]?.trim(),
            level2: cols[1]?.trim(),
            level3: cols[2]?.trim(),
            level4: cols[3]?.trim(),
            level5: cols[4]?.trim()
        })
    }

    return parseUserCategoryTree(entries)
}

/**
 * 从JSON数组解析（支持多种格式）
 */
export function parseFromJSON(jsonData: any[]): UserCategoryTree {
    const entries: CategoryEntry[] = jsonData.map(item => {
        // 格式1: { level1, level2, level3, level4, level5 }
        if ('level1' in item) {
            return item as CategoryEntry
        }
        // 格式2: { path: ["一级", "二级", ...] }
        if (Array.isArray(item.path)) {
            return {
                level1: item.path[0],
                level2: item.path[1],
                level3: item.path[2],
                level4: item.path[3],
                level5: item.path[4]
            }
        }
        // 格式3: ["一级", "二级", ...]
        if (Array.isArray(item)) {
            return {
                level1: item[0],
                level2: item[1],
                level3: item[2],
                level4: item[3],
                level5: item[4]
            }
        }
        return {}
    })

    return parseUserCategoryTree(entries)
}

/**
 * 从嵌套树结构解析（通用格式）
 */
export function parseFromNestedTree(rootNodes: any[]): UserCategoryTree {
    const entries: CategoryEntry[] = []

    function traverse(node: any, path: string[]) {
        const currentPath = [...path, node.name || node.label || node.title]

        if (!node.children || node.children.length === 0) {
            // 叶子节点
            entries.push({
                level1: currentPath[0],
                level2: currentPath[1],
                level3: currentPath[2],
                level4: currentPath[3],
                level5: currentPath[4]
            })
        } else {
            // 继续遍历子节点
            for (const child of node.children) {
                traverse(child, currentPath)
            }
        }
    }

    for (const root of rootNodes) {
        traverse(root, [])
    }

    return parseUserCategoryTree(entries)
}

// ========== 调试输出 ==========

/**
 * 打印树结构（调试用）
 */
export function printTree(tree: UserCategoryTree): void {
    console.log('========== 用户权限类目树 ==========')
    console.log(`总路径数: ${tree.totalCount}`)
    console.log(`一级类目: ${Array.from(tree.roots.keys()).join(', ')}`)
    console.log('')

    function printNode(node: CategoryNode, indent: string) {
        console.log(`${indent}${node.name}`)
        for (const child of node.children.values()) {
            printNode(child, indent + '  ')
        }
    }

    for (const root of tree.roots.values()) {
        printNode(root, '')
    }
}
