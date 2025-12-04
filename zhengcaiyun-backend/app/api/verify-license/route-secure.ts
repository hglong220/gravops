/**
 * 安全的License验证API
 * 修复所有已知漏洞
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * POST /api/verify-license
 * 验证授权码（插件调用）
 */
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
            where: { key: licenseKey }
        });

        // ✅ 修复漏洞1：不存在时直接拒绝，不自动创建
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
                error: `授权状态异常: ${license.status}`,
                contactSupport: true
            }, { status: 403 });
        }

        // 5. 验证公司绑定
        if (!license.companyName) {
            // 首次激活：绑定公司
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
            console.warn(`[License] Company mismatch: ${license.companyName} vs ${companyName}`);

            return NextResponse.json({
                error: `授权验证失败`,
                detail: `此授权码已绑定到"${license.companyName}"，无法在"${companyName}"使用`,
                boundCompany: license.companyName
            }, { status: 403 });
        }

        // 6. ✅ 新增：设备数量限制
        const maxDevices = getMaxDevicesByPlan(license.plan);

        if (deviceId) {
            const boundDevices = license.boundDevices || [];

            if (!boundDevices.includes(deviceId)) {
                // 新设备
                if (boundDevices.length >= maxDevices) {
                    return NextResponse.json({
                        error: '超过最大设备数限制',
                        currentDevices: boundDevices.length,
                        maxDevices: maxDevices,
                        upgradeUrl: '/pricing'
                    }, { status: 403 });
                }

                // 绑定新设备
                await prisma.license.update({
                    where: { id: license.id },
                    data: {
                        boundDevices: [...boundDevices, deviceId]
                    }
                });

                console.log(`[License] Bound device ${deviceId} to ${licenseKey}`);
            }
        }

        // 7. ✅ 新增：使用次数限制
        const maxUsage = getMaxUsageByPlan(license.plan);
        const currentUsage = license.usageCount || 0;

        if (currentUsage >= maxUsage) {
            return NextResponse.json({
                error: '超过使用次数限制',
                currentUsage: currentUsage,
                maxUsage: maxUsage,
                upgradeUrl: '/pricing'
            }, { status: 403 });
        }

        // 8. ✅ 新增：异常检测（防止共享账号）
        const suspiciousActivity = await detectSuspiciousActivity(license, request);

        if (suspiciousActivity) {
            console.warn(`[License] Suspicious activity detected for ${licenseKey}`);

            // 不立即拒绝，但记录警告
            await prisma.licenseLog.create({
                data: {
                    licenseId: license.id,
                    action: 'suspicious_activity',
                    detail: suspiciousActivity,
                    ip: request.ip || 'unknown'
                }
            });
        }

        // 9. 更新使用记录
        await prisma.license.update({
            where: { id: license.id },
            data: {
                usageCount: currentUsage + 1,
                lastUsedAt: new Date(),
                lastUsedIp: request.ip || 'unknown'
            }
        });

        // 10. 记录审计日志
        await prisma.licenseLog.create({
            data: {
                licenseId: license.id,
                action: 'verify_success',
                ip: request.ip || 'unknown',
                deviceId: deviceId || null,
                companyName: companyName
            }
        });

        // 11. 验证通过
        return NextResponse.json({
            valid: true,
            companyName: license.companyName || companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan,
            remainingUsage: maxUsage - currentUsage - 1,
            boundDevices: (license.boundDevices || []).length,
            maxDevices: maxDevices
        });

    } catch (error) {
        console.error('[License] Verification error:', error);

        return NextResponse.json({
            error: '服务器错误，请稍后重试'
        }, { status: 500 });
    }
}

/**
 * ✅ 修复漏洞2：删除GET生成接口，改为管理员专用API
 * 移动到 /api/admin/generate-license
 */
// export async function GET() {
//     return NextResponse.json({ 
//         error: '接口已废弃，请联系管理员' 
//     }, { status: 403 });
// }

/**
 * 根据套餐获取最大设备数
 */
function getMaxDevicesByPlan(plan: string): number {
    const limits: Record<string, number> = {
        'free': 1,
        'basic': 1,
        'standard': 3,
        'professional': 5,
        'enterprise': 10
    };

    return limits[plan] || 1;
}

/**
 * 根据套餐获取最大使用次数
 */
function getMaxUsageByPlan(plan: string): number {
    const limits: Record<string, number> = {
        'free': 100,           // 免费：100次
        'basic': 1000,         // 基础：1000次/月
        'standard': 5000,      // 标准：5000次/月
        'professional': 20000, // 专业：20000次/月
        'enterprise': 999999   // 企业：无限制
    };

    return limits[plan] || 100;
}

/**
 * 检测可疑活动
 */
async function detectSuspiciousActivity(
    license: any,
    request: NextRequest
): Promise<string | null> {
    // 获取最近使用记录
    const recentLogs = await prisma.licenseLog.findMany({
        where: {
            licenseId: license.id,
            createdAt: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24小时内
            }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
    });

    // 检测1：短时间内从不同IP使用
    const uniqueIps = new Set(recentLogs.map(log => log.ip));
    if (uniqueIps.size > 5) {
        return `Short time multiple IPs: ${uniqueIps.size}`;
    }

    // 检测2：短时间内使用次数过多
    if (recentLogs.length > 100) {
        return `High frequency usage: ${recentLogs.length} in 24h`;
    }

    // 检测3：地理位置异常（IP地址变化太大）
    // TODO: 实现IP地理位置检测

    return null;
}
