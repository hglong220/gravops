/**
 * RPA 旗舰版引擎 · 统一入口
 * 
 * ⭐ 核心架构：
 * - 旗舰版框架（项目类型检测、日志系统）
 * - 复用已验证的核心模块（rpa-v6-engine.ts）
 * - 每次点击后重新读取DOM，解决React重绘问题
 * 
 * 完整流程：
 * 1. 检测项目类型（一张网 vs 旧版）
 * 2. 前置流程：打开弹窗 → 展开市场 → 选标项 → 确定（仅旧版）
 * 3. 选择类目（SUPER_SELECTOR引擎）
 * 4. 填写属性（品牌/型号 + AI填充）
 * 5. 图片上传
 * 6. 下一步 → 发布 → 确认
 */

import { runCategorySelection, Util, RPAClicker, StateReader } from './rpa-v6-engine';
// ⭐ 静态导入 AI+RPA FINAL 引擎（避免动态import在Chrome扩展中失效）
import { AI as AIEngine, FormFiller as FormFillerEngine } from './ai-rpa-final';
// ⭐⭐⭐ 静态导入 Super Engine（必须静态导入，动态import在MV3中会失败）⭐⭐⭐
import { runZcySuperEngine } from './zcy-super-engine';

// ========== 接口定义 ==========
export interface FullAIResult {
    // 标项（一级类目权限）
    bid: string;

    // 类目路径
    categoryPath: string[];

    // 商品属性
    attributes: Array<{ label: string; value: string }>;

    // 商品主图URL列表
    images?: string[];

    // 商品详情图URL列表
    detailImages?: string[];

    // 商品标题（用于日志）
    title?: string;

    // 品牌（用于精确选择）
    brand?: string;

    // 型号
    model?: string;

    // ⭐ 新增：价格（原始采集价格，会自动下浮3-5%）
    price?: number;

    // ⭐ 新增：库存
    stock?: number;

    // ⭐ 新增：采集的规格参数
    specs?: { [key: string]: string };

    // ⭐ 新增：类目名称（用于获取默认值）
    categoryName?: string;

    // ⭐ 新增：采集来源链接（电商平台链接）
    sourceUrl?: string;
}

