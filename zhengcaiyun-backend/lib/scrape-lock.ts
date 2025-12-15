type ScrapeLockOptions = {
    maxConcurrency?: number;
    maxWaitMs?: number;
};

const waiters: Array<() => void> = [];
let active = 0;

function getConfig(opts?: ScrapeLockOptions) {
    const maxConcurrency = Math.max(
        1,
        opts?.maxConcurrency ??
        (process.env.SCRAPE_MAX_CONCURRENCY ? parseInt(process.env.SCRAPE_MAX_CONCURRENCY, 10) : 2)
    );

    const maxWaitMs = Math.max(
        1,
        opts?.maxWaitMs ??
        (process.env.SCRAPE_MAX_WAIT_MS ? parseInt(process.env.SCRAPE_MAX_WAIT_MS, 10) : 20000)
    );

    return { maxConcurrency, maxWaitMs };
}

async function acquire(maxConcurrency: number, maxWaitMs: number) {
    if (active < maxConcurrency) {
        active += 1;
        return;
    }

    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SCRAPE_BUSY')), maxWaitMs);
        waiters.push(() => {
            clearTimeout(timer);
            active += 1;
            resolve();
        });
    });
}

function release() {
    active = Math.max(0, active - 1);
    const next = waiters.shift();
    if (next) next();
}

export async function withScrapeLock<T>(
    fn: () => Promise<T>,
    opts?: ScrapeLockOptions
): Promise<T> {
    const { maxConcurrency, maxWaitMs } = getConfig(opts);

    await acquire(maxConcurrency, maxWaitMs);
    try {
        return await fn();
    } finally {
        release();
    }
}

