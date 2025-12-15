// 单条指令类型
export type AICommandType =
    | "OPEN_DIALOG"
    | "WAIT"
    | "EXPAND_MARKET"
    | "SELECT_BID"
    | "CONFIRM_DIALOG"
    | "SELECT_CATEGORY"
    | "SELECT_CATEGORY_LEVEL1"
    | "SELECT_CATEGORY_LEVEL2"
    | "SELECT_CATEGORY_LEVEL3"
    | "CLICK_NEXT"

export interface AICommand {
    type: AICommandType
    value?: string
    waitMs?: number
}

// 商品信息
export interface ProductInfo {
    title: string
    brand?: string
    model?: string
    attributes?: Record<string, string>
}

// 权限信息：由你的网站/数据库提供
export interface PermissionInfo {
    markets: string[]  // 电子卖场，如 ["网上超市(青海网超)"]
    bids: string[]     // 标项名称，如 ["办公设备", "办公用品"]
}

// 类目树节点（基于你上传的政采云完整类目文件）
export interface CategoryNode {
    id: string
    name: string
    children?: CategoryNode[]
}

// 请求体：前端 / 你的网站 发到这个服务
export interface AIPlanRequest {
    product: ProductInfo
    permissions: PermissionInfo
    categoryTree: CategoryNode[]   // 完整政采云类目树，不能改内容
}

// 响应体：返回给插件的结果
export interface AIPlanResponse {
    market: string                 // 使用哪个电子卖场
    bid: string                    // 标项（如：办公设备）
    categoryPath: [string, string, string] // 三级类目路径
    commands: AICommand[]          // 让 RPA 执行的完整指令
}
