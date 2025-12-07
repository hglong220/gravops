/**
 * AI类目匹配服务 API
 * 根据商品标题匹配最合适的政采云类目
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

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

// 根据一级类目名称过滤类目树
function filterCategoryTree(tree: CategoryTree, allowedLevel1Names: string[]): Category[] {
    const allowedSet = new Set(allowedLevel1Names);
    return tree.categories.filter(cat => allowedSet.has(cat.name));
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
function preCheck(productTitle: string, allowedCategories: string[]): {
    isLikelyMatch: boolean;
    suggestedCategory?: string;
    confidence: 'high' | 'medium' | 'low';
    reason: string;
} {
    const title = productTitle.toLowerCase();
    const tree = loadCategoryTree();

    // 遍历用户允许的一级类目
    for (const level1Name of allowedCategories) {
        // 从官方类目树中找到对应的一级类目
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

    // 模糊匹配：检查类目名称的部分是否出现在标题中
    for (const categoryName of allowedCategories) {
        // 分割类目名称（如"办公设备/耗材"拆分为["办公设备", "耗材"]）
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

    return {
        isLikelyMatch: false,
        confidence: 'low',
        reason: `商品标题与用户的${allowedCategories.length}个一级类目（${allowedCategories.join('、')}）均不明显相关`
    };
}

// 深度类目关键词映射（二级和三级类目）
const deepCategoryKeywords: Record<string, Record<string, string[]>> = {
    "办公设备/耗材": {
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
    "文化用品": {
        "书写工具": ["钢笔", "中性笔", "圆珠笔", "签字笔", "记号笔", "白板笔", "铅笔", "荧光笔", "毛笔"],
        "笔本簿册": ["笔记本", "作业本", "记事本", "账本", "便签", "便利贴"],
        "美术绘图": ["颜料", "画笔", "画布", "素描", "水彩", "油画", "画板"],
        "办公收纳": ["文件夹", "档案盒", "资料册", "文件架", "收纳盒"],
        "桌面办公": ["订书机", "计算器", "剪刀", "胶带", "胶水", "回形针", "图钉"],
        "证书/奖状": ["证书", "奖状", "奖牌", "锦旗", "荣誉"]
    },
    "日用百货": {
        "纸巾/湿巾": ["纸巾", "抽纸", "卷纸", "湿巾", "面巾纸", "厕所纸"],
        "清洁用品": ["拖把", "扫帚", "抹布", "刷子", "垃圾袋", "清洁剂", "洗洁精"],
        "垃圾桶/垃圾袋": ["垃圾桶", "垃圾袋", "分类垃圾"],
        "个人护理": ["洗发水", "沐浴露", "香皂", "洗手液", "牙膏", "牙刷", "毛巾"],
        "收纳用品": ["收纳箱", "收纳盒", "储物箱", "整理箱"]
    },
    "家用电器": {
        "冰箱/冷柜": ["冰箱", "冷柜", "冰柜", "保鲜柜"],
        "空调": ["空调", "挂机", "柜机", "中央空调", "移动空调"],
        "洗衣机": ["洗衣机", "烘干机", "洗烘一体"],
        "厨房电器": ["微波炉", "电饭煲", "电磁炉", "电烤箱", "豆浆机", "榨汁机", "电水壶"],
        "净水器": ["净水器", "饮水机", "净水机", "直饮机"],
        "电风扇": ["电风扇", "风扇", "塔扇", "空气循环扇"],
        "取暖器": ["取暖器", "电暖器", "暖风机", "电热毯", "电油汀"]
    },
    "计算机设备及软件": {
        "服务器": ["服务器", "机架式服务器", "塔式服务器", "刀片服务器"],
        "网络设备": ["路由器", "交换机", "防火墙", "网关", "无线ap", "网桥"],
        "存储设备": ["存储器", "磁盘阵列", "nas", "san", "备份"],
        "ups电源": ["ups", "不间断电源", "稳压器"],
        "机房设备": ["机柜", "配电", "精密空调", "监控"]
    },
    "五金/工具": {
        "电动工具": ["电钻", "电锯", "角磨机", "电动螺丝刀", "切割机", "电动扳手"],
        "手动工具": ["扳手", "螺丝刀", "钳子", "锤子", "卷尺", "扳手套装"],
        "测量工具": ["卷尺", "水平仪", "激光测距", "千分尺", "万用表"],
        "五金配件": ["螺丝", "螺母", "垫片", "膨胀螺丝", "铰链"]
    },
    "劳动保护用品": {
        "头部防护": ["安全帽", "防护帽", "头盔"],
        "眼部防护": ["防护眼镜", "护目镜", "面罩"],
        "呼吸防护": ["口罩", "防尘口罩", "防毒面具", "呼吸器"],
        "手部防护": ["防护手套", "劳保手套", "绝缘手套", "耐酸碱手套"],
        "足部防护": ["安全鞋", "劳保鞋", "防砸鞋", "绝缘鞋"],
        "身体防护": ["工作服", "防护服", "反光背心", "防静电服"]
    }
};

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

    // 找到建议的一级类目
    const level1Category = categories.find(c => c.name === suggestedLevel1);
    if (!level1Category) {
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
        const { licenseKey, productTitle, mode = 'full' } = body;

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

        // 获取用户的类目权限
        const permission = await prisma.userCategoryPermission.findFirst({
            where: { licenseId: license.id },
            orderBy: { updatedAt: 'desc' }
        });

        if (!permission) {
            return NextResponse.json({
                error: '未找到类目权限，请先在政采云平台提取您的一级类目权限',
                code: 'NO_PERMISSION'
            }, { status: 400 });
        }

        const allowedCategories = JSON.parse(permission.level1Categories) as string[];

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

        // 第三步：深度类目匹配
        const matchResult = findBestCategoryPath(
            productTitle,
            filteredCategories,
            preCheckResult.suggestedCategory!
        );

        console.log(`[类目匹配] 匹配结果: 深度${matchResult.depth}, 路径: ${matchResult.categoryPath.join(' > ')}`)

        // ★★★ 清理第一级类目名称：去除 "/耗材" 等后缀 ★★★
        // "办公设备/耗材" → "办公设备"
        const cleanedCategoryPath = [...matchResult.categoryPath]
        if (cleanedCategoryPath.length > 0) {
            cleanedCategoryPath[0] = cleanedCategoryPath[0].split('/')[0].split('\\')[0].trim()
        }

        console.log(`[类目匹配] 清理后路径: ${cleanedCategoryPath.join(' > ')}`)

        return NextResponse.json({
            success: true,
            data: {
                productTitle,
                categoryPath: cleanedCategoryPath,  // 使用清理后的路径
                categoryIds: matchResult.categoryIds,
                suggestedLevel1: preCheckResult.suggestedCategory,
                confidence: matchResult.confidence,
                matchDetails: {
                    matchedKeywords: matchResult.matchedKeywords,
                    depth: matchResult.depth,
                    precheck: preCheckResult
                },
                message: matchResult.depth > 1
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
