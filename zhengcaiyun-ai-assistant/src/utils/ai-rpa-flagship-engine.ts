// src/utils/ai-rpa-flagship-engine.ts
// ============================================================================
// AI + RPA FINAL 超级旗舰版执行引擎
// ⭐ 核心：复用已经验证的 rpa-v6-engine.ts 中的模块
// ============================================================================

// ⭐⭐⭐ 导入已验证的核心模块 ⭐⭐⭐
import { runCategorySelection, Util, RPAClicker, StateReader } from './rpa-v6-engine';
import { AI as AIEngine, FormFiller as FormFillerEngine } from './ai-rpa-final';

/** AI 侧统一约定的数据结构 */
export interface AiAttribute {
    key?: string
    label: string
    value: string
    type?: "text" | "number" | "select" | "radio" | "checkbox" | "textarea"
}

export interface AiImage {
    url: string
    kind?: "main" | "detail" | "sku" | "other"
}

export interface AiResultPayload {
    categoryPath?: string[]
    bid?: string
    attributes?: AiAttribute[]
    images?: AiImage[]
    title?: string
    brand?: string
    model?: string
    price?: number
    stock?: number
    specs?: Record<string, string>
    categoryName?: string
    sourceUrl?: string
}

export interface FlagshipOptions {
    mode?: "auto" | "safe"
    debug?: boolean
    skipCategory?: boolean
    skipPreFlow?: boolean
}

// ============================================================================
// Logger
// ============================================================================

class Logger {
    prefix = "[旗舰版]"

    log(...args: any[]) {
        console.log(this.prefix, ...args)
    }

    debug(...args: any[]) {
        console.debug(this.prefix, ...args)
    }

    warn(...args: any[]) {
        console.warn(this.prefix, ...args)
    }

    error(...args: any[]) {
        console.error(this.prefix, ...args)
    }
}

const LOG = new Logger()

// ============================================================================
// 项目类型检测
// ============================================================================

export type ProjectType = 'legacy' | 'yizhangwang';

export function detectProjectType(): ProjectType {
    const pageText = document.body.innerText || '';

    if (pageText.includes('一张网') ||
        pageText.includes('承诺式入围') ||
        pageText.includes('"一张网"')) {
        LOG.log('📌 检测到"一张网"项目类型');
        return 'yizhangwang';
    }

    LOG.log('📌 检测到旧版标项项目类型');
    return 'legacy';
}

// ============================================================================
// 前置流程执行器（复用已有逻辑）
// ============================================================================

class PreFlowExecutor {
    async runPreFlow(bidName: string): Promise<boolean> {
        LOG.log('开始执行前置流程...');

        // 检查是否已在类目选择界面
        const categoryList = document.querySelector('.category-list, .doraemon-list-items, .cascader-menu');
        if (categoryList) {
            LOG.log('✓ 已在类目选择界面，跳过前置流程');
            return true;
        }

        // 尝试打开弹窗
        await this.openDialog();

        // 展开电子卖场
        await this.expandMarket();

        // 选择标项
        if (bidName) {
            await this.selectBid(bidName);
        }

        // 点击确定
        await this.clickConfirm();

        LOG.log('前置流程完成');
        return true;
    }

    private async openDialog(): Promise<boolean> {
        const buttons = document.querySelectorAll('button, .el-button, [role="button"]');
        for (const btn of buttons) {
            if ((btn as HTMLElement).innerText?.includes('修改')) {
                (btn as HTMLElement).click();
                await Util.wait(1000);
                return true;
            }
        }
        return false;
    }

    private async expandMarket(): Promise<boolean> {
        const expandIcons = document.querySelectorAll(
            '.el-icon-arrow-right, .el-table__expand-icon, [class*="expand"], .el-icon-plus'
        );

        for (const icon of Array.from(expandIcons)) {
            const row = icon.closest('tr, .el-table__row');
            if (row?.textContent?.includes('网上超市')) {
                (icon as HTMLElement).click();
                await Util.wait(800);
                return true;
            }
        }

        if (expandIcons.length > 0) {
            (expandIcons[0] as HTMLElement).click();
            await Util.wait(800);
            return true;
        }

        return false;
    }

