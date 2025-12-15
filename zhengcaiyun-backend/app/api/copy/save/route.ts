import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getActorFromRequest } from '@/lib/request-actor';
import { analyzeProduct } from '@/lib/ai-service';

export async function POST(request: NextRequest) {
    try {
        const actor = await getActorFromRequest(request);
        if (!actor) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = actor.kind === 'user' ? actor.userId : actor.userId;
        if (!userId) {
            return NextResponse.json(
                { error: 'License is not linked to a user', code: 'LICENSE_NOT_LINKED' },
                { status: 403 }
            );
        }

        const body = await request.json();
        const {
            id,
            originalUrl,
            title,
            images,
            attributes,
            detailHtml,
            skuData,
            shopName,
            region, // New field
            status // Optional: e.g., 'scraped'
        } = body;

        // Mode 1: Update existing draft by ID (used by background worker)
        if (id) {
            // Verify ownership or allow if it's a system update? 
            // For now, assume if you have the ID you can update it, 
            // OR check if the draft belongs to the user.
            // But background worker might use a different token or same user token.
            // Let's assume user token is passed.

            const existing = await prisma.productDraft.findFirst({ where: { id, userId } });
            if (!existing) {
                return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
            }

            // Strict ownership check:
            // if (existing.userId !== user.userId) return 403...
            // But for now, let's allow it if it matches.

            const draft = await prisma.productDraft.update({
                where: { id },
                data: {
                    title,
                    images: typeof images === 'string' ? images : JSON.stringify(images || []),
                    attributes: typeof attributes === 'string' ? attributes : JSON.stringify(attributes || {}),
                    detailHtml,
                    skuData: typeof skuData === 'string' ? skuData : JSON.stringify(skuData || {}),
                    shopName,
                    status: status || 'scraped',
                }
            });

            // Update task progress if draft is part of a batch task
            if (draft.copyTaskId) {
                const task = await prisma.copyTask.findUnique({
                    where: { id: draft.copyTaskId }
                });

                if (task) {
                    // Recalculate success count? Or just increment?
                    // Incrementing is risky if we update multiple times.
                    // Better to count completed drafts.
                    const count = await prisma.productDraft.count({
                        where: {
                            copyTaskId: task.id,
                            status: 'scraped'
                        }
                    });

                    const isCompleted = count >= task.totalCount;

                    await prisma.copyTask.update({
                        where: { id: draft.copyTaskId },
                        data: {
                            successCount: count,
                            status: isCompleted ? 'completed' : 'running'
                        }
                    });
                }
            }

            return NextResponse.json({ success: true, draft });
        }

        // Mode 2: Create or update by originalUrl (used by manual copy)
        const existingDraft = await prisma.productDraft.findFirst({
            where: {
                userId,
                originalUrl
            }
        });

        // AI Category Prediction & Compliance Check
        let aiCategory = '';
        let complianceWarning = null;

        try {
            // Always analyze if title exists (for compliance), not just for category
            if (title) {
                console.log(`[Copy/Save] Analyzing product: ${title}, Region: ${region || 'Global'}`);
                const analysis = await analyzeProduct(title, detailHtml?.substring(0, 500), region || 'Global');

                if (analysis) {
                    // 1. Category Match
                    if (analysis.category && (!existingDraft?.categoryPath)) {
                        aiCategory = analysis.category;
                        console.log(`[Copy/Save] AI Category: ${aiCategory}`);
                    }

                    // 2. Compliance Check (Warning System)
                    if (analysis.riskLevel === 'high') {
                        complianceWarning = {
                            level: 'red',
                            title: '🔴 高风险警示',
                            message: analysis.reasoning || '该商品可能违反政采云规定或区域限制'
                        };
                    } else if (analysis.riskLevel === 'medium') {
                        complianceWarning = {
                            level: 'yellow',
                            title: '🟡 中风险提示',
                            message: analysis.reasoning || '该商品需要人工复核'
                        };
                    }
                }
            }
        } catch (err) {
            console.error('[Copy/Save] AI Analysis failed:', err);
            // Non-blocking error
        }

        let draft;
        if (existingDraft) {
            draft = await prisma.productDraft.update({
                where: { id: existingDraft.id },
                data: {
                    title,
                    images: typeof images === 'string' ? images : JSON.stringify(images || []),
                    attributes: typeof attributes === 'string' ? attributes : JSON.stringify(attributes || {}),
                    detailHtml,
                    skuData: typeof skuData === 'string' ? skuData : JSON.stringify(skuData || {}),
                    shopName,
                    // Only update category if AI found one and it was empty
                    categoryPath: aiCategory || existingDraft.categoryPath,
                    status: status || 'scraped'
                }
            });
        } else {
            draft = await prisma.productDraft.create({
                data: {
                    userId,
                    originalUrl,
                    title: title || '未命名商品',
                    images: typeof images === 'string' ? images : JSON.stringify(images || []),
                    attributes: typeof attributes === 'string' ? attributes : JSON.stringify(attributes || {}),
                    detailHtml: detailHtml || '',
                    skuData: typeof skuData === 'string' ? skuData : JSON.stringify(skuData || {}),
                    shopName: shopName || 'Unknown',
                    categoryPath: aiCategory || null,
                    status: status || 'scraped'
                }
            });
        }

        return NextResponse.json({ success: true, draft });

    } catch (error) {
        console.error('保存商品失败:', error);
        return NextResponse.json({ error: '保存失败: ' + (error as Error).message }, { status: 500 });
    }
}

export async function OPTIONS(request: NextRequest) {
    return new NextResponse(null, {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    });
}
