import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { matchCategoryWithAI } from '@/lib/ai-category-match';

type ProductForCheck = {
    id: string;
    title: string;
    brand: string | null;
    model: string | null;
    categoryPath: string | null;
    attributes: string | null;
};

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, productIds } = body;

        if (!licenseKey) {
            return NextResponse.json({ error: '缺少 licenseKey 参数' }, { status: 400 });
        }

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return NextResponse.json({ error: '请选择要检测的商品' }, { status: 400 });
        }

        const permissions = await prisma.userCategoryPermission.findMany({
            where: { licenseKey }
        });

        if (permissions.length === 0) {
            return NextResponse.json({
                error: '未找到用户类目权限数据，请先提取或配置政采云权限'
            }, { status: 400 });
        }

        const userCategories = permissions.map(p => p.level1Category).filter(Boolean);
        const products = await prisma.productDraft.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                title: true,
                brand: true,
                model: true,
                categoryPath: true,
                attributes: true
            }
        });

        let validCount = 0;
        let invalidCount = 0;

        for (const product of products) {
            try {
                const result = await matchCategoryWithAI(product.title, userCategories);
                const categoryPathArray = Array.isArray(result.path)
                    ? result.path.map(String).map(s => s.trim()).filter(Boolean)
                    : [];
                const consistency = checkCategoryConsistency(product, categoryPathArray, userCategories);
                const hasPermission = categoryPathArray.length > 0 && consistency.ok;
                const status = hasPermission ? 'valid' : 'invalid';
                const categoryPath = hasPermission ? categoryPathArray.join(' > ') : null;

                await prisma.productDraft.update({
                    where: { id: product.id },
                    data: {
                        permissionStatus: status,
                        permissionCheckedAt: new Date(),
                        ...(categoryPath ? { categoryPath } : {})
                    }
                });

                if (hasPermission) {
                    validCount++;
                } else {
                    invalidCount++;
                    console.warn(`[permission-check] rejected ${product.id}: ${consistency.reason}`);
                }
            } catch (error) {
                console.error('[permission-check] failed:', product.id, error);
                await prisma.productDraft.update({
                    where: { id: product.id },
                    data: {
                        permissionStatus: 'invalid',
                        permissionCheckedAt: new Date()
                    }
                });
                invalidCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: '权限检测完成',
            stats: {
                total: products.length,
                valid: validCount,
                invalid: invalidCount
            }
        });
    } catch (error) {
        console.error('[permission-check] error:', error);
        return NextResponse.json({
            error: '权限检测失败',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}

function parseStoredPath(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (typeof parsed === 'string') return splitPath(parsed);
    } catch {
        return splitPath(value);
    }
    return [];
}

function splitPath(value: string): string[] {
    const text = String(value || '').trim();
    if (!text) return [];
    if (text.includes('>')) return text.split('>').map(s => s.trim()).filter(Boolean);
    if (text.startsWith('办公设备/耗材/')) {
        return ['办公设备/耗材', ...text.slice('办公设备/耗材/'.length).split('/').map(s => s.trim()).filter(Boolean)];
    }
    if (text.startsWith('五金/工具/')) {
        return ['五金/工具', ...text.slice('五金/工具/'.length).split('/').map(s => s.trim()).filter(Boolean)];
    }
    return text.split(/\/|,/).map(s => s.trim()).filter(Boolean);
}

function inferCoarseCategory(product: ProductForCheck): string | null {
    const text = [
        product.title,
        product.brand,
        product.model,
        parseStoredPath(product.categoryPath).join(' ')
    ].filter(Boolean).join(' ').toLowerCase();

    if (/轮胎|汽车轮|continental|马牌|倍耐力|米其林/.test(text)) return 'auto';
    if (/电钢琴|钢琴|键盘琴|乐器|mosen|莫森/.test(text)) return 'music';
    if (/夹克|外套|卫衣|t恤|tshirt|裤|鞋|adidas|nike|耐克|阿迪|运动服|服饰|男装|女装|户外/.test(text)) return 'apparel';
    if (/打印机|复印机|一体机|硒鼓|墨盒|canon|佳能|惠普|hp|brother|epson|办公设备|耗材/.test(text)) return 'office';
    if (/档案盒|资料盒|文件夹|收纳|天章|tango|文具|办公用品|文教|文化用品/.test(text)) return 'stationery';
    if (/切割片|砂纸|润滑油|铁丝|压力泵|水泵|电机|五金|工具/.test(text)) return 'hardware';
    return null;
}

function expectedRootForCoarse(coarse: string | null): RegExp | null {
    if (!coarse) return null;
    const roots: Record<string, RegExp> = {
        auto: /汽车|轮胎|车品|交通/,
        music: /乐器|音乐|文教|文化|文化玩乐/,
        apparel: /服装|服饰|运动|户外|鞋|纺织/,
        office: /办公设备|耗材|打印|复印|计算机设备/,
        stationery: /文教|文化|办公用品|收纳|档案|资料|文件/,
        hardware: /五金|工具|机电/
    };
    return roots[coarse] || null;
}

function checkCategoryConsistency(
    product: ProductForCheck,
    matchedPath: string[],
    userCategories: string[]
): { ok: boolean; reason: string } {
    if (matchedPath.length === 0) return { ok: false, reason: 'AI 未返回类目路径' };

    const root = matchedPath[0];
    if (!userCategories.includes(root)) {
        return { ok: false, reason: `匹配到的一级类目不在用户权限中：${root}` };
    }

    const expected = inferCoarseCategory(product);
    const rule = expectedRootForCoarse(expected);
    if (!rule) return { ok: true, reason: '无明显冲突特征' };

    const matchedText = matchedPath.join(' ');
    if (rule.test(matchedText)) return { ok: true, reason: '类目粗校验通过' };

    return {
        ok: false,
        reason: `商品特征为 ${expected}，但匹配到 ${matchedText}`
    };
}
