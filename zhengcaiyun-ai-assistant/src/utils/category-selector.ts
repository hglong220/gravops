/**
 * 统一 sleep
 */
export function sleep(ms: number): Promise<void> {
    return new Promise(res => setTimeout(res, ms));
}

/**
 * 等待节点渲染
 */
async function waitFor(selector: string, timeout = 5000): Promise<Element> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(`Wait timeout for ${selector}`), timeout);
        const check = () => {
            const el = document.querySelector(selector);
            if (el) {
                clearTimeout(timer);
                resolve(el);
            } else {
                requestAnimationFrame(check);
            }
        };
        check();
    });
}

/**
 * 点击某一层级的类目（0=一级，1=二级，2=三级）
 */
async function clickCategoryLevel(level: number, name: string): Promise<void> {
    console.log(`[RPA] 点击第 ${level + 1} 级类目: ${name}`);

    // ⭐ 多种选择器兼容不同版本页面
    const listSelectors = [
        '.category-list ul.doraemon-list-items',
        'ul.doraemon-list-items',
        '.category-column',
        '.el-menu',
        '.category-tree ul',
        '[class*="category"] ul'
    ];

    // 尝试不同的列表选择器
    for (const selector of listSelectors) {
        const lists = document.querySelectorAll(selector);
        console.log(`[RPA] 选择器 ${selector}: 找到 ${lists.length} 个列表`);

        if (lists.length > level) {
            const list = lists[level];
            const items = list.querySelectorAll('.category-item, li, [class*="item"]');
            console.log(`[RPA] 第 ${level + 1} 级列表有 ${items.length} 个项`);

            // 打印前5个项便于调试
            const preview = Array.from(items).slice(0, 5).map(i =>
                (i as HTMLElement).innerText?.trim().substring(0, 20)
            );
            console.log(`[RPA] 前5项: ${preview.join(', ')}`);

            for (const item of items) {
                const text = (item as HTMLElement).innerText?.trim() || '';

                // ⭐ 多种匹配方式
                const exactMatch = text === name;
                const containsMatch = text.includes(name) || name.includes(text);
                const startMatch = text.startsWith(name.substring(0, 2));

                if (exactMatch || containsMatch) {
                    console.log(`[RPA] ✓ 匹配成功: "${text}" (${exactMatch ? '精确' : '模糊'})`);
                    (item as HTMLElement).scrollIntoView({ block: 'center' });
                    await sleep(200);
                    (item as HTMLElement).click();
                    await sleep(1000); // 等待下一级渲染
                    return;
                }
            }
        }
    }

    // ⭐ 备用方案：在整个页面中搜索
    console.log('[RPA] 在整个页面中搜索类目...');
    const allItems = document.querySelectorAll('.category-item, [class*="category-item"]');
    console.log(`[RPA] 页面上共有 ${allItems.length} 个类目项`);

    for (const item of allItems) {
        const text = (item as HTMLElement).innerText?.trim() || '';
        if (text.includes(name) || name.includes(text)) {
            console.log(`[RPA] ✓ 全局匹配: "${text}"`);
            (item as HTMLElement).scrollIntoView({ block: 'center' });
            await sleep(200);
            (item as HTMLElement).click();
            await sleep(1000);
            return;
        }
    }

    throw new Error(`未找到类目: ${name} (第 ${level + 1} 级)`);
}

/**
 * 点击最终叶子节点（三级类目）
 */
async function clickCategoryLeaf(name: string): Promise<void> {
    console.log(`[RPA] 点击叶子类目: ${name}`);

    const leafItems = document.querySelectorAll('.is-item-leaf .category-item');

    for (const item of leafItems) {
        if ((item as HTMLElement).innerText.trim() === name) {
            (item as HTMLElement).click();
            console.log(`[RPA] 叶子类目点击成功: ${name}`);
            return;
        }
    }

    // 备用：在所有 category-item 里找
    const allItems = document.querySelectorAll('.category-item');
    for (const item of allItems) {
        if ((item as HTMLElement).innerText.trim() === name) {
            (item as HTMLElement).click();
            console.log(`[RPA] 叶子类目点击成功 (备用): ${name}`);
            return;
        }
    }

    throw new Error(`未找到叶子类目: ${name}`);
}

/**
 * ⭐ 全流程：逐级展开类目
 * 
 * 例如：selectCategoryPath(["办公设备", "办公用纸", "打印复印纸"])
 */
export async function selectCategoryPath(pathArray: string[]): Promise<void> {
    console.log(`[RPA] 开始逐级选择类目: ${pathArray.join(' / ')}`);

    // 遍历每一层级
    for (let i = 0; i < pathArray.length; i++) {
        const name = pathArray[i];

        if (i < pathArray.length - 1) {
            // 中间层（一级/二级）
            await clickCategoryLevel(i, name);
        } else {
            // 最后一级 = 叶子节点
            await clickCategoryLeaf(name);
        }
    }

    console.log('[RPA] 类目选择完成');
}

/**
 * 单个类目选择（兼容旧接口）
 */
export async function selectCategory(name: string): Promise<void> {
    console.log("[RPA] SELECT_CATEGORY - 尝试选择类目:", name);

    if (!name) {
        throw new Error("selectCategory 缺少 value");
    }

    // 统一选择器
    const selectors = [
        "ul.doraemon-list-items li .category-item",
        ".category-item",
        ".is-item-leaf .category-item",
        "span.category-item"
    ];

    // 第一次尝试：直接在可见DOM中查找
    const maxWait = 30;
    for (let i = 0; i < maxWait; i++) {
        for (const selector of selectors) {
            const items = Array.from(document.querySelectorAll(selector)) as HTMLElement[];

            // 精确匹配
            let target = items.find(el => el.innerText.trim() === name);

            // 模糊匹配
            if (!target) {
                target = items.find(el => el.innerText.trim().includes(name) || name.includes(el.innerText.trim()));
            }

            if (target) {
                target.scrollIntoView({ block: "center" });
                await sleep(200);
                target.click();
                console.log("[RPA] 成功点击类目:", name);
                await sleep(800);
                return;
            }
        }
        await sleep(100);
    }

    // ⭐ 第二次尝试：从类目树获取完整路径，逐级展开
    console.log("[RPA] 直接查找失败，尝试从类目树获取完整路径...");

    try {
        // 动态导入，避免循环依赖
        const { getCategoryPathByName } = await import('./auto-publish-rpa');
        const fullPath = await getCategoryPathByName(name);

        if (fullPath && fullPath.length > 0) {
            console.log("[RPA] 从类目树获取路径:", fullPath.join(' > '));
            // 使用完整路径逐级展开
            await selectCategoryPath(fullPath);
            return;
        }
    } catch (e) {
        console.log("[RPA] 从类目树获取路径失败:", e);
    }

    throw new Error("未找到类目: " + name);
}

/**
 * 兼容旧接口：selectCategoryLevel
 */
export async function selectCategoryLevel(level: 1 | 2 | 3, name: string): Promise<void> {
    console.log(`[RPA] selectCategoryLevel L${level}: ${name}`);
    await clickCategoryLevel(level - 1, name); // level 从 1 开始，转成从 0 开始
}
