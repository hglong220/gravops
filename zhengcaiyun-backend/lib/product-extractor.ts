/**
 * 商品核心词提取器
 * 严格遵循用户定义的六大规则，执行确定性过滤
 */

export interface Candidate {
    word: string;
    confidence: number;
}

// 规则一：绝对排除词库
const EXCLUDE_RELATIONS = ['适用', '兼容', '支持', '专用', '对应', '适配'];
const EXCLUDE_ATTRIBUTES = ['原装', '正品', '官方', '旗舰', '同款', '新款', '正版'];
const EXCLUDE_QUANTITY = ['套装', '组合', '支装', '件套', '单支', '整箱', '个装', '盒装', '包邮'];
const EXCLUDE_PERFORMANCE = ['高速', '大容量', '耐用', '节能', '升级版', '高清', '便携', '多功能'];
const EXCLUDE_MODIFIERS = ['办公', '家用', '工业级', '学生', '商用', '通用', '男女', '加厚'];
const EXCLUDE_VERBS = ['打印', '扫描', '安装', '使用', '复印', '传真', '连接'];

// 规则一：单位和规格正则
const SPEC_RE = /[0-9]+(ml|g|kg|mm|cm|寸|w|v|hz|a|寸|米|层|张|抽)/i;
const ALPHANUMERIC_RE = /^[a-z0-9]+$/i;

export function extractCoreCandidates(title: string): Candidate[] {
    // 按照空格、标点符号切词
    const segments = title.split(/[\s,，.。!！?？|｜\(\)（）\-－_+/]/).filter(s => s.trim().length > 0);

    const candidates: Candidate[] = [];

    // 从右向左扫描 (规则三)
    for (let i = segments.length - 1; i >= 0; i--) {
        let word = segments[i].trim();

        // --- 规则一：结构性排除 ---
        if (EXCLUDE_RELATIONS.some(r => word.includes(r))) continue;
        if (EXCLUDE_ATTRIBUTES.some(a => word.includes(a))) continue;
        if (EXCLUDE_QUANTITY.some(q => word.includes(q))) continue;
        if (EXCLUDE_PERFORMANCE.some(p => word.includes(p))) continue;
        if (ALPHANUMERIC_RE.test(word)) continue; // 纯数字、字母或组合 (型号)
        if (SPEC_RE.test(word)) continue; // 含单位规格

        // --- 规则二：词形合法性 ---
        // 词长 2-6 汉字
        if (word.length < 2 || word.length > 6) continue;
        // 不得含数字或字母 (前面已经过滤纯的，这里过滤带的)
        if (/[a-z0-9]/i.test(word)) continue;
        // 不得包含标点 (切分时已经处理)
        // 不得是动词
        if (EXCLUDE_VERBS.some(v => word === v)) continue;

        // --- 规则四：被修饰性与排除修饰语 ---
        if (EXCLUDE_MODIFIERS.some(m => word.includes(m))) continue;

        // 计算权重 (规则三)
        // 越靠近后端权重越高
        let confidence = 0.5 + (i / segments.length) * 0.4;

        // 如果该词被其他词“包围”(不是孤立出现的)，增加权重
        if (i > 0 && i < segments.length - 1) confidence += 0.1;

        candidates.push({ word, confidence: Math.min(0.99, confidence) });
    }

    // 规则五：输出约束
    // 按置信度排序
    candidates.sort((a, b) => b.confidence - a.confidence);

    // 最多输出3个
    return candidates.slice(0, 3);
}
