import fs from 'fs';

export function resolvePuppeteerExecutablePath(): string | undefined {
    const envPath =
        process.env.PUPPETEER_EXECUTABLE_PATH ||
        process.env.CHROME_EXECUTABLE_PATH ||
        process.env.CHROME_PATH;

    if (envPath && fs.existsSync(envPath)) {
        return envPath;
    }

    const localAppData = process.env.LOCALAPPDATA || '';

    const candidates = [
        'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
        'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
        localAppData ? `${localAppData}\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe` : ''
    ].filter(Boolean);

    return candidates.find((p) => fs.existsSync(p));
}

export function buildPuppeteerArgs(extraArgs: string[] = []): string[] {
    const baseArgs = [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled'
    ];

    // 去重并保持顺序
    const out: string[] = [];
    for (const arg of [...baseArgs, ...extraArgs]) {
        if (!arg) continue;
        if (!out.includes(arg)) out.push(arg);
    }
    return out;
}

