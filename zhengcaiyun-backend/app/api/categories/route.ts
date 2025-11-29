import { NextRequest, NextResponse } from 'next.server';

/**
 * 政采云类目API
 * GET /api/categories - 获取所有类目
 * GET /api/categories?level=1 - 获取指定层级
 * GET /api/categories/:id - 获取指定类目及其子类
 */

// 类目数据（实际应该从数据库读取）
import categoriesData from '@/public/api/categories.json';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level');
    const parentId = searchParams.get('parentId');
    const id = searchParams.get('id');

    try {
        // 查询指定ID的类目
        if (id) {
            const category = findCategoryById(categoriesData.tree, id);
            if (!category) {
                return NextResponse.json(
                    { error: '类目不存在' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                data: category
            });
        }

        // 按层级筛选
        if (level) {
            const filtered = categoriesData.categories.filter(
                (c: any) => c.level === parseInt(level)
            );

            return NextResponse.json({
                success: true,
                data: filtered,
                total: filtered.length
            });
        }

        // 按父级ID筛选
        if (parentId) {
            const filtered = categoriesData.categories.filter(
                (c: any) => c.parentId?.toString() === parentId
            );

            return NextResponse.json({
                success: true,
                data: filtered,
                total: filtered.length
            });
        }

        // 返回完整数据
        return NextResponse.json({
            success: true,
            data: categoriesData.tree,
            meta: categoriesData.meta
        });

    } catch (error) {
        console.error('获取类目失败:', error);
        return NextResponse.json(
            { error: '服务器错误' },
            { status: 500 }
        );
    }
}

// 辅助函数：查找类目
function findCategoryById(categories: any[], id: string): any | null {
    for (const cat of categories) {
        if (cat.id.toString() === id) {
            return cat;
        }

        if (cat.children) {
            const found = findCategoryById(cat.children, id);
            if (found) return found;
        }
    }

    return null;
}
