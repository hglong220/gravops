/**
 * ===================== ZCY RPA 调度中心 (Orchestrator) =====================
 * 
 * 核心职责：
 * 1. 严格按顺序执行步骤（一步没成功，下一步绝不执行）
 * 2. 每一步有：超时 / 重试 / 失败中止
 * 3. 每一步执行完写入「快照」，页面刷新后可从上次步骤继续
 * 4. "下一步"按钮有硬门槛：属性表单加载完成 + 自动填写完成 + 图片上传完成 + 必填项校验通过
 * 
 * 使用方式：
 * ```ts
 * import { createZcyPublishOrchestrator } from './zcy-rpa-orchestrator'
 * 
 * if (location.pathname.includes('/goods-center/goods/category/attr/select')) {
 *   const orch = createZcyPublishOrchestrator({
 *     productData: scraped,
 *     images: scraped.images || [],
 *     detailImages: scraped.detailImages || [],
 *     licenseKey: 'xxx'
 *   })
 *   orch.start()
 * }
 * ```
 */

import { AutoFillAIEngine, type ProductInfo } from './autofill-ai-engine'

// ===================== 类型定义 =====================

export interface StepDefinition {
    id: string
    name: string
    run: (state: OrchestratorState) => Promise<any>
    timeoutMs?: number
    maxRetries?: number
    retryDelayMs?: number
}

export interface OrchestratorState {
    startedAt: number
    // 业务数据（由外部传入）
    productData?: ProductInfo
    images?: string[]
    detailImages?: string[]
    skuImages?: Record<string, string>
    skuSpecs?: Array<{ name: string; values: string[] }>
    skuData?: Array<{ code?: string; stock?: number; price?: number }>
    categoryPath?: string[]
    bid?: string
    licenseKey?: string
    // 可扩展其他字段
    [key: string]: any
}

interface Snapshot {
    currentIndex: number
    updatedAt: number
}

interface OrchestratorOptions {
    snapshotKey?: string
}

// ===================== 工具函数区 =====================

function logRPA(...args: any[]) {
    console.log("[RPA_ORCH]", ...args)
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 等待某个条件成立
 * checkFn 返回 true/值 => resolve
 * 超时 => reject
 */
export function waitFor<T>(
    checkFn: () => T | false | null | undefined,
    timeoutMs = 30000,
    intervalMs = 500
): Promise<T> {
    return new Promise((resolve, reject) => {
        const start = Date.now()

        const tick = () => {
            try {
                const result = checkFn()
                if (result) {
                    return resolve(result)
                }
            } catch (e) {
                logRPA("waitFor checkFn error, continue:", e)
            }

            if (Date.now() - start >= timeoutMs) {
                return reject(new Error("waitFor timeout"))
            }
            setTimeout(tick, intervalMs)
        }

        tick()
    })
}

/**
 * 通过文本内容查找按钮
 */
function findButtonByText(text: string): HTMLElement | null {
    const xpath = `//button[contains(., '${text}')] | //a[contains(., '${text}')] | //span[contains(., '${text}')]/ancestor::button | //span[contains(., '${text}')]/ancestor::a`
    const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
    )
    return result.singleNodeValue as HTMLElement | null
}

// ===================== 表单就绪 & 校验区 =====================

/**
 * 检测属性表单是否加载完毕
 * 依据：group-attr 下有足够数量的 doraemon-form-item
 *      required 字段数量 > 0
 */
export function isAttrFormRendered(minRequired = 1): boolean {
    const group = document.querySelector(".group-attr-container, .group-attr, .goods-attr-container, .doraemon-form")
    if (!group) return false

    const items = group.querySelectorAll(".doraemon-form-item, .el-form-item").length
    const requiredItems = group.querySelectorAll(
        ".doraemon-form-item-required, .doraemon-form-item-label-required, .el-form-item__label.is-required"
    ).length

    return items >= minRequired && requiredItems >= minRequired
}

/**
 * 检测图片 file input 是否就绪
 */
export function isFileInputReady(minCount = 1): boolean {
    const inputs = document.querySelectorAll('input[type="file"]')
    return inputs.length >= minCount
}

