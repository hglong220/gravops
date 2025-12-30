/**
 * V2 引擎工具函数
 */

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function simulateClick(el: HTMLElement): Promise<void> {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(100);
    el.click();
}

export function triggerEvents(el: HTMLElement): void {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
}
