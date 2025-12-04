/**
 * API: 抓取用户的政采云授权类目
 * POST /api/user/fetch-categories
 */

import { NextRequest, NextResponse } from 'next/server';
import userCategoryService from '@/lib/user-category';

export async function POST(request: NextRequest) {
    try {
        const userId = request.headers.get('x-user-id') || 'default-user';

        console.log('📦 开始抓取用户授权类目...');

        // 抓取授权类目
        const result = await userCategoryService.fetchUserAuthorizedCategories(userId);

        // 保存到数据库
        await userCategoryService.saveUserCategories(userId, result.categories);

        return NextResponse.json({
            success: true,
            message: '授权类目抓取成功',
            data: {
                totalCategories: result.categories.length,
                topLevelCategories: result.categories.filter(c => c.level === 1).length,
                fetchedAt: result.fetchedAt
            }
        });

    } catch (error: any) {
        console.error('抓取授权类目失败:', error);

        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    }
}