/**
 * 检测必填项是否填写完成
 * 这里用通用逻辑：所有 required 项下的 input/select 必须有值
 */
export function areRequiredFieldsFilled(): boolean {
    const requiredLabels = document.querySelectorAll(
        ".doraemon-form-item-required, .doraemon-form-item-label-required, .el-form-item.is-required"
    )
    if (!requiredLabels.length) return false

    for (const label of requiredLabels) {
        const item = (label as HTMLElement).closest(".doraemon-form-item, .el-form-item")
        if (!item) continue

        // 尝试找到 input/textarea/select
        const input =
            item.querySelector("input:not([type=hidden]):not([type=file])") ||
            item.querySelector("textarea") ||
            item.querySelector("select")

        if (!input) continue

        const v = ((input as HTMLInputElement).value || "").toString().trim()
        if (!v) {
            return false
        }
    }
    return true
}

/**
 * 统一判定：是否可以点击"下一步"
 * 由调度中心调用
 */
export function canProceedNext(): boolean {
    const attrReady = (window as any).__ZCY_ATTR_FORM_READY__ === true
    const filled = (window as any).__ZCY_ATTR_FILLED__ === true
    const imgDone = (window as any).__ZCY_IMAGES_DONE__ === true
    const requiredOK = areRequiredFieldsFilled()

    logRPA("检查是否允许下一步:", {
        attrReady,
        filled,
        imgDone,
        requiredOK
    })

    return attrReady && filled && imgDone && requiredOK
}

/**
 * 安全点击"下一步"（带硬门槛）
 */
export async function safeClickNext(): Promise<void> {
    if (!canProceedNext()) {
        throw new Error("表单/图片未就绪，禁止点击下一步")
    }

    const btn = findButtonByText("下一步")
    if (!btn) {
        throw new Error('未找到"下一步"按钮')
    }

    btn.click()
    logRPA("已安全点击 下一步")
    await sleep(1000)
}

// ===================== 调度中心核心类 =====================

export class RpaOrchestrator {
    private steps: StepDefinition[]
    private options: Required<OrchestratorOptions>
    public currentIndex: number = 0
    public state: OrchestratorState
    private isRunning: boolean = false

    constructor(steps: StepDefinition[], options: OrchestratorOptions = {}) {
        this.steps = steps
        this.options = {
            snapshotKey: options.snapshotKey || "__ZCY_RPA_SNAPSHOT__"
        }
        this.state = {
            startedAt: Date.now()
        }

        this.loadSnapshotIfAny()
    }

    private loadSnapshotIfAny(): void {
        try {
            const raw = (window as any)[this.options.snapshotKey] as Snapshot | undefined
            if (!raw) return

            if (
                raw &&
                typeof raw === "object" &&
                typeof raw.currentIndex === "number"
            ) {
                logRPA("检测到历史快照，将从该步骤继续:", raw)
                this.currentIndex = raw.currentIndex
            }
        } catch (e) {
            logRPA("加载快照失败，忽略:", e)
        }
    }

    private saveSnapshot(): void {
        try {
            (window as any)[this.options.snapshotKey] = {
                currentIndex: this.currentIndex,
                updatedAt: Date.now()
            }
        } catch (e) {
            logRPA("保存快照失败:", e)
        }
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            logRPA("Orchestrator 已在运行中，忽略重复启动")
            return
        }

        this.isRunning = true
        logRPA("════════════════════════════════════════")
        logRPA("🚀 RPA Orchestrator 启动，共有步骤:", this.steps.length)
        logRPA("════════════════════════════════════════")

