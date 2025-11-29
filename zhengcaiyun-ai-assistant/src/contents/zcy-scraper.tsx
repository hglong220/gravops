import type { PlasmoCSConfig } from "plasmo"
import { fetchWithAuth } from "~src/utils/api"
import { extractRegion } from "~src/utils/zcy-dom"

export const config: PlasmoCSConfig = {
    matches: ["https://www.zcygov.cn/*", "https://*.zcygov.cn/*"],
    run_at: "document_idle"
}

const initScraper = () => {
    console.log('[ZCY Scraper] Initializing...');

    // 确保只在政采云域名运行
    if (!window.location.hostname.includes('zcygov.cn')) {
        console.log('[ZCY Scraper] Not on ZCY domain, skipping');
        return;
    }

    // 自动识别并保存当前区域 (Auto-detect Region)
    const region = extractRegion();
    if (region && region !== 'Global') {
        console.log(`[ZCY Scraper] Detected Region: ${region}`);
        chrome.storage.local.set({ 'zcy_region': region });
    }

    // Detect page type with more robust checks
    const isProduct = window.location.href.includes('/product/') ||
        window.location.href.includes('detail') ||
        document.querySelector('.product-intro') ||
        document.querySelector('.sku-name') ||
        document.querySelector('.meta-price') || // Added selector
        document.querySelector('.item-title');   // Added selector

    if (isProduct) {
        console.log('[ZCY Scraper] Detected product page');
        injectCopyButton();
    } else if (checkIsListPage()) {
        console.log('[ZCY Scraper] Detected list page');
        injectBatchCopyButton();
    } else {
        console.log('[ZCY Scraper] No specific page type detected, monitoring for changes...');
    }
}

// Watch for URL changes (SPA support)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log('[ZCY Scraper] URL changed');
        // Re-initialize after a short delay to allow DOM to update
        setTimeout(initScraper, 1500);
    }
}).observe(document, { subtree: true, childList: true });

const checkIsListPage = () => {
    return !!document.querySelector('.product-list, .shop-products, .item-list, .search-list');
}

const injectCopyButton = () => {
    if (document.getElementById('zcy-copy-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'zcy-copy-btn';
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

    btn.onclick = () => handleCopy(false);

    document.body.appendChild(btn);
}

const handleCopy = async (forceRapidMode: boolean | any = false) => {
    // If called from event, forceRapidMode is an Event object, so treat as false
    const isRapid = typeof forceRapidMode === 'boolean' ? forceRapidMode : false;

    const btn = document.getElementById('zcy-copy-btn') as HTMLButtonElement;
    if (!btn) return;

    const originalText = btn.innerHTML;
    btn.innerHTML = '⏳ 正在提取...';
    btn.disabled = true;

    try {
        const data = scrapeProductData();
        console.log('[ZCY Scraper] Extracted:', data);

        const response = await fetchWithAuth('/api/copy/zcy', {
            method: 'POST',
            body: JSON.stringify({
                ...data,
                originalUrl: window.location.href,
                shopName: 'Zhengcaiyun Internal',
                rapidMode: isRapid // Pass forced flag
            })
        });

        if (response.ok) {
            const res = await response.json();
            btn.innerHTML = '✅ 复制成功！';
            btn.style.background = 'linear-gradient(135deg, #42e695 0%, #3bb2b8 100%)';

            if (res.draft?.id) {
                if (res.rapidMode) {
                    // 急速模式：直接打开发布页
                    btn.innerHTML = '⚡ 正在跳转...';
                    window.open(`https://www.zcygov.cn/publish?draft_id=${res.draft.id}&auto_publish=true`, '_blank');
                } else {
                    // 标准模式：询问是否编辑
                    if (confirm('复制成功！是否立即去编辑发布？')) {
                        window.open(`https://www.zcygov.cn/publish?draft_id=${res.draft.id}`, '_blank');
                    }
                }
            }
        } else {
            throw new Error('Save failed');
        }

    } catch (error) {
        console.error('[ZCY Scraper] Error:', error);
        btn.innerHTML = '❌ 失败';
        btn.style.background = 'linear-gradient(135deg, #ff5858 0%, #f09819 100%)';

        const msg = (error as Error).message;
        if (msg.includes('Unauthorized')) {
            alert('失败：未授权。请点击插件图标激活。');
        } else if (msg.includes('Failed to fetch')) {
            alert('连接服务器失败。\\n请确保后端服务 (localhost:3000) 已启动。');
        } else {
            alert(`复制失败: ${msg}`);
        }
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            btn.disabled = false;
        }, 3000);
    }
}

