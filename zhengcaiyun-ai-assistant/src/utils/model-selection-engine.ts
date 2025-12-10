// 1. 基础接口定义

function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}


/**
 * 型号自动选择引擎 - 独立模块
 * 包含：规则匹配、AI裁判、人工兜底逻辑
 */

// 1. 基础接口定义

export interface AutoModelContext {
    // 已选品牌（从政采云页面中读到的文本，如 "得力/deli"）
    zcyBrandText: string;

    // 采集到的原始品牌（可以是 JD/Tmall 原始品牌名）
    brandRaw?: string;

    // 从各平台采集到的型号相关字段（可以有多个）
    modelRawList: string[];

    // 商品标题
    title: string;

    // 关键参数（尺寸/克重/规格等），可选
    attrs?: Array<{ name: string; value: string }>;

    // 型号输入框的 DOM 元素
    modelInputEl: HTMLInputElement;

    // DOM 操作驱动（解耦具体实现）
    dom: DomDriver;

    // AI 匹配接口
    aiMatcher: AiMatcher;

    // 映射表存储
    mappingStore: ModelMappingStore;

    // 日志函数
    log: (msg: string, ...args: any[]) => void;
}

export interface DomDriver {
    // 点击元素
    click(target: string | Element): Promise<void>;

    // 向输入框输入文本（会先清空）
    type(input: HTMLInputElement, text: string): Promise<void>;

    // 等待某个 selector 出现
    waitForSelector(selector: string, timeoutMs?: number): Promise<Element | null>;

    // 在一个父节点下查找所有匹配的元素
    queryAll(selector: string, root?: Element | Document): Element[];
}

export interface AiMatchContext {
    brand: string;
    candidateModelKey: string;
    zcyModelList: string[];
    title: string;
    attrs?: Array<{ name: string; value: string }>;
}

// AI 返回：要选第几个（0-based index），或者 null 表示“不确定”
export type AiMatcher = (ctx: AiMatchContext) => Promise<number | null>;

export interface ModelMappingKey {
    brandNorm: string;
    modelKeyNorm: string;
}

export interface ModelMappingValue {
    zcyModelText: string;
}

export interface ModelMappingStore {
    get(key: ModelMappingKey): Promise<ModelMappingValue | null>;
    set(key: ModelMappingKey, value: ModelMappingValue): Promise<void>;
}

export type AutoModelResult =
    | { status: "OK"; selectedModelText: string }
    | { status: "NEED_MANUAL_MODEL"; reason: string };


// 2. 工具函数实现

