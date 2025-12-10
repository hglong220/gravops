// AI 指令类型枚举
export type AICommandType =
    | "OPEN_DIALOG"
    | "WAIT"
    | "EXPAND_MARKET"
    | "SELECT_BID"
    | "CONFIRM_DIALOG"
    | "SELECT_CATEGORY_LEVEL1"
    | "SELECT_CATEGORY_LEVEL2"
    | "SELECT_CATEGORY_LEVEL3"
    | "INPUT_BRAND"
    | "SELECT_BRAND"
    | "INPUT_MODEL"
    | "SELECT_MODEL"
    | "CLICK_NEXT"

// 单条指令
export interface AICommand {
    type: AICommandType
    value?: string
    waitMs?: number
}

// 商品信息（网站传给 AI 的基础数据）
export interface ProductInfo {
    title: string            // 商品标题
    brand?: string           // 品牌（可选）
    model?: string           // 型号（可选）
    attributes?: Record<string, string> // 规格参数（可选）
}

// 权限信息：账号当前可用的标项/类目（服务器算好）
export interface PermissionInfo {
    markets: string[]           // 电子卖场名称列表，例如 ["网上超市(青海网超)"]
    bids: string[]              // 标项名称，例如 ["办公设备", "办公用品"]
}

// AI 输入（发给 AI 的整体结构）
export interface AIPlanRequest {
    product: ProductInfo
    permissions: PermissionInfo
    // 完整政采云类目树 JSON（不能改内容，仅作为参考）
    zcyCategoryTree: any
}

// AI 输出（AI 返回给插件的统一结构）
export interface AIPlanResponse {
    market: string             // 电子卖场：比如 "网上超市(青海网超)"
    bid: string                // 标项：比如 "办公设备"
    categoryPath: [string, string, string] // 类目路径：["办公设备","办公用纸","打印/复印纸"]
    brand: string              // 品牌：得力
    model: string              // 型号：g500 / 7361 等
    commands: AICommand[]      // 供 RPA 执行的完整指令列表
}
