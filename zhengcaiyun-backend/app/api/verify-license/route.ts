/**
 * 安全的License验证API
 * POST /api/verify-license
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, companyName, deviceId } = body;

        // 1. 参数验证
        if (!licenseKey || !companyName) {
            return NextResponse.json({
                error: '缺少必要参数'
            }, { status: 400 });
        }

        // 2. 查找License
        const license = await prisma.license.findUnique({
            where: { key: licenseKey },
            include: { devices: true }
        });

        if (!license) {
            console.warn(`[License] Invalid key attempted: ${licenseKey}`);

            return NextResponse.json({
                error: '无效的授权码，请先购买',
                requirePurchase: true,
                purchaseUrl: '/pricing'
            }, { status: 401 });
        }

        // 3. 验证有效期
        if (new Date() > license.expiresAt) {
            return NextResponse.json({
                error: '授权已过期',
                expiresAt: license.expiresAt.getTime(),
                renewUrl: '/pricing'
            }, { status: 401 });
        }

        // 4. 验证状态
        if (license.status !== 'active') {
            return NextResponse.json({
                error: `授权状态异常: ${license.status}`
            }, { status: 403 });
        }

        // 5. 验证公司绑定
        // 模糊匹配公司名称（去除空格、省略号等）
        const normalizedDbName = license.companyName.replace(/[\s\.…]/g, '').toLowerCase();
        const normalizedInputName = companyName.replace(/[\s\.…]/g, '').toLowerCase();

        // 检查是否包含或被包含
        const isMatch = normalizedDbName.includes(normalizedInputName) ||
            normalizedInputName.includes(normalizedDbName) ||
            normalizedDbName === normalizedInputName;

        if (!isMatch) {
            // 公司不匹配
            console.warn(`[License] Company mismatch: DB="${license.companyName}" vs Input="${companyName}"`);

            return NextResponse.json({
                error: '授权验证失败',
                detail: `此授权码已绑定到"${license.companyName}"`
            }, { status: 403 });
        }

        console.log(`[License] Company matched: ${companyName}`);

        // 6. 设备绑定检查（如果提供了deviceId）
        if (deviceId) {
            const existingDevice = license.devices.find(d => d.fingerprint === deviceId);

            if (!existingDevice) {
                // 检查设备数量限制
                if (license.devices.length >= license.maxDevices) {
                    return NextResponse.json({
                        error: '超过最大设备数限制',
                        currentDevices: license.devices.length,
                        maxDevices: license.maxDevices
                    }, { status: 403 });
                }

                // 添加新设备
                await prisma.device.create({
                    data: {
                        licenseId: license.id,
                        fingerprint: deviceId,
                        lastSeen: new Date()
                    }
                });
                console.log(`[License] New device registered: ${deviceId}`);
            } else {
                // 更新设备最后使用时间
                await prisma.device.update({
                    where: { id: existingDevice.id },
                    data: { lastSeen: new Date() }
                });
            }
        }

        // 7. 返回成功
        return NextResponse.json({
            valid: true,
            companyName: license.companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan,
            maxDevices: license.maxDevices,
            currentDevices: license.devices.length
        });

    } catch (error) {
        console.error('[License] Verification error:', error);

        return NextResponse.json({
            error: '服务器错误'
        }, { status: 500 });
    }
}