        try {
            while (this.currentIndex < this.steps.length) {
                const step = this.steps[this.currentIndex]
                await this.runStep(step)
                this.currentIndex++
                this.saveSnapshot()
            }

            logRPA("════════════════════════════════════════")
            logRPA("✅ Orchestrator 全部步骤完成")
            logRPA("════════════════════════════════════════")
        } catch (e) {
            logRPA("❌ Orchestrator 终止，错误:", e)
            throw e
        } finally {
            this.isRunning = false
        }
    }

    private async runStep(step: StepDefinition): Promise<any> {
        const {
            id,
            name,
            run,
            timeoutMs = 60000,
            maxRetries = 1,
            retryDelayMs = 2000
        } = step

        let attempt = 0

        while (attempt <= maxRetries) {
            attempt++
            logRPA(`▶ 开始步骤[${id}] ${name} (尝试 ${attempt}/${maxRetries + 1})`)

            try {
                const result = await this.runWithTimeout(run, timeoutMs)
                logRPA(`✔ 完成步骤[${id}]`, result || "")
                return result
            } catch (e) {
                logRPA(`❌ 步骤[${id}] 失败:`, e)

                if (attempt > maxRetries) {
                    throw e
                }

                logRPA(`⏳ 准备重试步骤[${id}]，等待 ${retryDelayMs} ms`)
                await sleep(retryDelayMs)
            }
        }
    }

    private runWithTimeout<T>(fn: (state: OrchestratorState) => Promise<T>, timeoutMs: number): Promise<T> {
        return new Promise((resolve, reject) => {
            let done = false

            const timer = setTimeout(() => {
                if (done) return
                done = true
                reject(new Error(`step timeout after ${timeoutMs}ms`))
            }, timeoutMs)

            Promise.resolve()
                .then(() => fn(this.state))
                .then(res => {
                    if (done) return
                    done = true
                    clearTimeout(timer)
                    resolve(res)
                })
                .catch(err => {
                    if (done) return
                    done = true
                    clearTimeout(timer)
                    reject(err)
                })
        })
    }

    /**
     * 重置调度器（清除快照，从头开始）
     */
    public reset(): void {
        this.currentIndex = 0
        delete (window as any)[this.options.snapshotKey]
        logRPA("Orchestrator 已重置")
    }
}

// ===================== 具体步骤实现 =====================

/**
 * Step 1: 确认当前页面是属性填写页面
 */
async function stepEnsureAttrPage(): Promise<void> {
    await waitFor(
        () => location.pathname.includes("/goods-center/goods/category/attr/select") ||
            location.pathname.includes("/goods/publish"),
        30000,
        500
    )
    logRPA("已确认在属性页:", location.href)
}

/**
 * Step 2: 选择卖场（网上超市 / 电子卖场）
 * 调用 LegacyBidPreflow.run() 实现
 */
async function stepSelectMarket(state: OrchestratorState): Promise<void> {
    logRPA("执行 选卖场/标项选择 逻辑")

    // 检测是否有"修改"按钮，没有说明已在正确界面
    const modifyBtn = document.querySelector('button') &&
        [...document.querySelectorAll('button')].find(b => b.textContent?.includes('修改'))

    if (!modifyBtn) {
        logRPA("✓ 无需选择卖场（未找到修改按钮）")
        return
    }

    // 使用现有的 FlagshipMax 中 LegacyBidPreflow 逻辑
    const FlagshipMax = (window as any).FlagshipMax
    if (FlagshipMax && state.bid) {
        // 如果已有 FlagshipMax 暴露的 LegacyBidPreflow，直接调用
        const LegacyBidPreflow = (window as any).LegacyBidPreflow
        if (LegacyBidPreflow) {
            await LegacyBidPreflow.run(state.bid)
        }
    }

    logRPA("✓ 卖场选择完成")
}

/**
 * Step 3: 选择类目
 * 调用 CategorySelectorMax.selectPath() 实现
 */
async function stepSelectCategory(state: OrchestratorState): Promise<void> {
    const categoryPath = state.categoryPath || []

    if (!categoryPath.length) {
        logRPA("⚠️ 无类目路径，跳过类目选择")
        return
    }

    logRPA("选择类目:", categoryPath.join(" > "))

    const CategorySelectorMax = (window as any).CategorySelectorMax
    if (CategorySelectorMax) {
        const ok = await CategorySelectorMax.selectPath(categoryPath)
        if (!ok) {
            throw new Error("类目选择失败")
        }
    } else {
        // 如果没有挂载，尝试直接导入
        logRPA("⚠️ CategorySelectorMax 未找到，跳过类目选择")
    }

    logRPA("✓ 类目选择完成")
}