// ========== 前置流程执行器 ==========
export const PreFlowExecutor = {

    /**
     * 打开"修改"弹窗
     */
    async openDialog(): Promise<boolean> {
        Util.log('步骤1: 打开修改弹窗...');

        // 找到"修改"按钮
        const modifyBtn = findButton('修改') ||
            document.querySelector('.modify-btn, [class*="modify"]') as HTMLElement;

        if (modifyBtn) {
            modifyBtn.click();
            await Util.wait(1000);

            // 检查弹窗是否打开
            const dialog = await waitFor('.doraemon-dialog, .el-dialog', 3000);
            if (dialog) {
                Util.log('✓ 弹窗已打开');
                return true;
            }
        }

        Util.log('✗ 无法打开弹窗');
        return false;
    },

    /**
     * 展开电子卖场（点击"+"号）
     */
    async expandMarket(marketName = '网上超市'): Promise<boolean> {
        Util.log(`步骤2: 展开电子卖场 "${marketName}"...`);

        // 找到电子卖场列表中的展开图标
        const marketItems = document.querySelectorAll('.market-item, .tree-node, [class*="market"]');

        for (const item of marketItems) {
            const text = (item as HTMLElement).innerText;
            if (text?.includes(marketName) || text?.includes('网上超市')) {
                // 找到展开图标
                const expandIcon = item.querySelector('.expand-icon, .el-icon-arrow-right, [class*="expand"], .plus-icon');
                if (expandIcon) {
                    (expandIcon as HTMLElement).click();
                    await Util.wait(800);
                    Util.log('✓ 已展开电子卖场');
                    return true;
                }

                // 尝试直接点击
                (item as HTMLElement).click();
                await Util.wait(800);
                return true;
            }
        }

        // 兜底：点击第一个可展开的项
        const anyExpand = document.querySelector('.el-icon-arrow-right, [class*="expand"]');
        if (anyExpand) {
            (anyExpand as HTMLElement).click();
            await Util.wait(800);
            return true;
        }

        Util.log('✗ 未找到电子卖场');
        return false;
    },
    /**
     * 选择标项（一级类目权限）
     * ⭐⭐⭐ 关键改进：先找精确匹配的单元格，再向上找行和radio ⭐⭐⭐
     */
    async selectBid(bidName: string): Promise<boolean> {
        Util.log(`步骤3: 选择标项 "${bidName}"...`);

        // 精确匹配模式
        const exactTexts = [
            `标项名称: ${bidName}`,
            `标项名称：${bidName}`,
            `标项名称:${bidName}`,
        ];

        // ⭐⭐⭐ 方法1: 找到精确包含标项名称的单元格 ⭐⭐⭐
        // 这是最可靠的方法，因为单元格的innerText只包含自己的内容
        const allCells = document.querySelectorAll('td, span, div, label');
        Util.log(`搜索 ${allCells.length} 个单元格...`);

        for (const cell of allCells) {
            const cellText = (cell as HTMLElement).innerText?.trim() || '';

            // ⭐ 检查单元格文本是否精确匹配任何模式
            const matchedPattern = exactTexts.find(pattern =>
                cellText === pattern ||
                cellText.startsWith(pattern + ' ') ||  // "标项名称: 办公设备 设为默认"
                cellText.startsWith(pattern + '\n') ||
                cellText === pattern.replace(/\s/g, '')  // 无空格版本
            );

            if (matchedPattern) {
                Util.log(`✓ 找到精确匹配单元格: "${cellText.substring(0, 40)}..."`);

                // 向上找到包含该单元格的表格行
                const parentRow = (cell as HTMLElement).closest('tr, .el-table__row, [class*="row"]');

                if (parentRow) {
                    Util.log(`找到父行元素`);

                    // 在该行中找 radio
                    const radio = parentRow.querySelector(
                        'input[type="radio"], .el-radio__input, .el-radio__inner, .el-radio, .el-radio__original'
                    ) as HTMLElement;

                    if (radio) {
                        // 检查是否已选中
                        const radioContainer = radio.closest('.el-radio');
                        const isAlreadyChecked =
                            (radio as HTMLInputElement).checked ||
                            radio.classList.contains('is-checked') ||
                            radioContainer?.classList.contains('is-checked');

                        if (isAlreadyChecked) {
                            Util.log(`标项 "${bidName}" 已经是选中状态`);
                        } else {
                            // 点击 radio
                            Util.log(`点击 radio...`);
                            radio.click();
                        }

                        await Util.wait(1000);  // 等待页面刷新
                        Util.log(`✅ 已选择标项: ${bidName}`);
                        return true;
                    } else {
                        // 没找到 radio，尝试点击行本身
                        Util.log('未找到 radio，尝试点击整行...');
                        (parentRow as HTMLElement).click();
                        await Util.wait(1000);
                        return true;
                    }
                }
            }
        }

        // ⭐⭐⭐ 方法2: 备用 - 直接遍历所有 radio，检查相邻文本 ⭐⭐⭐
        Util.log('单元格搜索失败，尝试遍历所有 radio...');
        const allRadios = document.querySelectorAll('input[type="radio"], .el-radio');

        for (const radio of allRadios) {
            // 获取 radio 所在行的文本
            const parentRow = (radio as HTMLElement).closest('tr, [class*="row"]');
            if (!parentRow) continue;

            const rowText = (parentRow as HTMLElement).innerText || '';

            // 检查这一行是否只包含目标标项（不包含其他标项）
            const containsTarget = exactTexts.some(pattern => rowText.includes(pattern));

            if (containsTarget) {
                // 额外验证：确保这一行不包含其他标项名称
                const otherBids = ['办公用品', '办公设备', '日用百货', '计算机设备', '劳动保护用品', '灯具商品', '五金工具'];
                const otherBidsInRow = otherBids.filter(bid => bid !== bidName && rowText.includes(`标项名称: ${bid}`));

                if (otherBidsInRow.length === 0) {
                    Util.log(`✓ 通过 radio 找到标项行: "${rowText.substring(0, 50)}..."`);
                    (radio as HTMLElement).click();
                    await Util.wait(1000);
                    Util.log(`✅ 已选择标项: ${bidName}`);
                    return true;
                }
            }
        }

        Util.log(`❌ 未找到标项: ${bidName}`);
        return false;
    },

    /**
     * 点击确定关闭弹窗
     */
    async confirmDialog(): Promise<boolean> {
        Util.log('步骤4: 确认关闭弹窗...');

        const confirmBtn = findButton('确定') ||
            findButton('确认') ||
            document.querySelector('.doraemon-dialog .el-button--primary') as HTMLElement;

        if (confirmBtn) {
            confirmBtn.click();
            await Util.wait(1500);

            // 检查弹窗是否关闭
            const dialog = document.querySelector('.doraemon-dialog, .el-dialog');
            if (!dialog) {
                Util.log('✓ 弹窗已关闭');
                return true;
            }
        }

        Util.log('✗ 未能确认关闭弹窗');
        return false;
    },

    /**
     * 执行完整前置流程
     */
    async runPreFlow(bidName: string): Promise<boolean> {
        Util.log('========== 开始前置流程 ==========');
        Util.log(`🎯 目标标项: "${bidName}"`);

        // ⚠️ 不再跳过！必须每次都选对标项！
        // 因为页面可能显示的是错误标项的类目

        // 1. 打开弹窗（点击"修改"按钮）
        const dialogOk = await this.openDialog();
        if (!dialogOk) {
            // 弹窗可能已经打开
            const existing = document.querySelector('.doraemon-dialog');
            if (!existing) {
                Util.log('⚠️ 无法打开弹窗，可能已在正确状态');
            }
        }

        // 2. 展开电子卖场
        await this.expandMarket();

        // 3. 选择标项（关键步骤！）
        const bidOk = await this.selectBid(bidName);
        if (!bidOk) {
            Util.log('❌ 标项选择失败！');
            return false;  // 标项选择失败就停止
        }

        // 4. 确认
        await this.confirmDialog();

        // 5. 等待类目选择区域出现
        await Util.wait(2000);

        const finalState = StateReader.getState();
        if (finalState.level1.length > 0) {
            Util.log(`========== 前置流程完成 ==========`);
            Util.log(`✅ 标项 "${bidName}" 下的一级类目 (${finalState.level1.length} 个):`);
            Util.log(`   [${finalState.level1.slice(0, 6).join(', ')}${finalState.level1.length > 6 ? '...' : ''}]`);
            return true;
        }

        Util.log('⚠️ 前置流程完成但未检测到类目列表');
        return true; // 继续尝试
    }
};

