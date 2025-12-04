/**
 * API: 获取用户的授权类目
 * GET /api/user/categories
 */

import { NextRequest, NextResponse } from 'next/server';
import userCategoryService from '@/lib/user-category';

export async function GET(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id') || 'default-user';

        // 获取用户授权类目
        const categories = await userCategoryService.getUserCategories(userId);

        if (categories.length === 0) {
            return NextResponse.json({
                success: false,
                message: '未找到授权类目，请先抓取',
                needFetch: true
            });
        }

        return NextResponse.json({
            success: true,
            categories,
            summary: {
                total: categories.length,
                level1: categories.filter(c => c.level === 1).length,
                level2: categories.filter(c => c.level === 2).length,
                level3: categories.filter(c => c.level === 3).length
            }
        });

    } catch (error: any) {
        console.error('获取授权类目失败:', error);

        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}
