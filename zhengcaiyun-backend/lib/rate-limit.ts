import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import Redis from 'ioredis';

import { logger } from '@/lib/logger';

type RateLimitOptions = {
    prefix: string;
    id: string;
    max: number;
    windowMs: number;
};

type RateLimitResult = {
    allowed: boolean;
    remaining: number;
    resetAt: number; // epoch ms
};

let redisClient: Redis | null = null;

function getRedisClient(): Redis | null {
    if (process.env.RATE_LIMIT_DISABLE_REDIS === '1') return null;

    if (redisClient) return redisClient;

    const redisUrl = process.env.REDIS_URL;
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379;

    try {
        redisClient = redisUrl
            ? new Redis(redisUrl, { maxRetriesPerRequest: null, retryStrategy: () => null })
            : new Redis({
                host: redisHost,
                port: redisPort,
                maxRetriesPerRequest: null,
                retryStrategy: () => null
            });

        redisClient.on('error', (err) => {
            console.error('[RateLimit] Redis error:', err);
        });

        return redisClient;
    } catch (err) {
        console.error('[RateLimit] Failed to init Redis:', err);
        redisClient = null;
        return null;
    }
}

const memoryStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimitMemory(key: string, max: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const existing = memoryStore.get(key);

    if (!existing || now >= existing.resetAt) {
        const resetAt = now + windowMs;
        memoryStore.set(key, { count: 1, resetAt });
        return {
            allowed: true,
            remaining: Math.max(0, max - 1),
            resetAt
        };
    }

    existing.count += 1;
    memoryStore.set(key, existing);

    return {
        allowed: existing.count <= max,
        remaining: Math.max(0, max - existing.count),
        resetAt: existing.resetAt
    };
}

async function checkRateLimitRedis(
    key: string,
    max: number,
    windowMs: number
): Promise<RateLimitResult> {
    const client = getRedisClient();
    if (!client) return checkRateLimitMemory(key, max, windowMs);

    const now = Date.now();

    try {
        const count = await client.incr(key);
        if (count === 1) {
            await client.pexpire(key, windowMs);
        }

        const ttl = await client.pttl(key);
        const resetAt = now + (ttl > 0 ? ttl : windowMs);

        return {
            allowed: count <= max,
            remaining: Math.max(0, max - count),
            resetAt
        };
    } catch (err) {
        console.error('[RateLimit] Redis check failed, fallback to memory:', err);
        return checkRateLimitMemory(key, max, windowMs);
    }
}

export function getClientIp(request: NextRequest): string {
    const xff = request.headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0].trim();

    const realIp = request.headers.get('x-real-ip');
    if (realIp) return realIp.trim();

    // NextRequest.ip may be undefined depending on runtime/proxy
    const anyReq = request as any;
    if (typeof anyReq.ip === 'string' && anyReq.ip) return anyReq.ip;

    return 'unknown';
}

export async function enforceRateLimit(
    request: NextRequest,
    opts: RateLimitOptions
): Promise<NextResponse | null> {
    const key = `rl:${opts.prefix}:${opts.id}`;
    const result = await checkRateLimitRedis(key, opts.max, opts.windowMs);

    if (result.allowed) return null;

    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));

    logger.warn('SYSTEM', 'rate_limit', {
        prefix: opts.prefix,
        id: opts.id,
        max: opts.max,
        windowMs: opts.windowMs,
        retryAfterSeconds
    });

    return NextResponse.json(
        { error: 'Too Many Requests' },
        {
            status: 429,
            headers: {
                'Retry-After': String(retryAfterSeconds),
                'X-RateLimit-Limit': String(opts.max),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000))
            }
        }
    );
}

