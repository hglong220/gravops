import {
    AIPlanRequest,
    CategoryNode
} from "./zcy-ai-plan"

// 简单关键词表，可以后面慢慢补充
const BID_KEYWORDS: Record<string, string[]> = {
    "办公设备": ["打印机", "复印机", "电脑", "主机", "服务器", "交换机", "路由器", "显示器", "碎纸机", "投影"],
    "办公用品": ["笔", "笔记本", "文件夹", "档案盒", "订书机", "计算器"],
    "办公用纸": ["打印纸", "复印纸", "A4纸", "A3纸", "铜版纸", "70g", "80g"]
}

// 标项 → 一级大类目映射（政采云的顶级分类）
const BID_TO_FIRST_LEVEL: Record<string, string> = {
    "办公设备": "办公设备/耗材",
    "办公用品": "办公设备/耗材",
    "办公耗材": "办公设备/耗材",
    "打印机及配件": "办公设备/耗材",
    "办公家具": "办公家具",
    "日用百货": "日用百货",
    "五金工具": "五金工具",
    "计算机设备": "计算机设备及软件"
}

// 根据标项获取一级大类目
export function guessFirstLevelCategory(bid: string): string {
    return BID_TO_FIRST_LEVEL[bid] || "办公设备/耗材"
}

// 在权限允许的 bid 中，根据标题关键字猜一个最合适的
export function guessBid(productTitle: string, permissionsBids: string[]): string {
    const title = productTitle || ""

    for (const bid of permissionsBids) {
        const keywords = BID_KEYWORDS[bid] || []
        if (keywords.some(k => title.includes(k))) {
            return bid
        }
    }

    // 没匹配到就用第一个权限里的标项
    return permissionsBids[0] || "办公设备"
}

// 深度遍历类目树，找到所有 [L1,L2,L3] 完整路径
function collectAllPaths(
    tree: CategoryNode[],
    currentPath: CategoryNode[] = [],
    result: CategoryNode[][] = []
): CategoryNode[][] {
    for (const node of tree) {
        const newPath = [...currentPath, node]
        if (!node.children || node.children.length === 0) {
            if (newPath.length >= 3) {
                result.push(newPath.slice(0, 3)) // 只要前3级
            }
        } else {
            collectAllPaths(node.children, newPath, result)
        }
    }
    return result
}

// 根据标题 + 选中的 bid，从所有路径里挑一个最合适的
export function guessCategoryPath(
    req: AIPlanRequest,
    chosenBid: string
): [string, string, string] {
    const allPaths = collectAllPaths(req.categoryTree)
    const title = req.product.title || ""

    // 先过滤：一级类目名字需要跟标项相关
    const candidate = allPaths.filter(path =>
        path[0].name.includes("办公") || path[0].name.includes(chosenBid.replace("标项", ""))
    )

    // 在候选里找包含关键词的路径
    const keywords = [
        "打印纸",
        "复印纸",
        "A4",
        "A3",
        "复印机",
        "打印/复印纸",
        "办公用纸"
    ]

    let best: CategoryNode[] | null = null

    for (const path of candidate) {
        const fullName = path.map(p => p.name).join("/")
        if (keywords.some(k => title.includes(k) || fullName.includes(k))) {
            best = path
            break
        }
    }

    // 兜底：都没匹配到，就用第一个候选或整棵树的第一个路径
    const finalPath = (best || candidate[0] || allPaths[0])

    if (!finalPath || finalPath.length < 3) {
        throw new Error("无法从类目树中找到任何三级类目路径")
    }

    return [
        finalPath[0].name,
        finalPath[1].name,
        finalPath[2].name
    ]
}
