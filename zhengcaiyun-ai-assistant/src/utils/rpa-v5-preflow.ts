/**
 * RPA V5 前置流程：打开弹窗 → 展开市场 → 选标项 → 确定
 * 
 * 这是类目选择之前的必要步骤
 */

import { Util, StateReader, CategoryMatcher, RPACore } from './rpa-v5-engine';

// ========== 前置流程执行器 ==========
export const PreFlowExecutor = {

    /**
     * 打开"修改"弹窗
     */
    async openDialog(): Promise<boolean> {
        Util.log('步骤1: 打开修改弹窗...');

        // 找到"修改"按钮
        const modifyBtn = Util.findButton('修改') ||
            document.querySelector('.modify-btn, [class*="modify"]') as HTMLElement;

        if (modifyBtn) {
            modifyBtn.click();
            await Util.wait(1000);

            // 检查弹窗是否打开
            const dialog = await Util.waitFor('.doraemon-dialog, .el-dialog', 3000);
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
     */
    async selectBid(bidName: string): Promise<boolean> {
        Util.log(`步骤3: 选择标项 "${bidName}"...`);

        // ⭐ 多种选择器尝试
        const selectors = [
            'tr',                          // 表格行
            '.el-table__row',              // Element UI 表格行
            '[class*="row"]',              // 包含row的类
            '.bid-item',                   // 标项项
            '[class*="bid"]',              // 包含bid的类
            'label',                       // 标签
        ];

        for (const sel of selectors) {
            const items = document.querySelectorAll(sel);
            Util.log(`选择器 ${sel}: ${items.length} 项`);

            for (const item of items) {
                const text = (item as HTMLElement).innerText?.trim() || '';

                // 检查是否包含标项名称
                if (text.includes(bidName) || text.includes(`标项名称: ${bidName}`) || text.includes(`标项名称：${bidName}`)) {
                    Util.log(`找到标项行: "${text.substring(0, 50)}..."`);

                    // 找单选按钮
                    const radio = item.querySelector('input[type="radio"], .el-radio__input, .el-radio') as HTMLElement;
                    if (radio) {
                        radio.click();
                        await Util.wait(500);
                        Util.log(`✓ 已选择标项: ${bidName} (点击radio)`);
                        return true;
                    }

                    // 找可点击的 label 或链接
                    const clickable = item.querySelector('label, a, span[class*="label"]') as HTMLElement;
                    if (clickable) {
                        clickable.click();
                        await Util.wait(500);
                        Util.log(`✓ 已选择标项: ${bidName} (点击label)`);
                        return true;
                    }

                    // 直接点击该行
                    (item as HTMLElement).click();
                    await Util.wait(500);
                    Util.log(`✓ 已选择标项: ${bidName} (点击行)`);
                    return true;
                }
            }
        }

        // 兜底：在整个页面搜索包含标项名称的文字
        Util.log('尝试全页面搜索...');
        const allElements = document.querySelectorAll('*');
        for (const el of allElements) {
            const text = (el as HTMLElement).innerText?.trim() || '';
            if (text === `标项名称: ${bidName}` || text === `标项名称：${bidName}` || text === bidName) {
                Util.log(`全局找到: "${text}"`);
                // 点击父元素的 radio
                const parent = (el as HTMLElement).closest('tr, label, [class*="row"]');
                if (parent) {
                    const radio = parent.querySelector('input[type="radio"], .el-radio') as HTMLElement;
                    if (radio) {
                        radio.click();
                        await Util.wait(500);
                        Util.log(`✓ 已选择标项: ${bidName}`);
                        return true;
                    }
                    (parent as HTMLElement).click();
                    await Util.wait(500);
                    return true;
                }
            }
        }

        Util.log(`✗ 未找到标项: ${bidName}`);
        return false;
    },

    /**
     * 点击确定关闭弹窗
     */
    async confirmDialog(): Promise<boolean> {
        Util.log('步骤4: 确认关闭弹窗...');

        const confirmBtn = Util.findButton('确定') ||
            Util.findButton('确认') ||
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

export default PreFlowExecutor;
