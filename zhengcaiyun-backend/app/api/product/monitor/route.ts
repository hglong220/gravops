import { NextRequest, NextResponse } from 'next/server';
import { checkApprovalStatus, modifyApprovedProduct } from '@/lib/product-monitor';
import { prisma } from '@/lib/prisma';

/**
 * 检查商品审核状态
 */
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');
    const licenseKey = searchParams.get('licenseKey');

    if (!productId || !licenseKey) {
        return NextResponse.json({ error: '缺少参数' }, { status: 400 });
    }

    try {
        // Verify license
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license || license.status !== 'active') {
            return NextResponse.json({ error: '授权无效' }, { status: 401 });
        }

        const status = await checkApprovalStatus(productId);
        return NextResponse.json(status);

    } catch (error) {
        console.error('Check status error:', error);
        return NextResponse.json({ error: '检查失败' }, { status: 500 });
    }
}

/**
 * 修改已审核商品
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, productId, newName, newDescription, newImages } = body;

        if (!licenseKey || !productId) {
            return NextResponse.json({ error: '缺少参数' }, { status: 400 });
        }

        // Verify license
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
        });

        if (!license || license.status !== 'active') {
            return NextResponse.json({ error: '授权无效' }, { status: 401 });
        }

        const result = await modifyApprovedProduct({
            productId,
            newName,
            newDescription,
            newImages
        });

        return NextResponse.json(result);

    } catch (error) {
        console.error('Modify product error:', error);
        return NextResponse.json({ error: '修改失败' }, { status: 500 });
    }
}
