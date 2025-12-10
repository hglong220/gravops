import { sleep } from "./category-selector";
import { selectCategoryLevel } from "./category-selector";
import { findElementByText, findElementByTextFuzzy } from "./find-element-by-text";

export async function openDialog() {
    console.log("[RPA] 打开电子卖场弹窗");

    const btn = document.querySelector(
        ".select-protocol-btn span"
    ) as HTMLElement;

    if (!btn) throw new Error("找不到【修改】按钮");

    btn.click();
    await sleep(500);
}

export async function expandMarket(name: string) {
    // 防止 AI 指令缺少 value
    if (!name) {
        console.error("[RPA] ❌ expandMarket 收到空值！AI 未返回电子卖场名称");
        throw new Error("expandMarket 指令缺少 value，AI 未返回电子卖场名称");
    }

    console.log("[RPA] 展开卖场:", name);

    // 使用模糊匹配：支持 "网上超市" 匹配 "网上超市(青海网超)"
    const row = findElementByTextFuzzy(
        document.body,
        ".doraemon-table-row .left, .double-line, .doraemon-table-row td",
        name
    );

    if (!row) throw new Error(`找不到电子卖场: ${name}`);

    // 找展开图标
    const expandIcon = row.parentElement!.querySelector(
        ".doraemon-table-row-expand-icon"
    ) as HTMLElement;

    if (!expandIcon) throw new Error("找不到展开图标");

    expandIcon.click();
    await sleep(500);
}

export async function selectBid(targetName: string) {
    console.log("[RPA] 开始选择标项:", targetName);

    if (!targetName) {
        throw new Error("selectBid 缺少 value");
    }

    // 找到所有标项行（基于真实 DOM 结构）
    const rows = Array.from(
        document.querySelectorAll("tbody.doraemon-table-tbody tr[data-row-key]")
    ) as HTMLElement[];

    if (!rows.length) {
        // 备用：找所有 tr
        const allRows = [...document.querySelectorAll('tr')] as HTMLElement[];

        for (const row of allRows) {
            const text = row.innerText.replace(/\s+/g, '');
            if (text.includes(`标项名称：${targetName}`) || text.includes(`标项名称:${targetName}`)) {
                const radio = row.querySelector("input[type='radio'], input.doraemon-radio-input") as HTMLInputElement;
                if (radio) {
                    radio.click();
                    console.log("[RPA] SELECT_BID (备用) 完成:", targetName);
                    await sleep(300);
                    return;
                }
            }
        }
        throw new Error("未找到标项列表");
    }

    for (const row of rows) {
        const nameCell = row.querySelector("td:nth-child(2)");
        if (!nameCell) continue;

        const text = (nameCell as HTMLElement).innerText.trim();

        // DOM 中真实结构为：标项名称：办公设备
        if (text.includes("标项名称：" + targetName) || text.includes("标项名称:" + targetName)) {
            console.log("[RPA] 找到标项行:", text);

            const radio = row.querySelector("input.doraemon-radio-input, input[type='radio']") as HTMLInputElement;
            if (!radio) {
                throw new Error("找到了标项行，但没有找到 radio 按钮");
            }

            // 点击 radio
            radio.click();

            console.log("[RPA] SELECT_BID 完成:", targetName);
            await sleep(300);
            return;
        }
    }

    throw new Error("找不到标项: " + targetName);
}

export async function confirmDialog() {
    console.log("[RPA] 点击确定按钮");

    const btn = findElementByText(document.body, ".doraemon-btn-primary span", "确定");

    if (!btn) throw new Error("找不到确定按钮");

    (btn as HTMLElement).click();
    await sleep(500);
}

export async function clickNext() {
    console.log("[RPA] 点击下一步");

    const btn = findElementByText(document.body, ".doraemon-btn span", "下一步");

    if (!btn) throw new Error("找不到下一步按钮");

    (btn as HTMLElement).click();
    await sleep(500);
}