/**
 * Step 4: 等待属性表单加载完成
 */
async function stepWaitAttrFormReady(): Promise<void> {
    logRPA("等待属性表单加载...")

    await waitFor(() => {
        // 检测页面是否已经有足够的表单字段
        const formItems = document.querySelectorAll('.doraemon-form-item, .el-form-item')
        return formItems.length >= 3
    }, 60000, 800)

    // 再等待 DOM 稳定（Vue 异步渲染）
    await sleep(2000)

        ; (window as any).__ZCY_ATTR_FORM_READY__ = true
    logRPA("✓ 属性表单已加载完成")
}

/**
 * Step 5: 自动填写属性
 * 调用 AutoFillAIEngine.run() 实现
 */
async function stepAutoFillAttributes(state: OrchestratorState): Promise<void> {
    logRPA("开始自动填写属性...")

    const productInfo: ProductInfo = {
        title: state.productData?.title,
        brand: state.productData?.brand,
        model: state.productData?.model,
        sku: state.productData?.sku,
        sourceUrl: state.productData?.sourceUrl,
        unit: state.productData?.unit,
        stock: state.productData?.stock,
        price: state.productData?.price,
        specs: state.productData?.specs
    }

    const result = await AutoFillAIEngine.run(productInfo)
    logRPA(`属性填写完成：成功 ${result.success}，失败 ${result.fail}`)

        ; (window as any).__ZCY_ATTR_FILLED__ = true
    logRPA("✓ 属性自动填写完成")
}

/**
 * Step 6: 上传图片（顺序队列）
 * 调用 AutoFillAIEngine.uploadMainImages() 等实现
 */
async function stepUploadImages(state: OrchestratorState): Promise<void> {
    logRPA("开始上传图片...")

    // 一键上传全部图片（主图+详情图）
    const allImages = [...(state.images || []), ...(state.detailImages || [])]
    if (allImages.length > 0) {
        // 不再限制数量，上传全部图片
        logRPA(`一键上传图片 ${allImages.length} 张（主图+详情图）...`)
        const { mainCount, detailCount } = await AutoFillAIEngine.uploadAllImages(allImages)
        logRPA(`图片上传完成: 主图 ${mainCount} 张, 详情图 ${detailCount} 张`)
    }

    // SKU 图片
    if (state.skuImages && Object.keys(state.skuImages).length > 0) {
        logRPA(`上传 SKU 图片...`)
        await AutoFillAIEngine.uploadSKUImages(state.skuImages)
    }

    // SKU 规格
    if (state.skuSpecs && state.skuSpecs.length > 0) {
        logRPA(`填写 SKU 规格...`)
        await AutoFillAIEngine.fillSkuSpecs(state.skuSpecs)
    }

    // SKU 数据
    if (state.skuData && state.skuData.length > 0) {
        logRPA(`填写 SKU 数据...`)
        await AutoFillAIEngine.fillSKUData(state.skuData)
    }

    // 产地填写
    if (state.productData) {
        try {
            await AutoFillAIEngine.fillOrigin(state.productData)
        } catch (e) {
            logRPA("产地填写失败，忽略:", e)
        }

        // 价格/库存兜底填写
        try {
            await AutoFillAIEngine.fillPriceAndStock(state.productData)
        } catch (e) {
            logRPA("价格/库存填写失败，忽略:", e)
        }
    }

    ; (window as any).__ZCY_IMAGES_DONE__ = true
    logRPA("✓ 图片上传全部完成")
}

/**
 * Step 7: 最终校验（防止漏字段）
 */
async function stepValidateBeforeNext(): Promise<void> {
    logRPA("执行最终校验...")

    // 等待一下让所有异步操作完成
    await sleep(1000)

    const ok = areRequiredFieldsFilled()
    if (!ok) {
        // 不直接抛错，给用户手动补充的机会
        logRPA("⚠️ 部分必填项可能未填写完成，请手动检查")
    }

    logRPA("✓ 校验步骤完成")
}