// ========== 辅助函数 ==========

function findButton(text: string): HTMLElement | null {
    const buttons = document.querySelectorAll('button, .el-button, [role="button"]');
    for (const btn of buttons) {
        if ((btn as HTMLElement).innerText?.includes(text)) {
            return btn as HTMLElement;
        }
    }
    return null;
}

async function waitFor(selector: string, timeout = 5000): Promise<Element | null> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        const el = document.querySelector(selector);
        if (el) return el;
        await Util.wait(200);
    }
    return null;
}

// ========== 项目类型检测 ==========

export type ProjectType = 'legacy' | 'yizhangwang';

/**
 * ⭐⭐⭐ 检测项目类型 ⭐⭐⭐
 * - legacy: 旧版账号，需要选择标项（7个一级类目）
 * - yizhangwang: 一张网账号，跳过标项（26个一级类目）
 */
export function detectProjectType(): ProjectType {
    const pageText = document.body.innerText || '';

    // 检测关键词
    const isYizhangwang = pageText.includes('一张网') ||
        pageText.includes('承诺式入围') ||
        pageText.includes('"一张网"');

    if (isYizhangwang) {
        Util.log('📌 检测到"一张网"项目类型');
        return 'yizhangwang';
    }

    Util.log('📌 检测到旧版标项项目类型');
    return 'legacy';
}

/**
 * 🚀 旗舰版全自动发布入口
 */
