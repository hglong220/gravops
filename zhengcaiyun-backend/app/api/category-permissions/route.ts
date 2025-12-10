/**
 * 用户类目权限 API
 * 存储和获取用户在政采云的一级类目权限
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET: 获取用户的类目权限
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const licenseKey = searchParams.get('licenseKey');
        const market = searchParams.get('market');

        if (!licenseKey) {
            return NextResponse.json({ error: '缺少licenseKey参数' }, { status: 400 });
        }

        // 验证License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license) {
            return NextResponse.json({ error: 'License无效' }, { status: 401 });
        }

        // 获取该License的所有类目权限
        const whereClause: any = { licenseKey };
        if (market) {
            whereClause.market = market;
        }

        const permissions = await prisma.userCategoryPermission.findMany({
            where: whereClause,
            orderBy: { updatedAt: 'desc' }
        });

        if (permissions.length === 0) {
            return NextResponse.json({
                success: true,
                data: null,
                message: '暂无类目权限数据，请在政采云平台提取'
            });
        }

        // 聚合所有一级类目
        const level1Categories = permissions.map(p => p.level1Category);

        return NextResponse.json({
            success: true,
            data: {
                licenseKey,
                market: permissions[0].market,
                level1Categories,
                updatedAt: permissions[0].updatedAt
            }
        });

    } catch (error) {
        console.error('获取类目权限失败:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}

// POST: 保存/更新用户的类目权限
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, market, level1Categories } = body;

        if (!licenseKey || !level1Categories) {
            return NextResponse.json({
                error: '缺少必要参数: licenseKey, level1Categories'
            }, { status: 400 });
        }

        if (!Array.isArray(level1Categories) || level1Categories.length === 0) {
            return NextResponse.json({
                error: 'level1Categories必须是非空数组'
            }, { status: 400 });
        }

        // 验证License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license) {
            return NextResponse.json({ error: 'License无效' }, { status: 401 });
        }

        // 删除该License的旧权限
        await prisma.userCategoryPermission.deleteMany({
            where: { licenseKey }
        });

        // 批量创建新的类目权限
        const createData = level1Categories.map((cat: string) => ({
            licenseKey,
            market: market || null,
            level1Category: cat,
            subCategories: '[]'
        }));

        await prisma.userCategoryPermission.createMany({
            data: createData
        });

        console.log(`[类目权限] 保存成功: License=${licenseKey}, 卖场=${market || '默认'}, 类目数=${level1Categories.length}`);
        console.log(`[类目权限] 类目列表: ${level1Categories.join(', ')}`);

        return NextResponse.json({
            success: true,
            data: {
                licenseKey,
                market,
                level1Categories,
                categoryCount: level1Categories.length
            },
            message: `已保存${level1Categories.length}个一级类目权限`
        });

    } catch (error) {
        console.error('保存类目权限失败:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}
