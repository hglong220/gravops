/**
 * Plugin Session API
 * POST /api/plugin/session
 *
 * 用于：插件使用 LicenseKey + companyName(+ deviceId) 换取短期 Token
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

import { LicenseVerificationError, verifyLicenseOrThrow } from '@/lib/license-verification';
import { enforceRateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function getPluginJwtSecret(): string {
    const secret = process.env.PLUGIN_JWT_SECRET || process.env.JWT_SECRET;
    if (!secret) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('Missing PLUGIN_JWT_SECRET (or JWT_SECRET) in production');
        }
        return 'dev-plugin-jwt-secret';
    }
    return secret;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { licenseKey, companyName, deviceId } = body;

        const ip = getClientIp(request);
        const rlMax = process.env.RATE_LIMIT_PLUGIN_SESSION_MAX
            ? parseInt(process.env.RATE_LIMIT_PLUGIN_SESSION_MAX, 10)
            : 20;
        const rlWindowMs = process.env.RATE_LIMIT_PLUGIN_SESSION_WINDOW_MS
            ? parseInt(process.env.RATE_LIMIT_PLUGIN_SESSION_WINDOW_MS, 10)
            : 10 * 60 * 1000;

        const rateLimited = await enforceRateLimit(request, {
            prefix: 'plugin_session',
            id: `${ip}:${licenseKey || 'no_license'}`,
            max: Number.isFinite(rlMax) ? rlMax : 20,
            windowMs: Number.isFinite(rlWindowMs) ? rlWindowMs : 10 * 60 * 1000
        });
        if (rateLimited) return rateLimited;

        const license = await verifyLicenseOrThrow({ licenseKey, companyName, deviceId });
        if (!license.userId) {
            return NextResponse.json(
                {
                    error: 'License is not linked to a user',
                    code: 'LICENSE_NOT_LINKED',
                    bindUrl: '/dashboard/license'
                },
                { status: 403 }
            );
        }

        const tokenTtl = (process.env.PLUGIN_TOKEN_TTL || '12h') as any;
        const token = jwt.sign(
            {
                typ: 'plugin',
                licenseId: license.id,
                userId: license.userId,
                deviceId: deviceId || null
            },
            getPluginJwtSecret(),
            { expiresIn: tokenTtl }
        );

        return NextResponse.json({
            valid: true,
            token,
            companyName: license.companyName,
            expiresAt: license.expiresAt.getTime(),
            plan: license.plan,
            maxDevices: license.maxDevices,
            currentDevices: license.devices.length,
            userId: license.userId
        });
    } catch (error) {
        if (error instanceof LicenseVerificationError) {
            return NextResponse.json(
                { error: error.message, code: error.code, ...(error.details || {}) },
                { status: error.status }
            );
        }

        console.error('[Plugin Session] Error:', error);
        return NextResponse.json({ error: '服务器错误' }, { status: 500 });
    }
}
