import type { PlasmoCSConfig } from "plasmo"

export const config: PlasmoCSConfig = {
    matches: [
        "https://*.jd.com/*",
        "https://*.jd.hk/*",
        "https://*.tmall.com/*",
        "https://*.tmall.hk/*",
        "https://*.taobao.com/*",
        "https://*.suning.com/*",
        "https://product.suning.com/*"
    ],
    run_at: "document_end",
    all_frames: false
}

console.log('[E-Commerce Scraper] Content script loaded');

// 检测当前页面是否是商品详情页
function isProductDetailPage(): boolean {
    const url = window.location.href;
    const hostname = window.location.hostname;

    // 京东商品页
    if (hostname.includes('jd.com') && /\/\d+\.html/.test(url)) {
        console.log('[E-Commerce] Detected JD product page');
        return true;
    }

    // 天猫商品页 (支持各种子域名)
    if (hostname.includes('tmall.com') && url.includes('item.htm')) {
        console.log('[E-Commerce] Detected Tmall product page');
        return true;
    }

    // 淘宝商品页
    if (hostname.includes('taobao.com') && url.includes('item.htm')) {
        console.log('[E-Commerce] Detected Taobao product page');
        return true;
    }

    // 苏宁商品页
    if (hostname.includes('suning.com') && url.includes('/product/')) {
        console.log('[E-Commerce] Detected Suning product page');
        return true;
    }

    console.log('[E-Commerce] Not a product detail page:', url);
    return false;
}

// 注入浮动复制按钮
function injectCopyButton() {
    if (document.getElementById('zcy-ecom-copy-btn')) {
        return; // 已存在
    }

    if (!isProductDetailPage()) {
        console.log('[E-Commerce Scraper] Not a product detail page, skipping button injection');
        return;
    }

    const btn = document.createElement('button');
    btn.id = 'zcy-ecom-copy-btn';
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
            <path d="M4 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V2zm2-1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1H6z"/>
            <path d="M2 5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1h1v1a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h1v1H2z"/>
        </svg>
        复制到政采云
    `;

    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        padding: 12px 20px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        transition: all 0.3s;
        display: flex;
        align-items: center;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    btn.onmouseover = () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
    };

    btn.onmouseout = () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
    };

    btn.onclick = handleCopyClick;

    document.body.appendChild(btn);
    console.log('[E-Commerce Scraper] Copy button injected');
}

// 处理复制点击
async function handleCopyClick(): Promise<void> {
    const btn = document.getElementById('zcy-ecom-copy-btn') as HTMLButtonElement;
    if (!btn) return;

    const originalHTML = btn.innerHTML;
    btn.innerHTML = '⏳ 抓取中...';
    btn.disabled = true;
    btn.style.background = '#999';

    try {
        // 1. Client-side scraping
        const productData = scrapePageData();
        console.log('[E-Commerce Scraper] Scraped data:', productData);

        if (!productData.title) {
            throw new Error('无法获取商品标题，请刷新页面重试');
        }

        btn.innerHTML = '💾 保存中...';

        // 1.5 Get Region
        const storage = await chrome.storage.local.get('zcy_region');
        const region = storage.zcy_region || 'Global';

        // 2. Send to background to save
        const response = await chrome.runtime.sendMessage({
            action: 'saveProduct',
            data: { ...productData, region }
        });

        if (response.success) {
            // Check for Warnings
            if (response.warning) {
                const w = response.warning;
                const color = w.level === 'red' ? '#ff4d4f' : '#faad14';
                btn.innerHTML = w.level === 'red' ? '❌ 风险警示' : '⚠️ 风险提示';
                btn.style.background = color;

                alert(`${w.title}\n\n${w.message}\n\n建议：${w.level === 'red' ? '请勿上传或修改后上传' : '请仔细检查商品信息'}`);

                // Allow publishing even if warned (as per user request: "Just warn, don't block")
            } else {
                btn.innerHTML = '✅ 复制成功！';
                btn.style.background = '#52c41a';
            }

            // Ask user to publish immediately
            if (response.draft?.id) {
                // Use a slight delay to show success/warning message
                setTimeout(() => {
                    const msg = response.warning ? '商品存在风险，是否仍要前往政采云发布？' : '商品复制成功！是否立即前往政采云发布？';
                    if (confirm(msg)) {
                        window.open(`https://www.zcygov.cn/publish?draft_id=${response.draft.id}`, '_blank');
                    }
                }, 1000); // Longer delay to read alert
            }

            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                btn.disabled = false;
            }, 3000);
        } else {
            throw new Error(response.error || '保存失败');
        }
    } catch (error) {
        console.error('[E-Commerce Scraper] Copy error:', error);
        btn.innerHTML = '❌ 失败';
        btn.style.background = '#ff4d4f';

        alert(`复制失败: ${(error as Error).message}`);

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            btn.disabled = false;
        }, 3000);
    }
}

