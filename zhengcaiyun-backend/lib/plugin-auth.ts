import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export interface PluginTokenPayload {
    typ: 'plugin';
    licenseId: string;
    userId?: string | null;
    deviceId?: string | null;
    iat?: number;
    exp?: number;
}

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

export function getPluginTokenPayload(request: NextRequest): PluginTokenPayload | null {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) return null;

        const token = authHeader.slice('Bearer '.length).trim();
        const decoded = jwt.verify(token, getPluginJwtSecret()) as PluginTokenPayload;
        if (!decoded || decoded.typ !== 'plugin' || !decoded.licenseId) return null;

        return decoded;
    } catch {
        return null;
    }
}

export async function getPluginLicenseFromRequest(request: NextRequest) {
    const payload = getPluginTokenPayload(request);
    if (!payload) return null;

    const license = await prisma.license.findUnique({
        where: { id: payload.licenseId },
        include: { devices: true }
    });

    if (!license) return null;
    if (license.status !== 'active') return null;
    if (new Date() > license.expiresAt) return null;

    // 设备绑定校验（有 deviceId 才强校验，兼容旧客户端）
    if (payload.deviceId) {
        const device = license.devices.find(d => d.fingerprint === payload.deviceId);
        if (!device) return null;

        // 更新 lastSeen（不影响主流程）
        prisma.device
            .update({ where: { id: device.id }, data: { lastSeen: new Date() } })
            .catch(() => undefined);
    }

    return { payload, license };
}

