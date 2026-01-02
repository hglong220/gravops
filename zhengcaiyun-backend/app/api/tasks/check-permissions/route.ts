/**
 * 权限检测 API（简化版）
 * 直接复用发布时的AI类目分析功能
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { matchCategoryWithAI } from '@/lib/ai-category-match';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, productIds } = body;

        if (!licenseKey) {
            return NextResponse.json({ error: '缺少licenseKey参数' }, { status: 400 });
        }

        if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
            return NextResponse.json({ error: '请选择要检测的商品' }, { status: 400 });
        }

        console.log('[权限检测] 开始检测，License:', licenseKey, '商品数量:', productIds.length);

        // 1. 获取用户的一级类目权限
        const permissions = await prisma.userCategoryPermission.findMany({
            where: { licenseKey }
        });

        if (permissions.length === 0) {
            return NextResponse.json({
                error: '未找到用户权限数据，请先提取政采云权限'
            }, { status: 400 });
        }

        const userCategories = permissions.map(p => p.level1Category);
        console.log('[权限检测] 用户权限类目:', userCategories);

        // 2. 获取用户选中的商品
        const products = await prisma.productDraft.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                title: true,
                brand: true,
                model: true,
                categoryPath: true,
                attributes: true // ⭐ 新增：加载商品参数
            }
        });

        console.log('[权限检测] 待检测商品数量:', products.length);

        if (products.length === 0) {
            return NextResponse.json({
                success: true,
                message: '没有需要检测的商品',
                stats: { total: 0, valid: 0, invalid: 0 }
            });
        }

        // 3. 批量检测商品（直接调用发布时的AI分析）
        let validCount = 0;
        let invalidCount = 0;

        for (const product of products) {
            try {
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`[权限检测] 检测: ${product.title}`);

                // ✅ 恢复原始逻辑：直接调用发布时的AI类目分析
                const result = await matchCategoryWithAI(
                    product.title,
                    userCategories
                );

                // 📊 记录结果
                console.log(`[AI分析] 路径: ${result.path?.join(' > ') || '(无)'}`);

                // 简单判断：只要AI返回了有效类目，就认为是有权限的
                const hasPermission = result.path && result.path.length > 0;
                const status = hasPermission ? 'valid' : 'invalid';
                const categoryPath = hasPermission ? result.path.join(' > ') : null;

                console.log(`[结果] ${status === 'valid' ? '✅ 可发布' : '❌ 无权限'} ${categoryPath || ''}`);

                // 更新商品状态
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
                }

            } catch (error) {
                console.error(`[权限检测] 异常:`, error);
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

        console.log('[权限检测] 完成:', { total: products.length, valid: validCount, invalid: invalidCount });

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
        console.error('[权限检测] 错误:', error);
        return NextResponse.json({
            error: '权限检测失败',
            details: error instanceof Error ? error.message : String(error)
        }, { status: 500 });
    }
}
