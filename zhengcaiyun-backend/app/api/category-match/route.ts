/**
 * AI类目匹配服务 API
 * 根据商品标题匹配最合适的政采云类目
 * 
 * ⭐ 增强：集成真正的AI（DeepSeek/GPT）进行智能匹配
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';
import { matchCategoryWithAI, findBidByLevel1Category } from '@/lib/ai-category-match';

// 类目树类型定义
interface Category {
    id: number;
    name: string;
    categoryCode?: string;
    level: number;
    parentId?: number | null;
    children?: Category[];
    hasChildren?: boolean;
    hasSpu?: boolean;
    authed?: boolean;
}

interface CategoryTree {
    meta: {
        name: string;
        totalCategories: number;
        level1Count: number;
    };
    categories: Category[];
}

// 缓存类目数据
let categoryTreeCache: CategoryTree | null = null;

// 加载类目树
function loadCategoryTree(): CategoryTree {
    if (categoryTreeCache) {
        return categoryTreeCache;
    }

    const filePath = path.join(process.cwd(), 'public', 'api', '政采云完整类目.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    categoryTreeCache = JSON.parse(data);
    console.log(`[类目匹配] 加载类目树: ${categoryTreeCache!.meta.totalCategories}个类目`);
    return categoryTreeCache!;
}

// 根据一级类目名称过滤类目树（使用模糊匹配）
// 标项名如"办公设备"需要匹配官方类目名"办公设备/耗材"
function filterCategoryTree(tree: CategoryTree, allowedLevel1Names: string[]): Category[] {
    return tree.categories.filter(cat => {
        const catName = cat.name.toLowerCase();
        return allowedLevel1Names.some(allowed => {
            const allowedName = allowed.toLowerCase();
            // 模糊匹配：办公设备 ↔ 办公设备/耗材
            return catName === allowedName ||
                catName.includes(allowedName) ||
                allowedName.includes(catName) ||
                catName.split('/')[0] === allowedName.split('/')[0];
        });
    });
}

// 扁平化类目树用于AI
function flattenCategories(categories: Category[], maxDepth: number = 4): string[] {
    const result: string[] = [];

    function traverse(cats: Category[], path: string[] = [], depth: number = 1) {
        for (const cat of cats) {
            const currentPath = [...path, cat.name];

            // 如果是叶子节点或达到最大深度，添加完整路径
            if (!cat.children || cat.children.length === 0 || depth >= maxDepth) {
                result.push(currentPath.join(' > '));
            }

            // 递归处理子类目
            if (cat.children && cat.children.length > 0 && depth < maxDepth) {
                traverse(cat.children, currentPath, depth + 1);
            }
        }
    }

    traverse(categories);
    return result;
}

// 构建给AI的类目列表（简化版，避免token过多）
function buildCategoryListForAI(categories: Category[]): string {
    const lines: string[] = [];

    function traverse(cats: Category[], prefix: string = '', depth: number = 1) {
        for (const cat of cats) {
            const indent = '  '.repeat(depth - 1);
            lines.push(`${indent}${prefix}${cat.name}`);

            if (cat.children && cat.children.length > 0 && depth < 4) {
                traverse(cat.children, '', depth + 1);
            }
        }
    }

    traverse(categories);
    return lines.join('\n');
}

// 预检：快速判断商品是否可能属于某个一级类目
// 基于官方类目文件中的子类目名称进行匹配
// 深度类目关键词映射（一级、二级和三级类目）
// 放在前面以便 preCheck 使用
const deepCategoryKeywords: Record<string, Record<string, string[]>> = {
    "办公设备": {
        "办公设备": ["碎纸机", "扫描仪", "复印机", "保险箱", "保险柜", "切纸机", "一体机", "高拍仪", "复合机"],
        "办公用纸": ["打印纸", "复印纸", "传真纸", "收银纸", "相片纸", "标签纸", "卡纸", "热敏纸"],
        "打印机及配件": ["打印机", "激光打印", "喷墨打印", "针式打印", "热敏打印", "3d打印", "墨仓式"],
        "办公耗材": ["硒鼓", "墨盒", "墨粉", "碳粉", "色带", "打印耗材", "感光鼓"],
        "投影显示设备": ["投影仪", "投影机", "幕布", "投影幕"],
        "装订/塑封设备": ["装订机", "塑封机", "裁纸刀", "打孔机", "封装机"],
        "考勤/门禁设备": ["考勤机", "门禁", "打卡机", "指纹机", "人脸识别"],
        "会议系统": ["视频会议", "音响", "麦克风", "会议电话"],
        "点验钞/捆扎设备": ["点钞机", "验钞机", "捆钞机"],
        "清洁设备": ["吸尘器", "洗地机", "扫地机", "清洗机"]
    },
    "文化用品": { // 对应政采云的"办公用品"
        "书写工具": ["钢笔", "中性笔", "圆珠笔", "签字笔", "记号笔", "白板笔", "铅笔", "荧光笔", "毛笔"],
        "笔本簿册": ["笔记本", "作业本", "记事本", "账本", "便签", "便利贴"],
        "美术绘图": ["颜料", "画笔", "画布", "素描", "水彩", "油画", "画板"],
        "办公收纳": ["文件夹", "档案盒", "资料册", "文件架", "收纳盒"],
        "桌面办公": ["订书机", "计算器", "剪刀", "胶带", "胶水", "回形针", "图钉"],
        "证书/奖状": ["证书", "奖状", "奖牌", "锦旗", "荣誉"]
    },
    "3C数码": {
        "笔记本电脑": ["笔记本", "laptop", "游戏本", "轻薄本", "商务本", "联想", "戴尔", "惠普", "thinkpad", "macbook"],
        "台式电脑": ["台式机", "台式电脑", "主机", "一体机电脑", "工作站"],
        "平板电脑": ["平板", "ipad", "华为平板", "小米平板"],
        "手机通讯": ["手机", "华为", "iphone", "vivo", "oppo", "小米", "荣耀"],
        "显示器": ["显示器", "显示屏", "曲面屏", "电竞屏"],
        "存储设备": ["硬盘", "u盘", "移动硬盘", "内存卡", "固态硬盘", "ssd", "存储卡"],
        "外设产品": ["键盘", "鼠标", "音箱", "耳机", "摄像头", "手写板"],
        "数码相机": ["相机", "摄像机", "单反", "微单", "镜头"],
        "智能穿戴": ["手表", "手环", "智能手表", "运动手环"]
    },
    // 将日用百货展开
    "日用百货": {
        "纸巾/湿巾": ["纸巾", "抽纸", "卷纸", "湿巾", "面巾纸", "厕所纸"],
        "清洁用品": ["拖把", "扫帚", "抹布", "刷子", "垃圾袋", "清洁剂", "洗洁精"],
        "垃圾桶/垃圾袋": ["垃圾桶", "垃圾袋", "分类垃圾"],
        "个人护理": ["洗发水", "沐浴露", "香皂", "洗手液", "牙膏", "牙刷", "毛巾"],
        "收纳用品": ["收纳箱", "收纳盒", "储物箱", "整理箱"]
    },
    // 家用电器
    "家用电器": {
        "冰箱/冷柜": ["冰箱", "冷柜", "冰柜", "保鲜柜"],
        "空调": ["空调", "挂机", "柜机", "中央空调", "移动空调"],
        "洗衣机": ["洗衣机", "烘干机", "洗烘一体"],
        "厨房电器": ["微波炉", "电饭煲", "电磁炉", "电烤箱", "豆浆机", "榨汁机", "电水壶"],
        "净水器": ["净水器", "饮水机", "净水机", "直饮机"],
        "电风扇": ["电风扇", "风扇", "塔扇", "空气循环扇"],
        "取暖器": ["取暖器", "电暖器", "暖风机", "电热毯", "电油汀"]
    },
    // 计算机设备及软件
    "计算机设备及软件": {
        "服务器": ["服务器", "机架式服务器", "塔式服务器", "刀片服务器"],
        "网络设备": ["路由器", "交换机", "防火墙", "网关", "无线ap", "网桥"],
        "存储设备": ["存储器", "磁盘阵列", "nas", "san", "备份"],
        "ups电源": ["ups", "不间断电源", "稳压器"],
        "机房设备": ["机柜", "配电", "精密空调", "监控"]
    },
    // 五金/工具
    "五金/工具": {
        "电动工具": ["电钻", "电锯", "角磨机", "电动螺丝刀", "切割机", "电动扳手"],
        "手动工具": ["扳手", "螺丝刀", "钳子", "锤子", "卷尺", "扳手套装"],
        "测量工具": ["卷尺", "水平仪", "激光测距", "千分尺", "万用表"],
        "五金配件": ["螺丝", "螺母", "垫片", "膨胀螺丝", "铰链"]
    },
    // 劳动保护用品
    "劳动保护用品": {
        "头部防护": ["安全帽", "防护帽", "头盔"],
        "眼部防护": ["防护眼镜", "护目镜", "面罩"],
        "呼吸防护": ["口罩", "防尘口罩", "防毒面具", "呼吸器"],
        "手部防护": ["防护手套", "劳保手套", "绝缘手套", "耐酸碱手套"],
        "足部防护": ["安全鞋", "劳保鞋", "防砸鞋", "绝缘鞋"],
        "身体防护": ["工作服", "防护服", "反光背心", "防静电服"]
    }
};

// 预检：快速判断商品是否可能属于某个一级类目
// 基于官方类目文件中的子类目名称进行匹配
function preCheck(productTitle: string, allowedCategories: string[]): {
    isLikelyMatch: boolean;
    suggestedCategory?: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
} {
    const title = productTitle.toLowerCase();
    const tree = loadCategoryTree();

    // 别名映射：用户看到的类目名 -> 官方类目名
    const categoryAliases: Record<string, string[]> = {
        '办公用品': ['文化用品', '办公设备'],   // 办公用品可能对应文化用品或办公设备
        '计算机设备': ['计算机设备及软件'],
        '电器': ['家用电器'],
        '灯具商品': ['家居建材', '家用电器'],   // 灯具可能归类在这两个下
        '五金工具': ['五金/工具']
    };

    // 扩展 allowedCategories，加入别名
    const expandedAllowedCategories = new Set<string>();
    for (const cat of allowedCategories) {
        expandedAllowedCategories.add(cat);
        // 查找是否有别名
        if (categoryAliases[cat]) {
            categoryAliases[cat].forEach(alias => expandedAllowedCategories.add(alias));
        }
        // 尝试反向查找（如果用户存的是官方名）
        for (const [key, value] of Object.entries(categoryAliases)) {
            if (value.includes(cat)) {
                expandedAllowedCategories.add(key);
            }
        }
    }

    // 遍历所有可能的类目名
    for (const level1Name of Array.from(expandedAllowedCategories)) {
        // 1. 尝试使用深度关键词表匹配
        if (deepCategoryKeywords[level1Name]) {
            const keywordsMap = deepCategoryKeywords[level1Name];
            for (const [subCat, keywords] of Object.entries(keywordsMap)) {
                // 检查子类目名
                if (title.includes(subCat.toLowerCase())) {
                    return {
                        isLikelyMatch: true,
                        suggestedCategory: level1Name,
                        confidence: 'high',
                        reason: `商品标题包含"${subCat}"，属于类目"${level1Name}"`
                    };
                }
                // 检查关键词
                for (const kw of keywords) {
                    if (title.includes(kw.toLowerCase())) {
                        return {
                            isLikelyMatch: true,
                            suggestedCategory: level1Name,
                            confidence: 'high',
                            reason: `商品标题包含关键词"${kw}"，属于类目"${level1Name}"`
                        };
                    }
                }
            }
        }

        // 2. 从官方类目树中找到对应的一级类目
        const level1Cat = tree.categories.find(c => c.name === level1Name);

        if (level1Cat) {
            // 检查一级类目名称是否在标题中
            if (title.includes(level1Name.toLowerCase())) {
                return {
                    isLikelyMatch: true,
                    suggestedCategory: level1Name,
                    confidence: 'high',
                    reason: `商品标题包含类目名称"${level1Name}"`
                };
            }

            // 遍历二级类目
            if (level1Cat.children) {
                for (const level2Cat of level1Cat.children) {
                    if (title.includes(level2Cat.name.toLowerCase())) {
                        return {
                            isLikelyMatch: true,
                            suggestedCategory: level1Name,
                            confidence: 'high',
                            reason: `商品标题包含"${level2Cat.name}"，属于类目"${level1Name}"`
                        };
                    }

                    // 遍历三级类目
                    if (level2Cat.children) {
                        for (const level3Cat of level2Cat.children) {
                            if (title.includes(level3Cat.name.toLowerCase())) {
                                return {
                                    isLikelyMatch: true,
                                    suggestedCategory: level1Name,
                                    confidence: 'high',
                                    reason: `商品标题包含"${level3Cat.name}"，属于类目"${level1Name}"`
                                };
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. 模糊匹配：检查类目名称的部分是否出现在标题中
    for (const categoryName of Array.from(expandedAllowedCategories)) {
        const parts = categoryName.split(/[\/\s]/);
        for (const part of parts) {
            if (part.length >= 2 && title.includes(part.toLowerCase())) {
                return {
                    isLikelyMatch: true,
                    suggestedCategory: categoryName,
                    confidence: 'medium',
                    reason: `商品标题可能属于类目"${categoryName}"`
                };
            }
        }
    }

    // 默认通过预检，但置信度为Low，交给后续 AI 处理
    // 这样就不会因为预检规则不全而误杀
    return {
        isLikelyMatch: true,
        suggestedCategory: allowedCategories[0], // 默认建议第一个，后续会重新搜索
        confidence: 'low',
        reason: '预检未找到明显匹配特征，尝试进行深度匹配'
    };
}

// 匹配结果接口
interface MatchResult {
    categoryPath: string[];
    categoryIds: number[];
    matchedKeywords: string[];
    depth: number;
    confidence: 'high' | 'medium' | 'low';
    leafCategory?: Category;
}

// 深度类目匹配：在类目树中搜索最匹配的完整路径
function findBestCategoryPath(
    productTitle: string,
    categories: Category[],
    suggestedLevel1: string
): MatchResult {
    const title = productTitle.toLowerCase();
    const matchedKeywords: string[] = [];

    // 找到建议的一级类目（使用模糊匹配：标项名 vs 官方类目名）
    // 例如：suggestedLevel1 = "办公设备"，需要匹配 c.name = "办公设备/耗材"
    let level1Category = categories.find(c => c.name === suggestedLevel1);

    // 如果严格匹配失败，尝试模糊匹配
    if (!level1Category) {
        level1Category = categories.find(c => {
            const catName = c.name.toLowerCase();
            const suggestedName = suggestedLevel1.toLowerCase();
            // 模糊匹配：办公设备 ↔ 办公设备/耗材
            return catName.includes(suggestedName) ||
                suggestedName.includes(catName) ||
                catName.split('/')[0] === suggestedName.split('/')[0];
        });

        if (level1Category) {
            console.log(`[类目匹配] 模糊匹配成功: "${suggestedLevel1}" → "${level1Category.name}"`);
        }
    }

    if (!level1Category) {
        console.log(`[类目匹配] ⚠️ 无法找到一级类目: "${suggestedLevel1}", 可用类目: ${categories.map(c => c.name).join(', ')}`);
        return {
            categoryPath: [suggestedLevel1],
            categoryIds: [],
            matchedKeywords: [],
            depth: 1,
            confidence: 'low'
        };
    }

    // 用于存储最佳匹配结果
    let bestMatch: MatchResult = {
        categoryPath: [level1Category.name],
        categoryIds: [level1Category.id],
        matchedKeywords: [],
        depth: 1,
        confidence: 'medium'
    };

    // 获取该一级类目的深度关键词
    const level1Keywords = deepCategoryKeywords[suggestedLevel1] || {};

    // 递归搜索最深匹配
    function searchDeep(
        category: Category,
        currentPath: string[],
        currentIds: number[],
        depth: number
    ) {
        const children = category.children || [];

        for (const child of children) {
            const childPath = [...currentPath, child.name];
            const childIds = [...currentIds, child.id];
            const childName = child.name.toLowerCase();

            // 检查是否匹配
            let isMatch = false;
            let matchScore = 0;
            const keywords: string[] = [];

            // 1. 检查类目名称是否在标题中
            if (title.includes(childName)) {
                isMatch = true;
                matchScore += 10;
                keywords.push(child.name);
            }

            // 2. 检查类目名称的关键部分
            const nameParts = child.name.split(/[\s\/]+/);
            for (const part of nameParts) {
                if (part.length >= 2 && title.includes(part.toLowerCase())) {
                    isMatch = true;
                    matchScore += 5;
                    if (!keywords.includes(part)) keywords.push(part);
                }
            }

            // 3. 检查深度关键词映射
            for (const [catName, catKeywords] of Object.entries(level1Keywords)) {
                if (child.name.includes(catName) || catName.includes(child.name)) {
                    for (const kw of catKeywords) {
                        if (title.includes(kw.toLowerCase())) {
                            isMatch = true;
                            matchScore += 8;
                            if (!keywords.includes(kw)) keywords.push(kw);
                        }
                    }
                }
            }

            // 4. 品牌匹配（常见办公设备品牌）
            const brands = ['hp', '惠普', '佳能', 'canon', '爱普生', 'epson', '兄弟', 'brother',
                '联想', 'lenovo', '戴尔', 'dell', '华为', 'huawei', '小米', 'xiaomi',
                '得力', '齐心', '晨光', '三木', '史泰博', '理光', 'ricoh', '柯尼卡', 'konica',
                '富士施乐', 'xerox', '京瓷', 'kyocera', '夏普', 'sharp', '东芝', 'toshiba'];
            for (const brand of brands) {
                if (title.includes(brand.toLowerCase()) && childName.includes(brand.toLowerCase())) {
                    matchScore += 3;
                }
            }

            if (isMatch && depth + 1 > bestMatch.depth) {
                bestMatch = {
                    categoryPath: childPath,
                    categoryIds: childIds,
                    matchedKeywords: keywords,
                    depth: depth + 1,
                    confidence: matchScore >= 10 ? 'high' : matchScore >= 5 ? 'medium' : 'low',
                    leafCategory: child
                };
            }

            // 如果该类目有子类目，继续搜索
            if (child.children && child.children.length > 0 && isMatch) {
                searchDeep(child, childPath, childIds, depth + 1);
            }
        }
    }

    // 从一级类目开始搜索
    if (level1Category.children && level1Category.children.length > 0) {
        searchDeep(level1Category, [level1Category.name], [level1Category.id], 1);
    }

    // 收集所有匹配的关键词
    if (bestMatch.matchedKeywords.length === 0) {
        // 如果没有找到更深的匹配，尝试基于预检关键词
        const preCheckKeywords = deepCategoryKeywords[suggestedLevel1];
        if (preCheckKeywords) {
            for (const [, keywords] of Object.entries(preCheckKeywords)) {
                for (const kw of keywords) {
                    if (title.includes(kw.toLowerCase())) {
                        matchedKeywords.push(kw);
                    }
                }
            }
        }
        bestMatch.matchedKeywords = matchedKeywords.slice(0, 5); // 最多5个
    }

    return bestMatch;
}

// POST: AI类目匹配
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, productTitle, mode = 'full', bid } = body;  // ⭐ 新增 bid 参数

        if (!licenseKey || !productTitle) {
            return NextResponse.json({
                error: '缺少必要参数: licenseKey, productTitle'
            }, { status: 400 });
        }

        // 验证License并获取权限
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license) {
            return NextResponse.json({ error: 'License无效' }, { status: 401 });
        }

        // 获取用户的类目权限（使用 licenseKey 查询，聚合所有 level1Category）
        const permissions = await prisma.userCategoryPermission.findMany({
            where: { licenseKey: licenseKey },
            orderBy: { updatedAt: 'desc' }
        });

        if (!permissions || permissions.length === 0) {
            return NextResponse.json({
                error: '未找到类目权限，请先在政采云平台提取您的一级类目权限',
                code: 'NO_PERMISSION'
            }, { status: 400 });
        }

        const allowedCategories = permissions.map(p => p.level1Category);

        // 第一步：预检
        const preCheckResult = preCheck(productTitle, allowedCategories);

        if (!preCheckResult.isLikelyMatch) {
            return NextResponse.json({
                success: false,
                rejected: true,
                reason: preCheckResult.reason,
                allowedCategories,
                suggestion: '该商品不在您的类目权限范围内，请检查商品是否正确或联系管理员扩展权限'
            });
        }

        // 如果只是预检模式，返回预检结果
        if (mode === 'precheck') {
            return NextResponse.json({
                success: true,
                precheck: preCheckResult,
                message: '预检通过，可以进行详细类目匹配'
            });
        }

        // 第二步：加载类目树并过滤
        const categoryTree = loadCategoryTree();
        const filteredCategories = filterCategoryTree(categoryTree, allowedCategories);

        // 计算过滤后的类目数量
        let filteredCount = 0;
        function countCategories(cats: Category[]) {
            for (const cat of cats) {
                filteredCount++;
                if (cat.children) countCategories(cat.children);
            }
        }
        countCategories(filteredCategories);

        console.log(`[类目匹配] 商品: "${productTitle}", 过滤后类目数: ${filteredCount}`);

        // 第三步：深度类目匹配（关键词匹配）
        let matchResult = findBestCategoryPath(
            productTitle,
            filteredCategories,
            preCheckResult.suggestedCategory!
        );

        console.log(`[类目匹配] 关键词匹配结果: 深度${matchResult.depth}, 路径: ${matchResult.categoryPath.join(' > ')}`)

        // ⭐ 第四步：如果关键词匹配效果不好，使用真正的AI匹配
        let usedAI = false;
        let aiBid: string | undefined;  // ⭐ 保存标项

        if (matchResult.confidence === 'low' || matchResult.depth < 3) {
            console.log(`[类目匹配] 关键词匹配置信度低，调用AI增强...`);

            try {
                // ⭐ 传入 bid 参数，限制 AI 只从当前标项的类目中匹配
                console.log(`[类目匹配] 调用AI匹配, bid: ${bid || '未指定'}`);
                const aiResult = await matchCategoryWithAI(productTitle, allowedCategories, bid);

                if (aiResult.confidence !== 'low' && aiResult.path.length >= 2) {
                    console.log(`[类目匹配] AI匹配结果: ${aiResult.path.join(' > ')} (${aiResult.confidence})`);
                    if (aiResult.bid) {
                        console.log(`[类目匹配] AI确定标项: ${aiResult.bid}`);
                        aiBid = aiResult.bid;
                    }

                    // 使用AI的结果
                    matchResult = {
                        categoryPath: aiResult.path,
                        categoryIds: [], // AI不返回ID，后续可以根据路径查找
                        matchedKeywords: [],
                        depth: aiResult.path.length,
                        confidence: aiResult.confidence
                    };
                    usedAI = true;
                }
            } catch (aiError) {
                console.error('[类目匹配] AI匹配失败，使用关键词结果:', aiError);
            }
        }

        // ★★★ 保留完整的类目路径（不再清理一级类目名称）★★★
        // 之前的逻辑会把 "办公设备/耗材" 错误地改成 "办公设备"，这是错误的！
        // 因为页面上显示的一级类目就是 "办公设备/耗材"，不能截断
        const cleanedCategoryPath = [...matchResult.categoryPath]
        // 不再清理：cleanedCategoryPath[0] = cleanedCategoryPath[0].split('/')[0]

        console.log(`[类目匹配] 最终路径: ${cleanedCategoryPath.join(' > ')}${usedAI ? ' (AI增强)' : ''}`)

        // ★★★ 确定正确的标项 ★★★
        // 优先级：1. 前端传入的 bid  2. AI 返回的 bid  3. 根据匹配路径反查
        let finalBid = bid  // 前端指定的 bid 优先
        if (!finalBid && cleanedCategoryPath.length > 0) {
            // 根据一级类目反查标项
            finalBid = aiBid || findBidByLevel1Category(cleanedCategoryPath[0]) || preCheckResult.suggestedCategory
        }
        console.log(`[类目匹配] 最终标项: ${finalBid}`)

        // ★★★ 提取品牌和型号 ★★★
        const extractedBrand = extractBrand(productTitle)
        const extractedModel = extractModel(productTitle)

        console.log(`[类目匹配] 提取品牌: ${extractedBrand || '未识别'}, 型号: ${extractedModel || '未识别'}`)

        return NextResponse.json({
            success: true,
            data: {
                productTitle,
                categoryPath: cleanedCategoryPath,  // 使用清理后的路径
                categoryIds: matchResult.categoryIds,
                suggestedLevel1: preCheckResult.suggestedCategory,
                confidence: matchResult.confidence,
                // ★ 标项（基于匹配结果确定）
                bid: finalBid,
                // ★ 品牌和型号
                brand: extractedBrand,
                model: extractedModel,
                // ★ 是否使用了AI
                usedAI,
                matchDetails: {
                    matchedKeywords: matchResult.matchedKeywords,
                    depth: matchResult.depth,
                    precheck: preCheckResult
                },
                message: usedAI
                    ? `AI智能匹配: ${cleanedCategoryPath.join(' > ')}`
                    : matchResult.depth > 1
                        ? `成功匹配到${matchResult.depth}级类目: ${cleanedCategoryPath.join(' > ')}`
                        : '预检通过，仅匹配到一级类目'
            },
            meta: {
                allowedLevel1Count: allowedCategories.length,
                filteredTotalCount: filteredCount
            }
        });

    } catch (error) {
        console.error('AI类目匹配失败:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}

// ========== 品牌提取 ==========

// 常见品牌列表
const knownBrands = [
    '得力', 'Deli', '晨光', 'M&G', '齐心', 'Comix',
    '惠普', 'HP', '佳能', 'Canon', '爱普生', 'EPSON',
    '联想', 'Lenovo', '戴尔', 'Dell', '华为', 'Huawei',
    '小米', 'MI', '格力', 'GREE', '美的', 'Midea',
    '飞利浦', 'PHILIPS', '松下', 'Panasonic',
    '金士顿', 'Kingston', '西部数据', 'WD', '希捷', 'Seagate',
    '三星', 'Samsung', 'LG', 'TCL', '海尔', 'Haier',
    '罗技', 'Logitech', '雷蛇', 'Razer', '微软', 'Microsoft',
    '苹果', 'Apple', 'ASUS', '华硕', 'Acer', '宏碁',
    '兄弟', 'Brother', 'OKI', '京瓷', 'KYOCERA',
    '理光', 'RICOH', '柯尼卡美能达', 'KONICA',
    '震旦', 'AURORA', '史泰博', 'Staples',
    '倍思', 'Baseus', '绿联', 'UGREEN', '公牛', 'BULL',
    '欧普', 'OPPLE', '雷士', 'NVC', '飞雕', 'FEIDIAO'
];

function extractBrand(title: string): string | null {
    // 优先匹配已知品牌
    for (const brand of knownBrands) {
        if (title.toLowerCase().includes(brand.toLowerCase())) {
            return brand;
        }
    }

    // 尝试从标题开头提取（通常品牌在最前面）
    const match = title.match(/^([a-zA-Z\u4e00-\u9fa5]{2,10})/);
    if (match) {
        const candidate = match[1];
        // 排除常见非品牌词
        const excludeWords = ['正品', '包邮', '新款', '热销', '特价', '官方', '原装'];
        if (!excludeWords.some(w => candidate.includes(w))) {
            return candidate;
        }
    }

    return null;
}

// ========== 型号提取 ==========

function extractModel(title: string): string | null {
    // 匹配常见型号格式（按优先级排序，长型号优先）
    const patterns = [
        // ⭐ 纯数字+字母型号（如 33302S, 7361, 33725）
        /(\d{4,6}[A-Z]{0,2})/gi,

        // 字母+数字型号（如 HP123, M2000A）
        /([A-Z]{1,4}\d{3,6}[A-Z]?)/gi,

        // 字母-数字型号（如 HP-1234）
        /([A-Z]{2,5}-\d{2,5})/gi,

        // 短型号（如 70G, 80G）
        /(\d{2,4}[gG克])/gi,

        // A3/A4 纸张规格
        /(A[34])/gi,
    ];

    // 收集所有匹配的型号
    const candidates: string[] = [];

    for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(title)) !== null) {
            const model = match[1];
            // 排除一些常见的非型号数字
            if (model.length >= 2 && !['2025', '2024', '2023'].includes(model)) {
                candidates.push(model);
            }
        }
    }

    // 按长度排序，优先返回最长的型号
    if (candidates.length > 0) {
        candidates.sort((a, b) => b.length - a.length);
        console.log(`[型号提取] 候选型号: ${candidates.join(', ')}，选择: ${candidates[0]}`);
        return candidates[0];
    }

    return null;
}

// GET: 获取类目树信息
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const level1Name = searchParams.get('level1');

        const categoryTree = loadCategoryTree();

        if (level1Name) {
            // 返回特定一级类目的子树
            const level1Category = categoryTree.categories.find(c => c.name === level1Name);
            if (!level1Category) {
                return NextResponse.json({ error: `未找到一级类目: ${level1Name}` }, { status: 404 });
            }

            let count = 0;
            function countChildren(cat: Category) {
                count++;
                if (cat.children) cat.children.forEach(countChildren);
            }
            countChildren(level1Category);

            return NextResponse.json({
                success: true,
                data: {
                    name: level1Category.name,
                    id: level1Category.id,
                    totalCategories: count,
                    children: level1Category.children
                }
            });
        }

        // 返回所有一级类目
        return NextResponse.json({
            success: true,
            data: {
                meta: categoryTree.meta,
                level1Categories: categoryTree.categories.map(c => ({
                    id: c.id,
                    name: c.name,
                    childrenCount: c.children?.length || 0
                }))
            }
        });

    } catch (error) {
        console.error('获取类目树失败:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}