const injectBatchCopyButton = () => {
    if (document.getElementById('zcy-batch-copy-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'zcy-batch-copy-btn';
    btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="margin-right: 4px;">
            <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z"/>
        </svg>
        整店/批量复制
    `;

    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 999999;
        padding: 12px 20px;
        background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
        color: white;
        border: none;
        border-radius: 25px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        box-shadow: 0 4px 12px rgba(161, 140, 209, 0.4);
        transition: all 0.3s;
        display: flex;
        align-items: center;
        user-select: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    btn.onmouseover = () => {
        btn.style.transform = 'translateY(-2px)';
        btn.style.boxShadow = '0 6px 16px rgba(161, 140, 209, 0.5)';
    };
    btn.onmouseout = () => {
        btn.style.transform = 'translateY(0)';
        btn.style.boxShadow = '0 4px 12px rgba(161, 140, 209, 0.4)';
    };

    btn.onclick = handleBatchCopy;

    // Add Rapid Mode Checkbox
    const container = document.createElement('div');
    container.style.cssText = `
        position: fixed;
        bottom: 70px;
        right: 20px;
        z-index: 999999;
        display: flex;
        align-items: center;
        background: rgba(255, 255, 255, 0.9);
        padding: 8px 12px;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12px;
        color: #666;
    `;

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'zcy-rapid-mode-toggle';
    checkbox.style.marginRight = '6px';
    checkbox.style.cursor = 'pointer';

    // Load saved state
    chrome.storage.local.get(['rapidMode'], (result) => {
        checkbox.checked = !!result.rapidMode;
    });

    checkbox.onchange = (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        chrome.storage.local.set({ rapidMode: checked });
        console.log('[ZCY] Rapid Mode set to:', checked);
    };

    const label = document.createElement('label');
    label.htmlFor = 'zcy-rapid-mode-toggle';
    label.innerText = '⚡ 开启急速模式';
    label.style.cursor = 'pointer';
    label.style.fontWeight = '600';
    label.style.color = '#722ed1';

    container.appendChild(checkbox);
    container.appendChild(label);
    document.body.appendChild(container);

    document.body.appendChild(btn);
}

const handleBatchCopy = async () => {
    const btn = document.getElementById('zcy-batch-copy-btn') as HTMLButtonElement;
    if (!btn) return;

    // Get Rapid Mode state
    const rapidMode = (document.getElementById('zcy-rapid-mode-toggle') as HTMLInputElement)?.checked;

    const originalText = btn.innerText;
    btn.innerText = '🔍 扫描中...';
    btn.disabled = true;

    try {
        const links = Array.from(document.querySelectorAll('a[href*="/product/"]'))
            .map(a => (a as HTMLAnchorElement).href)
            .filter(href => href.match(/\/product\/\d+/));

        const uniqueLinks = [...new Set(links)];

        if (uniqueLinks.length === 0) {
            throw new Error('未找到商品链接');
        }

        const modeText = rapidMode ? '⚡急速模式' : '标准模式';

        // 急速模式下跳过确认
        if (!rapidMode) {
            if (!confirm(`扫描到 ${uniqueLinks.length} 个商品，是否开始批量复制？\n当前模式: ${modeText}`)) {
                return;
            }
        }

        btn.innerText = '🚀 正在创建任务...';

        const shopName = document.title.split('-')[0].trim() || 'Zhengcaiyun Shop';

        const response = await fetchWithAuth('/api/copy/batch-create', {
            method: 'POST',
            body: JSON.stringify({
                productUrls: uniqueLinks,
                shopName: shopName,
                shopUrl: window.location.href,
                rapidMode: rapidMode // Pass flag to backend
            })
        });

        if (response.ok) {
            const res = await response.json();
            btn.innerText = `✅ 任务已创建 (${uniqueLinks.length}个)`;
            btn.style.background = '#52c41a';
            alert(`批量任务已创建！后台正在采集 ${uniqueLinks.length} 个商品。\n模式: ${modeText}\n请稍后在插件面板或后台查看进度。`);
        } else {
            throw new Error('Create task failed');
        }

    } catch (error) {
        console.error('[ZCY Batch] Error:', error);
        btn.innerText = '❌ 失败';
        btn.style.background = '#ff4d4f';
        alert(`批量复制失败: ${(error as Error).message}`);
    } finally {
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)';
            btn.disabled = false;
        }, 3000);
    }
}

const scrapeProductData = () => {
    const title = document.querySelector('h1, .product-title, .sku-name')?.textContent?.trim() || document.title;

    const images = Array.from(document.querySelectorAll('.gallery-img, .main-img, .swiper-slide img'))
        .map(img => (img as HTMLImageElement).src)
        .filter(src => src && !src.includes('avatar') && !src.includes('icon'))
        .slice(0, 5);

    const priceEl = document.querySelector('.price, .real-price, .sku-price');
    const price = priceEl?.textContent?.replace(/[^\d.]/g, '') || '0';

    const detailEl = document.querySelector('.detail-content, .product-detail, .intro-wrap');
    const detailHtml = detailEl ? detailEl.innerHTML : '';

    const attributes: Record<string, string> = {};
    const rows = document.querySelectorAll('.attr-list tr, .parameter-table tr, .attributes li');
    rows.forEach(row => {
        const text = row.textContent?.trim() || '';
        const parts = text.split(/[:：]/);
        if (parts.length >= 2) {
            attributes[parts[0].trim()] = parts[1].trim();
        }
    });

    return {
        title,
        images,
        price,
        detailHtml,
        attributes
    };
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScraper);
} else {
    initScraper();
}