// Client-side Scraper Logic
function scrapePageData() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    let data = {
        originalUrl: url,
        title: '',
        price: '0',
        images: [] as string[],
        attributes: {} as Record<string, string>,
        detailHtml: '',
        shopName: ''
    };

    // Common: Try Meta Tags First
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content');
    if (ogTitle) data.title = ogTitle;
    if (ogImage) data.images.push(ogImage);

    // Platform Specific Logic
    if (hostname.includes('jd.com')) {
        scrapeJD(data);
    } else if (hostname.includes('tmall.com') || hostname.includes('taobao.com')) {
        scrapeTaobaoTmall(data);
    } else if (hostname.includes('suning.com')) {
        scrapeSuning(data);
    } else {
        // Generic Fallback
        if (!data.title) data.title = document.title;
    }

    // Final cleanup
    data.title = data.title.trim();
    data.images = [...new Set(data.images)].slice(0, 10); // Unique & limit 10

    return data;
}

function scrapeJD(data: any) {
    // Title
    const titleEl = document.querySelector('.sku-name') || document.querySelector('h1');
    if (titleEl) data.title = titleEl.textContent?.trim();

    // Price
    const priceEl = document.querySelector('.price') || document.querySelector('.p-price .price');
    if (priceEl) data.price = priceEl.textContent?.replace(/[^\d.]/g, '');

    // Images
    const imgs = document.querySelectorAll('#spec-list img, .lh img');
    imgs.forEach((img: HTMLImageElement) => {
        let src = img.src || img.getAttribute('data-url');
        if (src) {
            // Get high res
            src = src.replace('/n5/', '/n1/').replace('/n7/', '/n1/');
            data.images.push(src);
        }
    });

    // Specs
    const items = document.querySelectorAll('.p-parameter li');
    items.forEach(item => {
        const text = item.textContent || '';
        const [key, val] = text.split(/[:：]/);
        if (key && val) data.attributes[key.trim()] = val.trim();
    });

    // Selected SKU Attributes (Color, Size)
    const selectedSkus = document.querySelectorAll('#choose-attrs .item.selected');
    selectedSkus.forEach(item => {
        const type = item.parentElement?.parentElement?.querySelector('.dt')?.textContent?.trim();
        const value = item.getAttribute('data-value') || item.textContent?.trim();
        if (type && value) {
            data.attributes[type.replace(/[:：]/g, '').trim()] = value;
        }
    });

    data.shopName = '京东';
}

function scrapeTaobaoTmall(data: any) {
    // Title
    const titleEl = document.querySelector('.tb-main-title') || document.querySelector('h1');
    if (titleEl) data.title = titleEl.getAttribute('data-title') || titleEl.textContent?.trim();

    // Price (Tricky on Taobao, dynamic loading)
    const priceEl = document.querySelector('.tm-price') || document.querySelector('.tb-rmb-num');
    if (priceEl) data.price = priceEl.textContent?.trim();

    // Images
    const imgs = document.querySelectorAll('#J_UlThumb img');
    imgs.forEach((img: HTMLImageElement) => {
        let src = img.src;
        if (src) {
            // Get high res (usually replace _60x60.jpg with nothing or _800x800)
            src = src.replace(/_\d+x\d+\.jpg.*/, '');
            data.images.push(src);
        }
    });

    // Selected SKU Attributes
    const selectedSkus = document.querySelectorAll('.J_TSaleProp .tb-selected');
    selectedSkus.forEach(item => {
        const type = item.closest('.J_Prop')?.querySelector('.tb-metatit')?.textContent?.trim();
        const value = item.textContent?.trim();
        if (type && value) {
            data.attributes[type.replace(/[:：]/g, '').trim()] = value;
        }
    });

    data.shopName = '淘宝/天猫';
}

function scrapeSuning(data: any) {
    const titleEl = document.querySelector('#itemDisplayName');
    if (titleEl) data.title = titleEl.textContent?.trim();

    const priceEl = document.querySelector('.mainprice');
    if (priceEl) data.price = priceEl.textContent?.replace(/[^\d.]/g, '');

    const imgs = document.querySelectorAll('.img-zoom-thumb img');
    imgs.forEach((img: HTMLImageElement) => {
        let src = img.src;
        if (src) {
            src = src.replace(/_60w_60h/, '_800w_800h');
            data.images.push(src);
        }
    });

    data.shopName = '苏宁易购';
}

// 页面加载完成后注入按钮
if (document.readyState === 'complete') {
    injectCopyButton();
} else {
    window.addEventListener('load', injectCopyButton);
}

// 监听URL变化(SPA应用)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('[E-Commerce Scraper] URL changed, re-checking page type');
        // 移除旧按钮
        const oldBtn = document.getElementById('zcy-ecom-copy-btn');
        if (oldBtn) {
            oldBtn.remove();
        }
        // 重新注入
        setTimeout(injectCopyButton, 1000);
    }
}).observe(document, { subtree: true, childList: true });