export async function executeFullAutoPublish(aiResult: FullAIResult): Promise<boolean> {
    Util.log('══════════════════════════════════════');
    Util.log('🚀 RPA 旗舰版引擎启动');
    Util.log(`商品: ${aiResult.title || '未知'}`);
    Util.log(`类目: ${aiResult.categoryPath.join(' > ')}`);
    Util.log('══════════════════════════════════════');

    try {
        // ========== 阶段0: 检测项目类型 ==========
        const projectType = detectProjectType();
        Util.log(`\n📋 项目类型: ${projectType === 'yizhangwang' ? '"一张网"承诺式入围' : '旧版标项'}`);

        // ========== 阶段1: 前置流程（根据项目类型决定） ==========
        if (projectType === 'legacy') {
            // 旧版：需要执行前置流程（弹窗/标项选择）
            Util.log('\n📋 阶段1: 前置流程（弹窗/标项）');
            const preOk = await PreFlowExecutor.runPreFlow(aiResult.bid);
            if (!preOk) {
                Util.log('❌ 前置流程失败');
                return false;
            }
        } else {
            // 一张网：跳过前置流程，直接进入类目选择
            Util.log('\n📋 阶段1: 跳过前置流程（一张网项目）');
            Util.log('✅ 一张网项目无需选择标项，直接使用AI生成的类目');
        }

        // ========== 阶段2: 类目选择（SUPER_SELECTOR引擎）==========
        Util.log('\n📋 阶段2: 类目选择（SUPER_SELECTOR引擎）');

        // ⭐ 根据项目类型处理 categoryPath
        let actualCategoryPath = [...aiResult.categoryPath];

        if (projectType === 'legacy') {
            // 旧版：如果 categoryPath 第一个元素与 bid 相同，则跳过
            if (actualCategoryPath.length > 0 && actualCategoryPath[0] === aiResult.bid) {
                Util.log(`⚠️ categoryPath 第一个元素 "${actualCategoryPath[0]}" 与 bid 相同，跳过`);
                actualCategoryPath = actualCategoryPath.slice(1);
            }
        } else {
            // 一张网：直接使用完整的 categoryPath
            Util.log(`📂 一张网使用完整类目路径`);
        }

        Util.log(`📂 实际类目路径: ${actualCategoryPath.join(' > ')}`);

        // ⭐ 使用 SUPER_SELECTOR 引擎
        const catOk = await runCategorySelection(actualCategoryPath);
        if (!catOk) {
            Util.log('❌ 类目选择失败');
            return false;
        }

        // ⭐ 等待属性区域加载
        Util.log('等待属性区域加载...');
        await Util.wait(2000);

        // ========== 阶段3: 属性填写 ==========
        Util.log('\n📋 阶段3: 属性填写');

        // ⭐⭐⭐ 3.1 品牌处理：使用 RPAClicker（成熟的下拉选择器） ⭐⭐⭐
        let cleanBrand = '';

        // 优先从 specs 获取品牌
        if (aiResult.specs?.['品牌']) {
            cleanBrand = aiResult.specs['品牌'];
            Util.log(`📌 从 specs 获取品牌: "${cleanBrand}"`);
        } else if (aiResult.brand && aiResult.brand.length <= 10) {
            cleanBrand = aiResult.brand;
            Util.log(`📌 使用 brand 字段: "${cleanBrand}"`);
        } else if (aiResult.brand) {
            // 品牌太长，从标题提取
            const knownBrands = [
                '得力', 'deli', '齐心', '晨光', '惠普', 'HP', '佳能', 'Canon',
                '爱普生', 'Epson', '联想', 'Lenovo', '华为', 'HUAWEI', '小米',
                '虎牌', 'TIGER', '永发', '全能', '大一', '艾谱', 'AIPU', '科密',
                '三星', 'Samsung', '戴尔', 'Dell', '华硕', 'ASUS',
                '兄弟', 'Brother', '理光', 'Ricoh', '京瓷', 'Kyocera',
                '美的', 'Midea', '格力', 'GREE', '海尔', 'Haier',
            ];
            const text = (aiResult.title || aiResult.brand).toLowerCase();
            for (const b of knownBrands) {
                if (text.includes(b.toLowerCase())) {
                    cleanBrand = b;
                    Util.log(`📌 从标题提取品牌: "${cleanBrand}"`);
                    break;
                }
            }
        }

        if (cleanBrand) {
            Util.log(`\n🏷️ 选择品牌: "${cleanBrand}"`);
            await RPAClicker.selectBrand(cleanBrand);
            await Util.wait(500);
        }

        // ⭐⭐⭐ 3.2 型号处理：使用 RPAClicker ⭐⭐⭐
        let cleanModel = aiResult.specs?.['型号'] || aiResult.specs?.['商品型号'] || aiResult.model || '';
        if (!cleanModel && aiResult.title) {
            const m = aiResult.title.match(/[A-Za-z]+[-]?[0-9]+[A-Za-z0-9-]*/);
            if (m) cleanModel = m[0];
        }
        if (cleanModel) {
            Util.log(`📦 填写型号: "${cleanModel}"`);
            await RPAClicker.inputModel(cleanModel);
            await Util.wait(300);
        }

        // ⭐⭐⭐ 3.3 使用 Super Engine 统一填写其他表单字段 ⭐⭐⭐
        Util.log('\n🚀 使用 Super Engine 填写其他表单字段...');

        try {
            // ⭐ 使用静态导入的 Super Engine（不使用动态import，MV3会失败）
            const result = await runZcySuperEngine({
                title: aiResult.title,
                brand: aiResult.brand,
                model: aiResult.model,
                price: aiResult.price,
                stock: aiResult.stock,
                specs: aiResult.specs,
                categoryPath: aiResult.categoryPath,
                categoryName: aiResult.categoryName || aiResult.categoryPath[aiResult.categoryPath.length - 1],
                sourceUrl: aiResult.sourceUrl,
                images: aiResult.images,
            });

            Util.log(`✅ Super Engine 完成: 成功 ${result.success}, 失败 ${result.fail}, 跳过 ${result.skipped}`);

        } catch (engineError) {
            Util.log('⚠️ Super Engine 加载失败，使用传统方式:', engineError);

            // 回退到传统 AI+RPA FINAL 引擎
            try {
                const taskExtra = {
                    title: aiResult.title,
                    brand: aiResult.brand,
                    model: aiResult.model,
                    price: aiResult.price,
                    stock: aiResult.stock,
                    specs: aiResult.specs,
                    categoryPath: aiResult.categoryPath,
                    categoryName: aiResult.categoryName || aiResult.categoryPath[aiResult.categoryPath.length - 1],
                    sourceUrl: aiResult.sourceUrl
                };

                const analysisResult = await AIEngine.analyzeForPublish(taskExtra);
                await FormFillerEngine.fillAll(analysisResult.attributes);
            } catch (fallbackError) {
                Util.log('⚠️ 传统引擎也失败:', fallbackError);
            }
        }

        // ========== 阶段4: 点击下一步 ==========
        Util.log('\n📋 阶段4: 点击下一步');
        const nextClicked = await RPAClicker.clickButton('下一步');

        if (nextClicked) {
            Util.log('✓ 已点击下一步，等待页面加载...');
            // 等待页面加载（SPA跳转可能需要更长时间）
            await Util.wait(4000);

            // ========== 阶段5: 发布页面填写 ==========
            // ⭐ 关键修复：由于是SPA，不能依赖handlePublishPage，直接在这里继续执行
            if (window.location.pathname.includes('/goods/publish') ||
                window.location.href.includes('/goods/publish')) {

                Util.log('\n📋 阶段5: 发布页面自动填写');
                Util.log('═══════════════════════════════════════');

                // 再等待一下，确保表单完全加载
                await Util.wait(2000);

                // 重新扫描并填写发布页面的字段
                try {
                    const taskExtra = {
                        title: aiResult.title,
                        brand: aiResult.brand,
                        model: aiResult.model,
                        price: aiResult.price,
                        stock: aiResult.stock,
                        specs: aiResult.specs,
                        categoryPath: aiResult.categoryPath,
                        categoryName: aiResult.categoryName || aiResult.categoryPath[aiResult.categoryPath.length - 1],
                        sourceUrl: aiResult.sourceUrl  // ⭐ 采集来源链接
                    };

                    // AI 重新分析发布页面
                    const publishAnalysis = await AIEngine.analyzeForPublish(taskExtra);
                    Util.log(`发布页面 AI 生成 ${publishAnalysis.attributes.length} 个属性`);

                    // 填写发布页面表单
                    const publishFillResult = await FormFillerEngine.fillAll(publishAnalysis.attributes);
                    Util.log(`发布页面填写: ${publishFillResult.success} 成功, ${publishFillResult.failed} 失败`);

                } catch (publishError) {
                    Util.log('⚠️ 发布页面填写异常:', publishError);
                }

                Util.log('═══════════════════════════════════════');
            } else {
                Util.log('⚠️ 页面可能仍在加载，请手动检查...');
            }
        } else {
            Util.log('⚠️ 未能点击下一步按钮');
        }

        Util.log('\n══════════════════════════════════════');
        Util.log('✅ 全流程执行完成！');
        Util.log('══════════════════════════════════════');

        return true;

    } catch (error) {
        Util.log(`\n❌ 执行失败: ${error}`);
        return false;
    }
}
