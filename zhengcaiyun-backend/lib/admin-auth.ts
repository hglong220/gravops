import type { NextRequest } from 'next/server';
import { getAuthUser } from '@/lib/auth';

export type AdminAuthResult = {
    userId: string;
    email: string;
    via: 'user_token' | 'admin_token';
};

function getAdminEmailAllowlist(): string[] {
    const raw = process.env.ADMIN_EMAILS || '';
    return raw
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
}

export function getAdminFromRequest(request: NextRequest): AdminAuthResult | null {
    const adminToken = request.headers.get('x-admin-token');
    const expectedToken = process.env.ADMIN_SECRET_TOKEN;

    if (expectedToken && adminToken && adminToken === expectedToken) {
        return { userId: 'admin', email: 'admin', via: 'admin_token' };
    }

    const user = getAuthUser(request);
    if (!user) return null;

    const allowlist = getAdminEmailAllowlist();

    // 生产环境必须显式配置 ADMIN_EMAILS（或使用 x-admin-token）
    if (process.env.NODE_ENV === 'production' && allowlist.length === 0) {
        return null;
    }

    if (allowlist.length === 0) {
        return { userId: user.userId, email: user.email, via: 'user_token' };
    }

    if (allowlist.includes(user.email.toLowerCase())) {
        return { userId: user.userId, email: user.email, via: 'user_token' };
    }

    return null;
}

