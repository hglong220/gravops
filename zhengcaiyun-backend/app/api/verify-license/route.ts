/**
 * 安全的 License 验证 API
 * POST /api/verify-license
 */

import { NextRequest, NextResponse } from 'next/server';
import { LicenseVerificationError, verifyLicenseOrThrow } from '@/lib/license-verification';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, companyName, deviceId } = body;

        const license = await verifyLicenseOrThrow({ licenseKey, companyName, deviceId });

        return NextResponse.json({
            valid: true,
            companyName: license.companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan,
            maxDevices: license.maxDevices,
            currentDevices: license.devices.length
        });
    } catch (error) {
        if (error instanceof LicenseVerificationError) {
            return NextResponse.json(
                { error: error.message, code: error.code, ...(error.details || {}) },
                { status: error.status }
            );
        }

        console.error('[License] Verification error:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}

