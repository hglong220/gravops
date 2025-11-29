/**
 * Chrome Extension 验证码处理工具
 */

import { storage } from '~/storage';

/**
 * 检测页面是否出现验证码
 */
export function detectCaptcha(): {
    type: 'image' | 'slide' | 'click' | null;
    element: HTMLElement | null;
} {
    // 检测图片验证码
    const imageSelectors = [
        'img[alt*="验证码"]',
        'img[src*="captcha"]',
        '.captcha-image',
        '#captchaImage'
    ];

    for (const selector of imageSelectors) {
        const el = document.querySelector(selector);
        if (el) {
            return { type: 'image', element: el as HTMLElement };
        }
    }

    // 检测滑块验证码
    const slideSelectors = [
        '.slider-verify',
        '.slide-captcha',
        '[class*="slide"]'
    ];

    for (const selector of slideSelectors) {
        const el = document.querySelector(selector);
        if (el) {
            return { type: 'slide', element: el as HTMLElement };
        }
    }

    // 检测点选验证码
    const clickSelectors = [
        '[class*="click-captcha"]',
        '[class*="point-captcha"]'
    ];

    for (const selector of clickSelectors) {
        const el = document.querySelector(selector);
        if (el) {
            return { type: 'click', element: el as HTMLElement };
        }
    }

    return { type: null, element: null };
}

/**
 * 获取验证码图片Base64
 */
export async function getCaptchaImage(element: HTMLElement): Promise<string> {
    const img = element.tagName === 'IMG' ? element : element.querySelector('img');
    if (!img) {
        throw new Error('找不到验证码图片');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const imgEl = img as HTMLImageElement;

    canvas.width = imgEl.naturalWidth || imgEl.width;
    canvas.height = imgEl.naturalHeight || imgEl.height;

    ctx?.drawImage(imgEl, 0, 0);

    return canvas.toDataURL('image/png').split(',')[1];
}

/**
 * 调用后端API识别验证码
 */
export async function solveCaptcha(params: {
    type: 'image' | 'slide' | 'click';
    imageBase64?: string;
    backgroundImage?: string;
    sliderImage?: string;
    instruction?: string;
}): Promise<{ success: boolean; solution?: string; error?: string }> {
    const licenseKey = await storage.get('licenseKey');

    if (!licenseKey) {
        throw new Error('未找到License Key');
    }

    const response = await fetch('http://localhost:3000/api/captcha/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            licenseKey,
            ...params
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '验证码识别失败');
    }

    return response.json();
}

/**
 * 自动处理验证码
 */
export async function handleCaptcha(): Promise<boolean> {
    const detected = detectCaptcha();

    if (!detected.type || !detected.element) {
        console.log('[Captcha] No captcha detected');
        return true; // No captcha, proceed
    }

    console.log(`[Captcha] Detected ${detected.type} captcha, solving...`);

    try {
        if (detected.type === 'image') {
            const imageBase64 = await getCaptchaImage(detected.element);
            const result = await solveCaptcha({ type: 'image', imageBase64 });

            if (result.success && result.solution) {
                // Fill captcha input
                const input = document.querySelector('input[name*="captcha"], input[placeholder*="验证码"]') as HTMLInputElement;
                if (input) {
                    input.value = result.solution;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    console.log('[Captcha] Image captcha solved');
                    return true;
                }
            }
        } else if (detected.type === 'slide') {
            const bgImg = detected.element.querySelector('.bg-image, .background') as HTMLImageElement;
            const sliderImg = detected.element.querySelector('.slider-image, .puzzle') as HTMLImageElement;

            if (bgImg && sliderImg) {
                const bgCanvas = document.createElement('canvas');
                const sliderCanvas = document.createElement('canvas');

                // Convert images to base64
                const bgCtx = bgCanvas.getContext('2d');
                const sliderCtx = sliderCanvas.getContext('2d');

                bgCanvas.width = bgImg.width;
                bgCanvas.height = bgImg.height;
                sliderCanvas.width = sliderImg.width;
                sliderCanvas.height = sliderImg.height;

                bgCtx?.drawImage(bgImg, 0, 0);
                sliderCtx?.drawImage(sliderImg, 0, 0);

                const backgroundImage = bgCanvas.toDataURL('image/png').split(',')[1];
                const sliderImage = sliderCanvas.toDataURL('image/png').split(',')[1];

                const result = await solveCaptcha({
                    type: 'slide',
                    backgroundImage,
                    sliderImage
                });

                if (result.success && result.solution) {
                    // Simulate slide to offset
                    const slider = detected.element.querySelector('.slider-button, .slide-btn') as HTMLElement;
                    if (slider) {
                        const offset = parseInt(result.solution);
                        // Trigger drag event (implementation depends on page)
                        console.log(`[Captcha] Slide captcha solved, offset: ${offset}px`);
                        return true;
                    }
                }
            }
        }

        return false;
    } catch (error) {
        console.error('[Captcha] Handle error:', error);
        return false;
    }
}