/** 通用字符串归一化 */
export function normalize(str: string): string {
    if (!str) return "";
    let s = str.trim();

    // 全角转半角
    s = s.replace(/[\uff01-\uff5e]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
    s = s.replace(/\u3000/g, ' ');

    // 英文转大写
    s = s.toUpperCase();

    // 去掉常见分隔符
    // 保留：字母、数字、汉字、括号
    // 移除：- _ / \ . · , ， 、
    s = s.replace(/[-_/\s\\\.·,，、]/g, '');

    return s;
}

/** 品牌归一化 */
export function normalizeBrand(zcyBrandText: string, brandRaw?: string): {
    brandZh: string;
    brandEn?: string;
    brandNorm: string;
} {
    // 简单处理：根据 / 或空格分割
    // 优先处理 zcyBrandText，因为它已经是平台标准
    const parts = zcyBrandText.split(/[\/\s]+/).filter(Boolean);

    let brandZh = "";
    let brandEn = "";

    for (const p of parts) {
        if (/[\u4e00-\u9fa5]/.test(p)) {
            brandZh = p;
        } else {
            brandEn = p; // 主要是英文
        }
    }

    // 如果没有找到中文，尝试从 brandRaw 找
    if (!brandZh && brandRaw) {
        if (/[\u4e00-\u9fa5]/.test(brandRaw)) {
            brandZh = brandRaw.replace(/[^\u4e00-\u9fa5]/g, ''); // 简单提取中文
        }
    }

    const brandNorm = normalize(brandZh + (brandEn || ""));
    return { brandZh, brandEn, brandNorm };
}

/** 提取候选型号 Key */
export function extractCandidateModelKey(input: {
    modelRawList: string[];
    title: string;
    attrs?: Array<{ name: string; value: string }>;
}): { candidateKey: string | null; allKeys: string[] } {
    const candidates: string[] = [];

    // 1. 优先从 attrs 中找 "型号", "货号", "Model"
    if (input.attrs) {
        for (const attr of input.attrs) {
            if (/型号|货号|Model|Part No/i.test(attr.name)) {
                if (attr.value && attr.value.trim().length > 1 && attr.value.length < 30) {
                    candidates.push(attr.value.trim());
                }
            }
        }
    }

    // 2. 从 modelRawList 中找
    for (const m of input.modelRawList) {
        if (m && m.trim().length > 1) candidates.push(m.trim());
    }

    // 3. 从标题末尾尝试提取 (简单的正则，匹配大写字母+数字)
    // 比如 "得力A4打印纸 70g 500张 7361" -> 7361
    const title = input.title || '';
    // 匹配末尾的 连续字母数字，长度3-15
    const matches = title.match(/([A-Z0-9-]{3,15})\s*$/i);
    if (matches && matches[1]) {
        candidates.push(matches[1]);
    }

    // 去重 & 简单的垃圾过滤
    const validKeys = Array.from(new Set(candidates)).filter(key => {
        // 过滤掉纯中文 (通常不是型号)
        if (/^[\u4e00-\u9fa5]+$/.test(key)) return false;
        // 过滤掉太长的
        if (key.length > 25) return false;
        return true;
    });

    return {
        candidateKey: validKeys[0] || null,
        allKeys: validKeys
    };
}

/** 规则匹配逻辑 */
export function matchModelWithRules(
    candidateKey: string,
    zcyModelList: string[],
    log: (msg: string, ...args: any[]) => void
): number | null {
    if (!candidateKey || !zcyModelList || zcyModelList.length === 0) return null;

    const keyNorm = normalize(candidateKey);

    // 预归一化列表
    const listNorms = zcyModelList.map(normalize);

    // 规则 1：完全匹配
    for (let i = 0; i < listNorms.length; i++) {
        if (listNorms[i] === keyNorm) {
            log(`[规则1] 完全匹配命中: ${zcyModelList[i]}`);
            return i;
        }
    }

    // 规则 2：去除品牌前缀后匹配
    // 假设我们不知道具体的品牌前缀，但如果 candidateKey 包含在 list item 中并且很接近
    for (let i = 0; i < listNorms.length; i++) {
        const item = listNorms[i];
        // 如果 item 包含 keyNorm，且去掉 keyNorm 后剩下的部分很短（可能是品牌简写或其他干扰）
        if (item.endsWith(keyNorm)) {
            // 简单的后缀匹配
            log(`[规则2] 后缀匹配命中: ${zcyModelList[i]}`);
            return i;
        }
    }

    // 规则 3：唯一候选 + 包含关系
    if (zcyModelList.length === 1) {
        const only = listNorms[0];
        if (only.includes(keyNorm) || keyNorm.includes(only)) {
            // 长度差限制
            if (Math.abs(only.length - keyNorm.length) <= 3) {
                log(`[规则3] 唯一候选松散匹配: ${zcyModelList[0]}`);
                return 0;
            }
        }
    }

    return null;
}

/** 获取政采云候选列表 (DOM交互) */
export async function queryZcyModelOptions(
    inputEl: HTMLInputElement,
    candidateKey: string,
    dom: DomDriver,
    log: (msg: string, ...args: any[]) => void
): Promise<string[]> {
    // 1. 点击和输入不用在这里做，调用处控制
    // 但根据 `queryZcyModelOptions` 的描述，它包含了输入动作

    // 确保输入框可见
    // inputEl.scrollIntoView... (Driver handles details?)

    log(`正在搜索型号: ${candidateKey}`);

    // 点击以激活
    await dom.click(inputEl);
    await sleep(300);

    // 输入
    await dom.type(inputEl, candidateKey);
    await sleep(800); // 等待搜索结果

    // 查找列表
    const options = dom.queryAll('.doraemon-select-dropdown-menu-item, li[role="option"]');
    const texts = options.map(el => (el.textContent || '').trim()).filter(Boolean);

    // 检查是否显示"未找到"
    const hasNoResult = texts.some(t => t.includes('抱歉') && t.includes('没有找到'));
    if (hasNoResult) {
        return [];
    }

    return texts;
}

/** 点击指定索引的型号 */
export async function clickZcyModelOptionByIndex(
    index: number,
    dom: DomDriver,
    log: (msg: string, ...args: any[]) => void
): Promise<void> {
    // 重新查询以确保元素新鲜
    const options = dom.queryAll('.doraemon-select-dropdown-menu-item, li[role="option"]');
    if (options[index]) {
        await dom.click(options[index]);
    } else {
        throw new Error(`无法点击索引 ${index} 的型号，列表长度 ${options.length}`);
    }
}


// 3. 主流程 AutoSelectModel 实现

export async function autoSelectModel(
    ctx: AutoModelContext
): Promise<AutoModelResult> {
    const { log, dom, modelInputEl, mappingStore, aiMatcher } = ctx;

    log("[RPA V3] === 型号自动选择开始 ===");

    // 1. 品牌归一化
    const brandInfo = normalizeBrand(ctx.zcyBrandText, ctx.brandRaw);
    const brandNorm = brandInfo.brandNorm;
    log("[RPA V3] 品牌归一化:", JSON.stringify(brandInfo));

    // 2. 提取 candidateModelKey
    const { candidateKey, allKeys } = extractCandidateModelKey({
        modelRawList: ctx.modelRawList,
        title: ctx.title,
        attrs: ctx.attrs,
    });

    if (!candidateKey) {
        log("[RPA V3] 未能从采集数据中提取型号 key，交给人工处理");
        return {
            status: "NEED_MANUAL_MODEL",
            reason: "无法提取型号关键字",
        };
    }

    const candidateKeyNorm = normalize(candidateKey);
    log(`[RPA V3] 型号候选 key: ${candidateKey} (norm: ${candidateKeyNorm}) All: ${allKeys.join(',')}`);

    // 3. 映射表优先
    const mappingKey: ModelMappingKey = {
        brandNorm,
        modelKeyNorm: candidateKeyNorm,
    };

    try {
        const cached = await mappingStore.get(mappingKey);
        if (cached && cached.zcyModelText) {
            log("[RPA V3] 命中型号映射缓存:", cached);

            // 验证缓存有效性：输入该型号，看列表里有没有
            const zcyModelList = await queryZcyModelOptions(
                modelInputEl,
                cached.zcyModelText,
                dom,
                log
            );

            // 精确匹配缓存文本
            const idxInList = zcyModelList.findIndex(
                (txt) => normalize(txt) === normalize(cached.zcyModelText)
            );

            if (idxInList >= 0) {
                await clickZcyModelOptionByIndex(idxInList, dom, log);
                log("[RPA V3] 已根据缓存选择型号:", zcyModelList[idxInList]);
                return { status: "OK", selectedModelText: zcyModelList[idxInList] };
            } else {
                log(
                    "[RPA V3] 警告: 缓存型号在当前候选列表中找不到，将继续后续规则匹配"
                );
            }
        }
    } catch (e) {
        log("[RPA V3] 读取型号映射缓存失败:", e);
    }

    // 4. 去政采云拉候选型号列表 (使用原始提取的 key)
    const zcyModelList = await queryZcyModelOptions(
        modelInputEl,
        candidateKey,
        dom,
        log
    );

    if (zcyModelList.length === 0) {
        log("[RPA V3] 政采云无任何型号候选，交给人工处理");
        return {
            status: "NEED_MANUAL_MODEL",
            reason: "政采云无型号候选",
        };
    }

    log(`[RPA V3] 政采云型号候选列表 (${zcyModelList.length}):`, zcyModelList);

    // 5. 先用本地规则匹配
    const ruleIdx = matchModelWithRules(candidateKey, zcyModelList, log);
    if (ruleIdx !== null && ruleIdx >= 0 && ruleIdx < zcyModelList.length) {
        const selectedText = zcyModelList[ruleIdx];
        log("[RPA V3] 规则匹配命中型号:", selectedText);

        await clickZcyModelOptionByIndex(ruleIdx, dom, log);

        // 写入映射表
        await mappingStore.set(mappingKey, { zcyModelText: selectedText });

        return { status: "OK", selectedModelText: selectedText };
    }

    log("[RPA V3] 规则匹配未找到高置信度型号，准备调用 AI");

    // 6. 规则不行 → AI 裁判
    let aiIndex: number | null = null;
    try {
        aiIndex = await aiMatcher({
            brand: ctx.zcyBrandText,
            candidateModelKey: candidateKey,
            zcyModelList,
            title: ctx.title,
            attrs: ctx.attrs,
        });
    } catch (err) {
        log("[RPA V3] AI 调用异常:", err);
    }

    if (
        aiIndex !== null &&
        aiIndex >= 0 &&
        aiIndex < zcyModelList.length
    ) {
        const selectedText = zcyModelList[aiIndex];
        log("[RPA V3] AI 选择型号:", selectedText);

        await clickZcyModelOptionByIndex(aiIndex, dom, log);
        await mappingStore.set(mappingKey, { zcyModelText: selectedText });

        return { status: "OK", selectedModelText: selectedText };
    }

    log("[RPA V3] AI 也无法确定型号，交给人工处理");

    return {
        status: "NEED_MANUAL_MODEL",
        reason: "规则和 AI 都未能确定型号",
    };
}
