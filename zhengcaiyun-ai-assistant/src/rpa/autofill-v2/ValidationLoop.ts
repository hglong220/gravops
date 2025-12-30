import type { ProductData, AutoFillReport } from './types';
import { PageScanner } from './PageScanner';
import { SemanticResolver } from './SemanticResolver';
import { FillExecutor } from './FillExecutor';
import { CacheStore } from './CacheStore';

const MAX_RETRY = 3;

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

/**
 * 等待表单 DOM 真正出现并稳定 (物理级判定)
 * ❗ 核心修复：只信 DOM，与 Scraper/Flags 完全解耦
 */
async function waitForFormStable(timeout = 8000): Promise<boolean> {
    const start = Date.now();
    console.log('[V2 Loop] 🔍 开始检测表单 DOM 是否就绪...');

    while (Date.now() - start < timeout) {
        // 政采云专用选择器 + 通用 UI 框架选择器
        const formItems = document.querySelectorAll(
            '.el-form-item, .ant-form-item, .doraemon-form-item, .attr-row, .publish-item, [class*="form-item"]'
        );

        const elapsed = Date.now() - start;

        if (formItems.length > 5) {
            console.log(`[V2 Loop] ✅ 检测到 ${formItems.length} 个表单项 (${elapsed}ms)，等待 DOM 稳定...`);
            await sleep(1000); // 发现后多等 1000ms 让它彻底稳定（政采云加载慢）

            // 二次确认：再次检查数量是否稳定
            const formItemsAfter = document.querySelectorAll(
                '.el-form-item, .ant-form-item, .doraemon-form-item, .attr-row, .publish-item, [class*="form-item"]'
            );
            console.log(`[V2 Loop] ✅ 稳定后检测到 ${formItemsAfter.length} 个表单项，DOM 已就绪`);
            return true;
        }

        // 每 1 秒输出一次等待进度
        if (elapsed % 1000 < 250) {
            console.log(`[V2 Loop] ⏳ 等待表单加载... (${Math.round(elapsed / 1000)}s, 当前 ${formItems.length} 项)`);
        }

        await sleep(200);
    }

    console.warn('[V2 Loop] ❌ 表单 DOM 等待超时 (8s)');
    return false;
}

/**
 * 触发一次页面校验 (暴力捕捉隐藏必填项)
 */
async function triggerValidation() {
    console.log('[V2 Loop] 正在尝试触发页面深度校验以捕捉隐藏报错项...');
    // 寻找保存草稿或类似按钮，但不点击（避免跳转），只通过失焦或模拟点击 input 触发
    const firstInput = document.querySelector('input, .el-select, .ant-select') as HTMLElement;
    if (firstInput) {
        firstInput.focus();
        await sleep(100);
        firstInput.blur();
    }
}

/**
 * 主执行循环
 */