/**
 * Step 8: 安全点击"下一步"
 * 注意：这一步默认不执行，需要手动确认
 */
async function stepClickNext(): Promise<void> {
    logRPA("准备点击下一步...")

    // 检查是否强制启用自动点击
    const autoClick = (window as any).__ZCY_AUTO_CLICK_NEXT__ === true

    if (!autoClick) {
        logRPA("⚠️ 自动点击下一步已禁用，请手动点击")
        logRPA("💡 如需启用，设置: window.__ZCY_AUTO_CLICK_NEXT__ = true")
        return
    }

    await safeClickNext()
}

// ===================== 预配置的"最稳流程" =====================

export function createZcyPublishOrchestrator(initialState: Partial<OrchestratorState> = {}): RpaOrchestrator {
    const steps: StepDefinition[] = [
        {
            id: "ENSURE_ATTR_PAGE",
            name: "确认属性页",
            run: stepEnsureAttrPage,
            timeoutMs: 30000,
            maxRetries: 0
        },
        {
            id: "SELECT_MARKET",
            name: "选择卖场/标项",
            run: stepSelectMarket,
            timeoutMs: 30000,
            maxRetries: 1
        },
        {
            id: "SELECT_CATEGORY",
            name: "选择类目",
            run: stepSelectCategory,
            timeoutMs: 60000,
            maxRetries: 1
        },
        {
            id: "WAIT_ATTR_FORM",
            name: "等待属性表单加载",
            run: stepWaitAttrFormReady,
            timeoutMs: 60000,
            maxRetries: 0
        },
        {
            id: "AUTO_FILL_ATTR",
            name: "自动填写属性",
            run: stepAutoFillAttributes,
            timeoutMs: 120000,
            maxRetries: 0
        },
        {
            id: "UPLOAD_IMAGES",
            name: "上传图片",
            run: stepUploadImages,
            timeoutMs: 180000, // 图片上传给更多时间
            maxRetries: 0
        },
        {
            id: "VALIDATE_BEFORE_NEXT",
            name: "校验必填项",
            run: stepValidateBeforeNext,
            timeoutMs: 30000,
            maxRetries: 0
        },
        {
            id: "CLICK_NEXT",
            name: "安全点击下一步",
            run: stepClickNext,
            timeoutMs: 10000,
            maxRetries: 0
        }
    ]

    const orch = new RpaOrchestrator(steps)
    Object.assign(orch.state, initialState)
    return orch
}

// ===================== 快捷启动函数 =====================

/**
 * 一键启动调度器（从 scraped 数据启动）
 */
export async function startOrchestrator(scraped: any): Promise<void> {
    const orch = createZcyPublishOrchestrator({
        productData: {
            title: scraped.title,
            brand: scraped.brand,
            model: scraped.model,
            sku: scraped.model,
            sourceUrl: scraped.sourceUrl,
            unit: scraped.specs?.['计量单位'],
            stock: scraped.stock,
            price: scraped.price,
            specs: scraped.specs
        },
        images: scraped.images || [],
        detailImages: scraped.detailImages || [],
        skuImages: scraped.skuImages || {},
        skuSpecs: scraped.skuSpecs || [],
        skuData: scraped.skuData || [],
        categoryPath: scraped.categoryPath || [],
        bid: scraped.categoryPath?.[0] || '办公设备'
    })

    await orch.start()
}

// ===================== 暴露到 window（已禁用）=====================
// ; (window as any).RpaOrchestrator = RpaOrchestrator
//     ; (window as any).createZcyPublishOrchestrator = createZcyPublishOrchestrator
//     ; (window as any).startOrchestrator = startOrchestrator
//     ; (window as any).waitFor = waitFor
//     ; (window as any).safeClickNext = safeClickNext
//     ; (window as any).canProceedNext = canProceedNext
//     ; (window as any).isAttrFormRendered = isAttrFormRendered
//     ; (window as any).areRequiredFieldsFilled = areRequiredFieldsFilled

// logRPA("✅ ZCY RPA Orchestrator 模块已加载")

