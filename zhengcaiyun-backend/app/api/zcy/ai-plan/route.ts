/**
 * AI 计划生成 API
 * 
 * 接收：商品信息 + 权限 + 类目树
 * 返回：完整的 RPA 执行指令
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIPlanRequest } from '@/lib/zcy-ai-plan';
import { buildPlan } from '@/lib/plan-builder';
import fs from 'fs';
import path from 'path';

// 缓存类目树
let categoryTreeCache: any = null;

function loadCategoryTree() {
    if (categoryTreeCache) return categoryTreeCache;

    const filePath = path.join(process.cwd(), 'public', 'api', '政采云完整类目.json');
    const data = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(data);
    categoryTreeCache = json.categories || json;
    console.log(`[AI计划] 加载类目树完成`);
    return categoryTreeCache;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { product, permissions } = body;

        // 校验
        if (!product || !product.title) {
            return NextResponse.json({ error: '缺少商品信息 product.title' }, { status: 400 });
        }

        if (!permissions || !permissions.bids || permissions.bids.length === 0) {
            return NextResponse.json({ error: '缺少权限信息 permissions.bids' }, { status: 400 });
        }

        // 加载类目树（使用服务器端的完整类目文件）
        const categoryTree = loadCategoryTree();

        const req: AIPlanRequest = {
            product,
            permissions: {
                markets: permissions.markets || ['网上超市(青海网超)'],
                bids: permissions.bids
            },
            categoryTree
        };

        // 生成计划
        const plan = buildPlan(req);

        console.log(`[AI计划] 生成成功: ${plan.categoryPath.join(' > ')}`);
        console.log(`[AI计划] 指令数量: ${plan.commands.length}`);

        return NextResponse.json({
            success: true,
            data: plan
        });

    } catch (error: any) {
        console.error('[AI计划] 生成失败:', error);
        return NextResponse.json({
            success: false,
            error: error.message || '生成 AI 计划失败'
        }, { status: 500 });
    }
}
