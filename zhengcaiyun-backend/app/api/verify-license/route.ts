/**
 * 安全的License验证API（修复版）
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

        // 2. 查找License （✅ 修复：不存在时不自动创建）
        const license = await prisma.license.findUnique({
            where: { key: licenseKey }
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
        if (!license.companyName) {
            // 首次激活
            await prisma.license.update({
                where: { id: license.id },
                data: {
                    companyName: companyName,
                    activatedAt: new Date()
                }
            });

            console.log(`[License] Activated ${licenseKey} for ${companyName}`);

        } else if (license.companyName !== companyName) {
            // 公司不匹配
            console.warn(`[License] Company mismatch`);

            return NextResponse.json({
                error: '授权验证失败',
                detail: `此授权码已绑定到"${license.companyName}"`
            }, { status: 403 });
        }

        // 6. 设备绑定（如果提供了deviceId）
        if (deviceId && license.boundDevices) {
            const devices = license.boundDevices as string[];
            if (!devices.includes(deviceId)) {
                const maxDevices = license.maxDevices || 1;

                if (devices.length >= maxDevices) {
                    return NextResponse.json({
                        error: '超过最大设备数限制',
                        currentDevices: devices.length,
                        maxDevices: maxDevices
                    }, { status: 403 });
                }

                await prisma.license.update({
                    where: { id: license.id },
                    data: {
                        boundDevices: [...devices, deviceId]
                    }
                });
            }
        }

        // 7. 更新使用记录
        await prisma.license.update({
            where: { id: license.id },
            data: {
                usageCount: (license.usageCount || 0) + 1,
                lastUsedAt: new Date(),
                lastUsedIp: request.ip || 'unknown'
            }
        });

        // 8. 返回成功
        return NextResponse.json({
            valid: true,
            companyName: license.companyName || companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan,
            user: {
                id: license.userId,
                email: license.email
            }
        });

    } catch (error) {
        console.error('[License] Verification error:', error);

        return NextResponse.json({
            error: '服务器错误'
        }, { status: 500 });
    }
}
