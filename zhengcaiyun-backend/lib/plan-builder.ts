import {
    AIPlanRequest,
    AIPlanResponse,
    AICommand
} from "./zcy-ai-plan"
import { guessBid, guessCategoryPath, guessFirstLevelCategory } from "./category-matcher"

export function buildPlan(req: AIPlanRequest): AIPlanResponse {
    // 1. 选电子卖场（现在简单用第一个，后面可以按省份/采购目录自己扩展）
    // ⭐ 确保有默认值
    const market = (req.permissions.markets && req.permissions.markets.length > 0)
        ? req.permissions.markets[0]
        : "网上超市"

    // 2. 选标项：在权限允许的列表里面猜一个
    const bid = guessBid(req.product.title, req.permissions.bids)

    // 3. 从完整类目树中找到一个三级类目路径
    const categoryPath = guessCategoryPath(req, bid)

    // 4. 获取一级大类目（如：办公设备/耗材）
    const firstLevelCategory = guessFirstLevelCategory(bid)

    // 5. 按前端 RPA 的执行顺序拼指令
    const commands: AICommand[] = [
        { type: "OPEN_DIALOG" },
        { type: "WAIT", waitMs: 2000 },

        { type: "EXPAND_MARKET", value: market },
        { type: "WAIT", waitMs: 2000 },

        { type: "SELECT_BID", value: bid },
        { type: "CONFIRM_DIALOG" },
        { type: "WAIT", waitMs: 3000 },

        // 类目选择 - 必须三级逐级点开
        // 一级大类目（政采云的顶级分类，如 "办公设备/耗材"）
        { type: "SELECT_CATEGORY", value: firstLevelCategory },
        { type: "WAIT", waitMs: 1000 },

        // 二级类目（如 "办公用纸"）
        { type: "SELECT_CATEGORY", value: categoryPath[1] },
        { type: "WAIT", waitMs: 1000 },

        // 三级类目（如 "打印/复印纸"）
        { type: "SELECT_CATEGORY", value: categoryPath[2] },
        { type: "WAIT", waitMs: 1000 },

        // 暂时不做品牌 / 型号，后面需要再加
        { type: "CLICK_NEXT" }
    ]

    // 保证没有 undefined
    for (const c of commands) {
        if (
            (c.type === "EXPAND_MARKET" ||
                c.type === "SELECT_BID" ||
                c.type === "SELECT_CATEGORY") &&
            !c.value
        ) {
            throw new Error(`指令 ${c.type} 缺少 value`)
        }
    }

    return {
        market,
        bid,
        categoryPath,
        commands
    }
}
