import { NextResponse } from 'next/server';
import Redis from 'ioredis';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function checkDb(): Promise<boolean> {
    try {
        // Fast, cross-db "SELECT 1"
        await prisma.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}

async function checkRedis(): Promise<boolean | 'not_configured'> {
    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST;

    if (!redisUrl && !redisHost) return 'not_configured';

    const host = redisHost || 'localhost';
    const port = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

    const client = redisUrl
        ? new Redis(redisUrl, { maxRetriesPerRequest: null, retryStrategy: () => null })
        : new Redis({ host, port, maxRetriesPerRequest: null, retryStrategy: () => null });

    try {
        const pong = await client.ping();
        return pong === 'PONG';
    } catch {
        return false;
    } finally {
        client.disconnect();
    }
}

export async function GET() {
    const [dbOk, redisOk] = await Promise.all([checkDb(), checkRedis()]);

    const ok = dbOk && (redisOk === true || redisOk === 'not_configured');

    return NextResponse.json(
        {
            ok,
            time: new Date().toISOString(),
            db: dbOk,
            redis: redisOk
        },
        { status: ok ? 200 : 503 }
    );
}

