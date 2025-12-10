import {
    openDialog,
    expandMarket,
    selectBid,
    confirmDialog,
    clickNext
} from "./ai-command-handlers";

import { sleep, selectCategory, selectCategoryLevel, selectCategoryPath } from "./category-selector";

export interface AICommand {
    type: string;
    value?: string;
    waitMs?: number;
}

export async function runAIPlan(commands: AICommand[]) {
    console.log("[AI执行器] 收到指令数量:", commands.length);
    console.table(commands.map((cmd, i) => ({
        步骤: i + 1,
        类型: cmd.type,
        值: cmd.value || '-',
        等待: cmd.waitMs || '-'
    })));

    for (let i = 0; i < commands.length; i++) {
        const cmd = commands[i];
        console.log(`[AI执行器] ▶ 执行步骤 ${i + 1}/${commands.length}:`, cmd);

        try {
            switch (cmd.type) {
                case "OPEN_DIALOG":
                    await openDialog();
                    break;

                case "EXPAND_MARKET":
                    await expandMarket(cmd.value!);
                    break;

                case "SELECT_BID":
                    await selectBid(cmd.value!);
                    break;

                case "CONFIRM_DIALOG":
                    await confirmDialog();
                    break;

                case "SELECT_CATEGORY_LEVEL1":
                    await selectCategoryLevel(1, cmd.value!);
                    break;

                case "SELECT_CATEGORY_LEVEL2":
                    await selectCategoryLevel(2, cmd.value!);
                    break;

                case "SELECT_CATEGORY_LEVEL3":
                    await selectCategoryLevel(3, cmd.value!);
                    break;

                case "SELECT_CATEGORY":
                    // 直接全弹窗搜索，不区分层级
                    await selectCategory(cmd.value!);
                    break;

                case "SELECT_CATEGORY_PATH":
                    // 逐级展开类目：["办公设备", "办公用纸", "打印复印纸"]
                    const path = typeof cmd.value === 'string'
                        ? JSON.parse(cmd.value)
                        : cmd.value;
                    await selectCategoryPath(path as string[]);
                    break;

                case "WAIT":
                    await sleep(cmd.waitMs || 500);
                    break;

                case "CLICK_NEXT":
                    await clickNext();
                    break;

                // 品牌型号暂时跳过
                case "INPUT_BRAND":
                case "SELECT_BRAND":
                case "INPUT_MODEL":
                case "SELECT_MODEL":
                    console.log(`[AI执行器] 跳过品牌型号步骤: ${cmd.type}`);
                    break;

                default:
                    console.warn("[AI执行器] 未知指令:", cmd);
            }

            console.log("[AI执行器] ✅ 步骤完成");
        } catch (e) {
            console.error("[AI执行器] ❌ 步骤失败：", e);
            throw e;
        }
    }

    console.log("[AI执行器] 🎉 AI 计划全部执行完成");
}