    private async selectBid(bidName: string): Promise<boolean> {
        const cells = document.querySelectorAll('td, span, div, label');

        for (const cell of Array.from(cells)) {
            const text = (cell as HTMLElement).innerText?.trim() || '';
            if (text.includes('标项名称') && text.includes(bidName)) {
                const row = (cell as HTMLElement).closest('tr, .el-table__row, [class*="row"]');
                if (row) {
                    const radio = row.querySelector('input[type="radio"], .el-radio__input, .el-radio');
                    if (radio) {
                        (radio as HTMLElement).click();
                        await Util.wait(500);
                        LOG.log(`✓ 已选择标项: ${bidName}`);
                        return true;
                    }
                }
            }
        }

        LOG.warn(`未找到标项: ${bidName}`);
        return false;
    }

    private async clickConfirm(): Promise<boolean> {
        const buttons = document.querySelectorAll('button, .el-button, .doraemon-btn');
        for (const btn of buttons) {
            const text = (btn as HTMLElement).innerText?.trim();
            if (text === '确定' || text === '确认') {
                (btn as HTMLElement).click();
                await Util.wait(1500);
                return true;
            }
        }
        return false;
    }
}

const preFlowExecutor = new PreFlowExecutor();

// ============================================================================
// 品牌清洗
// ============================================================================

function cleanBrand(brand: string | undefined, specs: Record<string, string> | undefined, title: string | undefined): string {
    // 优先使用 specs 中的品牌
    if (specs?.['品牌']) {
        LOG.log(`📌 从 specs 获取品牌: "${specs['品牌']}"`);
        return specs['品牌'];
    }

    if (!brand) return '';

    // 如果品牌长度合理，直接使用
    if (brand.length <= 10) {
        LOG.log(`📌 使用 brand 字段: "${brand}"`);
        return brand;
    }

    // 品牌太长，从标题中提取
    LOG.log(`⚠️ brand 太长 (${brand.length}字符)，尝试从标题提取`);
    const knownBrands = [
        '得力', 'deli', '齐心', '晨光', '惠普', 'HP', '佳能', 'Canon',
        '爱普生', 'Epson', '联想', 'Lenovo', '华为', 'HUAWEI', '小米',
        '虎牌', 'TIGER', '永发', '全能', '大一', '艾谱', 'AIPU', '科密',
        '三星', 'Samsung', '戴尔', 'Dell', '华硕', 'ASUS',
        '兄弟', 'Brother', '理光', 'Ricoh', '京瓷', 'Kyocera',
        '美的', 'Midea', '格力', 'GREE', '海尔', 'Haier',
    ];

    const text = (title || brand).toLowerCase();
    for (const b of knownBrands) {
        if (text.includes(b.toLowerCase())) {
            LOG.log(`✓ 从标题提取品牌: "${b}"`);
            return b;
        }
    }

    return '';
}

// ============================================================================
// 型号清洗
// ============================================================================

function cleanModel(model: string | undefined, specs: Record<string, string> | undefined, title: string | undefined): string {
    // 优先使用 specs 中的型号
    if (specs?.['型号']) {
        LOG.log(`📌 从 specs 获取型号: "${specs['型号']}"`);
        return specs['型号'];
    }
    if (specs?.['商品型号']) {
        LOG.log(`📌 从 specs 获取型号: "${specs['商品型号']}"`);
        return specs['商品型号'];
    }

    if (model) return model;

    // 从标题提取
    if (title) {
        const match = title.match(/[A-Za-z]+[-]?[0-9]+[A-Za-z0-9-]*/);
        if (match) {
            LOG.log(`✓ 从标题提取型号: "${match[0]}"`);
            return match[0];
        }
    }

    return '';
}

// ============================================================================
// 总控引擎
// ============================================================================

