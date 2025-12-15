import { NextRequest } from 'next/server';
import jwt from 'jsonwebtoken';

import { getJwtSecret } from '@/lib/jwt';

export interface AuthUser {
    userId: string;
    email: string;
}

export function getAuthUser(request: NextRequest): AuthUser | null {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return null;
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, getJwtSecret());

        if (!decoded || typeof decoded !== 'object') return null;
        if ((decoded as any).typ === 'plugin') return null;

        const userId = (decoded as any).userId;
        const email = (decoded as any).email;
        if (typeof userId !== 'string' || typeof email !== 'string') return null;

        return { userId, email };
    } catch (error) {
        return null;
    }
}
