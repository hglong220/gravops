import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * 商品属性模板缓存 API
 * 实现 "AI 拓荒 + 数据沉淀 + RPA 闪速填写" 的核心后端逻辑
 */

// 查询缓存：根据类目、品牌、型号查找是否有之前成功的填写记录
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const categoryId = searchParams.get('categoryId');
        const brand = searchParams.get('brand');
        const model = searchParams.get('model');

        if (!categoryId || !brand || !model) {
            return NextResponse.json({ error: '缺少 categoryId, brand 或 model 参数' }, { status: 400 });
        }

        // 尝试查找匹配的缓存
        const cache = await prisma.productAttributeCache.findUnique({
            where: {
                categoryId_brand_model: {
                    categoryId,
                    brand,
                    model
                }
            }
        });

        if (cache) {
            // 异步增加命中计数
            prisma.productAttributeCache.update({
                where: { id: cache.id },
                data: {
                    hitCount: { increment: 1 },
                    lastUsedAt: new Date()
                }
            }).catch(e => console.error('[AttributeCache] 更新计数失败:', e));

            return NextResponse.json({
                found: true,
                attributes: JSON.parse(cache.attributes),
                categoryPath: cache.categoryPath,
                updatedAt: cache.updatedAt
            });
        }

        return NextResponse.json({ found: false });
    } catch (error) {
        console.error('[AttributeCache] 查询失败:', error);
        return NextResponse.json({ found: false, error: '后端数据库查询失败' }, { status: 500 });
    }
}

// 保存/更新缓存：当 AI (Browser-use) 填表成功后调用，沉淀知识
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { categoryId, categoryPath, brand, model, attributes } = body;

        if (!categoryId || !brand || !model || !attributes) {
            return NextResponse.json({ error: '缺少必要参数 (categoryId, brand, model, attributes)' }, { status: 400 });
        }

        const attrString = typeof attributes === 'string' ? attributes : JSON.stringify(attributes);

        // 使用 upsert 确保数据最新
        const result = await prisma.productAttributeCache.upsert({
            where: {
                categoryId_brand_model: {
                    categoryId,
                    brand,
                    model
                }
            },
            update: {
                attributes: attrString,
                categoryPath,
                updatedAt: new Date()
            },
            create: {
                categoryId,
                categoryPath,
                brand,
                model,
                attributes: attrString
            }
        });

        console.log(`[AttributeCache] 成功沉淀知识库: ${brand} / ${model}`);

        return NextResponse.json({
            success: true,
            id: result.id,
            message: '商品属性知识已成功存入服务器'
        });
    } catch (error) {
        console.error('[AttributeCache] 保存失败:', error);
        return NextResponse.json({ success: false, error: '知识保存失败' }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
