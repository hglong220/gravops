/**
 * 管理员专用：生成License
 * POST /api/admin/generate-license
 * 
 * ✅ 需要管理员令牌
 * ✅ 记录所有操作日志
 * ✅ 只有支付成功后才能调用
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateLicenseKey } from '@/lib/license-utils';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
    try {
        // 1. ✅ 验证管理员权限
        const adminToken = request.headers.get('x-admin-token');
        const expectedToken = process.env.ADMIN_SECRET_TOKEN;

        if (!adminToken || adminToken !== expectedToken) {
            console.warn('[Admin] Unauthorized license generation attempt');

            return NextResponse.json({
                error: '需要管理员权限'
            }, { status: 403 });
        }

        const body = await request.json();
        const { orderId, companyName, plan } = body;

        // 2. 参数验证
        if (!orderId || !companyName || !plan) {
            return NextResponse.json({
                error: '缺少必要参数'
            }, { status: 400 });
        }

        // 3. ✅ 验证订单是否已支付
        const order = await prisma.order.findUnique({
            where: { id: orderId }
        });

        if (!order) {
            return NextResponse.json({
                error: '订单不存在'
            }, { status: 404 });
        }

        if (order.status !== 'paid') {
            return NextResponse.json({
                error: `订单未支付，当前状态: ${order.status}`,
                orderId: orderId
            }, { status: 400 });
        }

        // 4. ✅ 检查订单是否已经生成过License
        const existingLicense = await prisma.license.findFirst({
            where: { orderId: orderId }
        });

        if (existingLicense) {
            console.log(`[Admin] License already exists for order ${orderId}`);

            return NextResponse.json({
                licenseKey: existingLicense.key,
                companyName: existingLicense.companyName,
                expiresAt: existingLicense.expiresAt.getTime(),
                plan: existingLicense.plan,
                message: '此订单已生成License'
            });
        }

        // 5. 生成License Key
        const licenseKey = generateLicenseKey(companyName);

        // 6. 计算有效期
        const duration = getPlanDuration(plan);
        const expiresAt = new Date(Date.now() + duration * 24 * 60 * 60 * 1000);

        // 7. 创建License
        const license = await prisma.license.create({
            data: {
                key: licenseKey,
                orderId: orderId,
                companyName: companyName,
                plan: plan,
                expiresAt: expiresAt,
                status: 'active',
                maxDevices: getMaxDevicesByPlan(plan),
                maxUsage: getMaxUsageByPlan(plan),
                boundDevices: [],
                usageCount: 0
            }
        });

        // 8. 更新订单
        await prisma.order.update({
            where: { id: orderId },
            data: {
                licenseKey: licenseKey,
                status: 'completed'
            }
        });

        // 9. ✅ 记录操作日志
        await prisma.adminLog.create({
            data: {
                action: 'generate_license',
                detail: {
                    licenseKey,
                    orderId,
                    companyName,
                    plan
                },
                ip: request.ip || 'unknown',
                adminToken: adminToken.substring(0, 10) + '...'
            }
        });

        console.log(`[Admin] Generated license ${licenseKey} for order ${orderId}`);

        // 10. 返回License
        return NextResponse.json({
            licenseKey: license.key,
            companyName: license.companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan,
            maxDevices: license.maxDevices,
            maxUsage: license.maxUsage,
            message: '授权码生成成功'
        });

    } catch (error) {
        console.error('[Admin] Generate license error:', error);

        return NextResponse.json({
            error: '生成失败'
        }, { status: 500 });
    }
}

/**
 * 获取套餐时长（天数）
 */
function getPlanDuration(plan: string): number {
    const durations: Record<string, number> = {
        'monthly': 30,
        'quarterly': 90,
        'yearly': 365
    };

    return durations[plan] || 30;
}

/**
 * 获取最大设备数
 */
function getMaxDevicesByPlan(plan: string): number {
    const limits: Record<string, number> = {
        'basic': 1,
        'standard': 3,
        'professional': 5,
        'enterprise': 10
    };

    return limits[plan] || 1;
}

/**
 * 获取最大使用次数
 */
function getMaxUsageByPlan(plan: string): number {
    const limits: Record<string, number> = {
        'basic': 1000,
        'standard': 5000,
        'professional': 20000,
        'enterprise': 999999
    };

    return limits[plan] || 1000;
}