export async function runAutoFillV2(productData: ProductData): Promise<AutoFillReport> {
    const report: AutoFillReport = {
        success: false,
        filledCount: 0,
        failedCount: 0,
        failedFields: []
    };

    console.log('[V2 Loop] >>> 引擎启动：跳过识别器，实施 DOM 绝对判定 <<<');

    // 1. 强制稳定 (核心修复 2) - 严查表单容器，杜绝 Fallback/假页面的干扰
    // ❗ V2 绝对禁止依赖 Scraper / Flags / Fallback -> 只信 DOM
    const isReady = await waitForFormStable();

    // 如果 waitForFormStable 通过，说明已有足够的表单项，直接允许执行
    // 不再强制要求顶层容器 (.ant-form) 存在，因为政采云结构多变
    if (!isReady) {
        // 最后兜底：检查是否至少有一些表单项
        const fallbackItems = document.querySelectorAll('.el-form-item, .doraemon-form-item, [class*="form-item"]');
        if (fallbackItems.length > 0) {
            console.log(`[V2 Loop] ⚠️ waitForFormStable 超时，但检测到 ${fallbackItems.length} 个表单项，强制继续执行`);
        } else {
            console.warn('[V2 Loop] ❌ 未能在页面发现任何表单项，V2 引擎判定为"未就绪"，拒绝执行');
            return { ...report, success: false, failedFields: [{ label: 'Global', reason: 'No Form Items Found' }] };
        }
    }

    console.log('[V2 Loop] ✅ 表单 DOM 检测通过，开始扫描必填项...');

    const MAX_ROUNDS = 2; // 只需要 2 轮：第一轮填写，第二轮复查
    const filledLabels = new Set<string>(); // 记录已成功填写的字段，避免重复

    for (let round = 1; round <= MAX_ROUNDS; round++) {
        console.log(`[V2 Loop] --- 第 ${round} 轮执行 ---`);

        // 获取当前全部可见的必填项
        let fieldsToProcess = PageScanner.scanRequiredFields();

        // 核心修复 3：如果第一轮没扫到（可能是没打星号），强制触发一次校验
        if (fieldsToProcess.length === 0 && round === 1) {
            console.log('[V2 Loop] 首轮未捕捉到必填项，尝试触发交互唤醒...');
            await triggerValidation();
            await sleep(500);
            fieldsToProcess = PageScanner.scanRequiredFields();
        }

        if (fieldsToProcess.length === 0) {
            console.log(`[V2 Loop] 第 ${round} 轮检测：无待填项，任务完成。`);
            report.success = true;
            break;
        }

        console.log(`[V2 Loop] 发现待处理字段数: ${fieldsToProcess.length}`);

        let filledThisRound = 0;
        let skippedThisRound = 0;

        for (const field of fieldsToProcess) {
            // 跳过已成功填写过的字段
            if (filledLabels.has(field.label)) {
                skippedThisRound++;
                continue;
            }

            // 检查字段是否已有值（支持 input/textarea/select）
            const container = field.domRef as HTMLElement;
            const input = container.querySelector('input:not([type="hidden"]), textarea') as HTMLInputElement;
            const selectTrigger = container.querySelector('.el-select, .ant-select, .doraemon-select') as HTMLElement;
            const radioChecked = container.querySelector('.el-radio.is-checked, .ant-radio-wrapper-checked, input[type="radio"]:checked');

            // 判断是否已有值
            let hasValue = false;
            if (input && input.value && input.value.trim()) {
                hasValue = true;
            } else if (selectTrigger) {
                // 检查 select 是否已选择（通常有 .el-input__inner 显示选中值）
                const selectedText = selectTrigger.querySelector('.el-input__inner, .ant-select-selection-item')?.textContent?.trim();
                if (selectedText && selectedText !== '请选择' && selectedText !== '') {
                    hasValue = true;
                }
            } else if (radioChecked) {
                hasValue = true;
            }

            // 如果已有值且没有报错，跳过
            const hasError = container.querySelector('.is-error, .el-form-item__error, .ant-form-item-explain-error');
            if (hasValue && !hasError) {
                console.log(`[V2 Loop] 跳过已填写字段: ${field.label}`);
                filledLabels.add(field.label); // 标记为已处理
                skippedThisRound++;
                continue;
            }

            try {
                const decision = await SemanticResolver.resolveField(field, productData);
                if (decision && decision.executePlan?.payload) {
                    console.log(`[V2 Loop] 填写字段: ${field.label} = ${decision.executePlan.payload}`);
                    const ok = await FillExecutor.executeFill(field, decision);
                    if (ok) {
                        report.filledCount++;
                        filledLabels.add(field.label); // 标记为已成功填写
                        CacheStore.recordSuccess(field.signature, decision);
                        filledThisRound++;
                    } else {
                        report.failedFields.push({ label: field.label, reason: '物理执行失败' });
                        report.failedCount++;
                    }
                } else {
                    console.log(`[V2 Loop] 无法解析字段值: ${field.label}`);
                }
            } catch (e) {
                console.error(`[V2 Loop] 字段解析异常: ${field.label}`, e);
            }
        }

        console.log(`[V2 Loop] 第 ${round} 轮结束: 填写 ${filledThisRound} 个, 跳过 ${skippedThisRound} 个`);

        // 如果这一轮没有填写任何新字段，说明已完成
        if (filledThisRound === 0) {
            console.log('[V2 Loop] 本轮无新填写，任务完成');
            report.success = true;
            break;
        }

        // 每轮结束留出呼吸时间让异步 state 更新
        await sleep(800);
    }

    console.log('[V2 Loop] >>> 填写任务结束 <<<', report);
    return report;
}

export const ValidationLoop = { runAutoFillV2 };
