/**
 * 错误处理和重试机制
 */

export class RetryableError extends Error {
    constructor(message: string, public retryable: boolean = true) {
        super(message);
        this.name = 'RetryableError';
    }
}

export interface RetryOptions {
    maxRetries: number;
    delayMs: number;
    backoff: boolean;
}

/**
 * 带重试的异步函数执行器
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: Partial<RetryOptions> = {}
): Promise<T> {
    const { maxRetries = 3, delayMs = 1000, backoff = true } = options;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));

            // 检查是否可重试
            if (error instanceof RetryableError && !error.retryable) {
                throw error;
            }

            // 最后一次尝试后不再重试
            if (attempt === maxRetries) {
                break;
            }

            // 计算延迟时间（指数退避）
            const delay = backoff ? delayMs * Math.pow(2, attempt) : delayMs;

            console.log(`[Retry] 第${attempt + 1}次重试，${delay}ms后执行...`);
            await sleep(delay);
        }
    }

    throw lastError;
}

/**
 * 错误日志记录
 */
export function logError(context: string, error: Error, metadata?: any): void {
    console.error(`[Error] ${context}:`, {
        message: error.message,
        stack: error.stack,
        metadata
    });

    // 可以发送到错误监控服务（如Sentry）
    // if (window.Sentry) {
    //   window.Sentry.captureException(error, { contexts: { metadata } });
    // }
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 超时包装器
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    errorMessage: string = '操作超时'
): Promise<T> {
    let timeoutHandle: NodeJS.Timeout;

    const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
            reject(new Error(errorMessage));
        }, timeoutMs);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timeoutHandle!);
    }
}