class FlagshipEngine {
    async run(ai: AiResultPayload, options: FlagshipOptions = {}): Promise<boolean> {
        LOG.log("══════════════════════════════════════");
        LOG.log("🚀 旗舰版引擎启动");
        LOG.log(`商品: ${ai.title || '未知'}`);
        LOG.log(`类目: ${(ai.categoryPath || []).join(' > ')}`);
        LOG.log("══════════════════════════════════════");

        try {
            // ========== 阶段0: 检测项目类型 ==========
            const projectType = detectProjectType();
            LOG.log(`\n📋 项目类型: ${projectType === 'yizhangwang' ? '"一张网"' : '旧版标项'}`);

            // ========== 阶段1: 前置流程 ==========
            if (projectType === 'legacy' && !options.skipPreFlow) {
                LOG.log('\n📋 阶段1: 前置流程（弹窗/标项）');
                await preFlowExecutor.runPreFlow(ai.bid || '');
            } else {
                LOG.log('\n📋 阶段1: 跳过前置流程（一张网项目）');
            }

            // ========== 阶段2: 类目选择 ==========
            if (!options.skipCategory) {
                LOG.log('\n📋 阶段2: 类目选择');
                let categoryPath = ai.categoryPath || [];

                // 旧版账号：如果第一级与 bid 相同，跳过
                if (projectType === 'legacy' && categoryPath.length > 0 && categoryPath[0] === ai.bid) {
                    LOG.log(`⚠️ 跳过第一级类目（与 bid 相同）`);
                    categoryPath = categoryPath.slice(1);
                }

                LOG.log(`📂 实际类目路径: ${categoryPath.join(' > ')}`);

                // ⭐ 使用已验证的类目选择器
                const catOk = await runCategorySelection(categoryPath);
                if (!catOk) {
                    LOG.error("类目选择失败");
                    return false;
                }

                // 等待属性表单加载
                await Util.wait(2000);
            }

            // ========== 阶段3: 属性填写 ==========
            LOG.log('\n📋 阶段3: 属性填写');

            // 3.1 品牌处理
            const brand = cleanBrand(ai.brand, ai.specs, ai.title);
            if (brand) {
                LOG.log(`🏷️ 选择品牌: "${brand}"`);
                await RPAClicker.selectBrand(brand);  // ⭐ 使用已验证的品牌选择器
                await Util.wait(500);
            }

            // 3.2 型号处理
            const model = cleanModel(ai.model, ai.specs, ai.title);
            if (model) {
                LOG.log(`📦 填写型号: "${model}"`);
                await RPAClicker.inputModel(model);  // ⭐ 使用已验证的型号填写器
                await Util.wait(300);
            }

            // 3.3 其他属性
            LOG.log('\n🔍 使用 AI+RPA FINAL 引擎填写其他属性...');
            try {
                const taskExtra = {
                    title: ai.title,
                    brand: brand,
                    model: model,
                    price: ai.price,
                    stock: ai.stock,
                    specs: ai.specs,
                    categoryPath: ai.categoryPath,
                    categoryName: ai.categoryName || (ai.categoryPath ? ai.categoryPath[ai.categoryPath.length - 1] : ''),
                    sourceUrl: ai.sourceUrl
                };

                const analysisResult = await AIEngine.analyzeForPublish(taskExtra);
                LOG.log(`AI 生成 ${analysisResult.attributes.length} 个属性待填写`);

                const fillResult = await FormFillerEngine.fillAll(analysisResult.attributes);
                LOG.log(`表单填写完成: ${fillResult.success} 成功, ${fillResult.failed} 失败`);
            } catch (formError) {
                LOG.warn('AI+RPA 引擎异常:', formError);
            }

            // ========== 阶段4: 自动提交 ==========
            if (options.mode === 'auto') {
                LOG.log('\n📋 阶段4: 自动提交');
                await this.clickNextAndSubmit();
            }

            LOG.log("\n══════════════════════════════════════");
            LOG.log("✅ 旗舰版引擎执行完成");
            LOG.log("══════════════════════════════════════");
            return true;

        } catch (error) {
            LOG.error("旗舰版引擎执行异常:", error);
            return false;
        }
    }

    async clickNextAndSubmit() {
        // 点击"下一步"
        const buttons = document.querySelectorAll('button, .el-button, .doraemon-btn');

        for (const btn of buttons) {
            const text = (btn as HTMLElement).innerText?.trim();
            if (text?.includes('下一步') || text?.includes('保存并下一步')) {
                LOG.log('点击【下一步】');
                (btn as HTMLElement).click();
                await Util.wait(2000);
                break;
            }
        }

        // 点击"提交/发布"
        const buttons2 = document.querySelectorAll('button, .el-button, .doraemon-btn');
        for (const btn of buttons2) {
            const text = (btn as HTMLElement).innerText?.trim();
            if (text === '提交' || text === '发布') {
                LOG.log('点击【提交/发布】');
                (btn as HTMLElement).click();
                await Util.wait(1500);
                break;
            }
        }
    }
}

// 单例导出
const FLAGSHIP = new FlagshipEngine();
export default FLAGSHIP;

// 挂到 window 方便调试
; (window as any).AI_RPA_FLAGSHIP = FLAGSHIP;
