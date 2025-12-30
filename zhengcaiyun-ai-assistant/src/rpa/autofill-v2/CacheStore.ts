/**
 * 缓存存储 V2
 * 
 * 职责：
 * 1. 存储 signature -> SemanticDecision 的映射
 * 2. 统计字段成功/失败次数，实现“越跑越聪明”
 * 3. 标记 needs_review 字段，避免重复调用 AI
 */

import type { CacheEntry, SemanticDecision } from './types';

const CACHE_KEY = 'zcy_v2_autofill_cache';
const MAX_FAILURES_BEFORE_BLOCK = 3; // 连续失败3次后不再自动尝试

/**
 * 缓存条目结构
 */
interface InternalCacheEntry {
    decision: SemanticDecision;
    successCount: number;
    failureCount: number;
    lastUsed: number;
    needsReview: boolean;
}

/**
 * 从存储获取全量缓存
 */
function loadAll(): Record<string, InternalCacheEntry> {
    try {
        const str = localStorage.getItem(CACHE_KEY);
        return str ? JSON.parse(str) : {};
    } catch {
        return {};
    }
}

/**
 * 保存全量缓存
 */
function saveAll(cache: Record<string, InternalCacheEntry>): void {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

/**
 * 查询单条缓存
 */
export function getDecision(signature: string): SemanticDecision | null {
    const cache = loadAll();
    const entry = cache[signature];

    if (entry && !entry.needsReview) {
        entry.lastUsed = Date.now();
        saveAll(cache);
        return entry.decision;
    }
    return null;
}

/**
 * 存入/更新缓存（校验通过后调用）
 */
export function recordSuccess(signature: string, decision: SemanticDecision): void {
    const cache = loadAll();
    const entry = cache[signature] || {
        decision,
        successCount: 0,
        failureCount: 0,
        lastUsed: 0,
        needsReview: false
    };

    entry.decision = decision;
    entry.successCount++;
    entry.lastUsed = Date.now();
    entry.failureCount = 0; // 重置失败计数

    cache[signature] = entry;
    saveAll(cache);
}

/**
 * 记录失败
 */
export function recordFailure(signature: string): void {
    const cache = loadAll();
    const entry = cache[signature];

    if (entry) {
        entry.failureCount++;
        if (entry.failureCount >= MAX_FAILURES_BEFORE_BLOCK) {
            entry.needsReview = true;
        }
        saveAll(cache);
    }
}

export const CacheStore = {
    getDecision,
    recordSuccess,
    recordFailure
};
