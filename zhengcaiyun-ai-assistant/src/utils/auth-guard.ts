/**
 * 授权验证守卫
 * 在执行采集/发布操作前验证授权状态
 */

import { getStoredLicense, extractZcyCompanyInfo, verifyLicense, type LicenseInfo } from './license';

export interface AuthGuardResult {
    authorized: boolean;
    error?: string;
    errorType?: 'no_license' | 'expired' | 'mismatch' | 'invalid' | 'network';
    license?: LicenseInfo;
}

/**
 * 快速本地验证（不联网）
 */
export async function quickAuthCheck(): Promise<AuthGuardResult> {
    const license = await getStoredLicense();

    if (!license?.licenseKey) {
        return {
            authorized: false,
            error: '请先激活授权码',
            errorType: 'no_license'
        };
    }

    // 检查过期
    if (license.expiresAt && Date.now() > license.expiresAt) {
        return {
            authorized: false,
            error: '授权已过期，请续费',
            errorType: 'expired',
            license
        };
    }

    // 检查状态
    if ((license.status || 'active') !== 'active') {
        return {
            authorized: false,
            error: `授权状态异常: ${license.status}`,
            errorType: 'invalid',
            license
        };
    }

    return {
        authorized: true,
        license
    };
}

/**
 * 完整验证（联网+公司匹配）
 * 在执行关键操作前调用
 */
export async function fullAuthGuard(): Promise<AuthGuardResult> {
    // 先做快速检查
    const quickResult = await quickAuthCheck();
    if (!quickResult.authorized) {
        return quickResult;
    }

    const license = quickResult.license!;

    // 获取当前登录的公司信息
    const zcyCompanyInfo = extractZcyCompanyInfo();

    // 如果在ZCY页面，验证公司匹配
    if (zcyCompanyInfo && license.companyName) {
        if (license.companyName !== zcyCompanyInfo.companyName) {
            return {
                authorized: false,
                error: `授权公司不匹配\n授权给: ${license.companyName}\n当前登录: ${zcyCompanyInfo.companyName}`,
                errorType: 'mismatch',
                license
            };
        }
    }

    // 联网验证
    try {
        const result = await verifyLicense(
            license.licenseKey,
            zcyCompanyInfo?.companyName || license.companyName
        );

        if (!result.valid) {
            return {
                authorized: false,
                error: result.error || '授权验证失败',
                errorType: result.error?.includes('绑定') ? 'mismatch' : 'invalid',
                license
            };
        }

        return {
            authorized: true,
            license: {
                ...license,
                companyName: result.companyName || license.companyName,
                expiresAt: result.expiresAt,
                plan: result.plan
            }
        };

    } catch (error) {
        console.error('[AuthGuard] Network error:', error);

        // 网络错误时，如果本地验证通过，允许继续（离线模式）
        // 但如果是首次使用，必须联网
        if (license.activatedAt) {
            console.warn('[AuthGuard] Allowing offline mode');
            return {
                authorized: true,
                license
            };
        }

        return {
            authorized: false,
            error: '网络连接失败，请检查网络',
            errorType: 'network',
            license
        };
    }
}

/**
 * 创建授权验证装饰器
 * 用于包装需要授权的函数
 */
export function withAuthGuard<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    onUnauthorized?: (result: AuthGuardResult) => void
): T {
    return (async (...args: any[]) => {
        const authResult = await fullAuthGuard();

        if (!authResult.authorized) {
            console.warn('[AuthGuard] Unauthorized:', authResult.error);
            if (onUnauthorized) {
                onUnauthorized(authResult);
            }
            throw new Error(authResult.error || '未授权');
        }

        return fn(...args);
    }) as T;
}

/**
 * 检查是否需要显示激活弹窗
 */
export async function shouldShowActivation(): Promise<boolean> {
    const license = await getStoredLicense();
    return !license?.licenseKey || (license.status || 'active') !== 'active';
}
