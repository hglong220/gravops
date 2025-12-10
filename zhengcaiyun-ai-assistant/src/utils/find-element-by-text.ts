// 严格匹配
export function findElementByText(
    root: ParentNode,
    selector: string,
    text: string
): HTMLElement | null {
    const list = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    const target = list.find((el) => el.innerText.trim() === text.trim());
    return target || null;
}

// 模糊匹配（推荐用于电子卖场等场景）
export function findElementByTextFuzzy(
    root: ParentNode,
    selector: string,
    text: string
): HTMLElement | null {
    const list = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    const searchText = text.replace(/\s+/g, '');

    // 优先精确匹配
    let target = list.find((el) => el.innerText.trim() === text.trim());

    // 如果没找到，再模糊匹配
    if (!target) {
        target = list.find((el) =>
            el.innerText.replace(/\s+/g, '').includes(searchText)
        );
    }

    return target || null;
}
