/**
 * 表单字段映射 API
 * 用于查询和保存 AI 学习到的表单字段映射
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// 查询已有映射
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const templateId = searchParams.get('templateId');
        const categoryId = searchParams.get('categoryId');

        if (!templateId && !categoryId) {
            return NextResponse.json(
                { error: '需要 templateId 或 categoryId' },
                { status: 400 }
            );
        }

        // 查询映射
        const mapping = await prisma.formFieldMapping.findFirst({
            where: {
                OR: [
                    templateId ? { templateId } : {},
                    categoryId ? { categoryId } : {}
                ].filter(obj => Object.keys(obj).length > 0)
            },
            orderBy: { successCount: 'desc' }
        });

        if (mapping) {
            // 更新最后使用时间
            await prisma.formFieldMapping.update({
                where: { id: mapping.id },
                data: { lastUsedAt: new Date() }
            });

            return NextResponse.json({
                found: true,
                mapping: {
                    ...mapping,
                    fieldMapping: JSON.parse(mapping.fieldMapping)
                }
            });
        }

        return NextResponse.json({ found: false });

    } catch (error) {
        console.error('[FormMapping] 查询失败:', error);
        return NextResponse.json(
            { error: '查询失败' },
            { status: 500 }
        );
    }
}

// 保存新映射（方案二学习后调用）
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { templateId, categoryId, categoryPath, urlPattern, fields } = body;

        if (!templateId || !categoryId || !fields) {
            return NextResponse.json(
                { error: '缺少必要参数' },
                { status: 400 }
            );
        }

        // 检查是否已存在
        const existing = await prisma.formFieldMapping.findFirst({
            where: { templateId, categoryId }
        });

        if (existing) {
            // 更新现有映射
            const updated = await prisma.formFieldMapping.update({
                where: { id: existing.id },
                data: {
                    fieldMapping: JSON.stringify({ fields }),
                    categoryPath,
                    urlPattern,
                    successCount: existing.successCount + 1,
                    lastUsedAt: new Date()
                }
            });

            return NextResponse.json({
                action: 'updated',
                id: updated.id,
                successCount: updated.successCount
            });
        }

        // 创建新映射
        const created = await prisma.formFieldMapping.create({
            data: {
                templateId,
                categoryId,
                categoryPath,
                urlPattern,
                fieldMapping: JSON.stringify({ fields })
            }
        });

        return NextResponse.json({
            action: 'created',
            id: created.id
        });

    } catch (error) {
        console.error('[FormMapping] 保存失败:', error);
        return NextResponse.json(
            { error: '保存失败' },
            { status: 500 }
        );
    }
}

// 增加成功计数
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, success } = body;

        if (!id) {
            return NextResponse.json({ error: '缺少 id' }, { status: 400 });
        }

        if (success) {
            await prisma.formFieldMapping.update({
                where: { id },
                data: {
                    successCount: { increment: 1 },
                    lastUsedAt: new Date()
                }
            });
        }

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error('[FormMapping] 更新失败:', error);
        return NextResponse.json({ error: '更新失败' }, { status: 500 });
    }
}
