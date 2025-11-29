const COLORS = {
    IDLE: '#999',
    PRODUCT: '#1677ff',
    SHOP: '#722ed1',
    PICKER: '#52c41a'
};

let currentState = 'IDLE';
let detectedLinks = [];
let isPickerMode = false;

const dot = document.createElement('div');
dot.id = 'zcy-status-dot';
dot.style.cssText = `
    position: fixed; bottom: 100px; right: 20px; width: 40px; height: 40px;
    background: ${COLORS.IDLE}; border-radius: 50%; box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    z-index: 2147483647; cursor: pointer; transition: all 0.3s;
    display: flex; align-items: center; justify-content: center; color: white; font-size: 20px;
`;
dot.innerHTML = '⚡';
document.body.appendChild(dot);

const menu = document.createElement('div');
menu.style.cssText = `
    position: fixed; bottom: 150px; right: 20px; background: white; padding: 10px;
    border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 2147483647;
    display: none; flex-direction: column; gap: 8px; min-width: 160px;
`;
document.body.appendChild(menu);

dot.onclick = () => {
    if (isPickerMode) exitPickerMode();
    else {
        menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
        updateMenu();
    }
};

function checkPage() {
    if (isPickerMode) return;
    const url = location.href;
    const isProduct = url.includes('/product/') || document.querySelector('.product-title');
    const isCategoryPage = url.includes('category') || url.includes('publish') || url.includes('goods');
    const links = Array.from(document.querySelectorAll('a'));
    const productLinks = links.filter(a => a.href && (a.href.includes('/product/') || a.href.includes('detail')));

    if (isProduct) setState('PRODUCT');
    else if (isCategoryPage) setState('SNIFFER');
    else if (productLinks.length >= 1) { detectedLinks = productLinks; setState('SHOP'); }
    else setState('IDLE');
}

function setState(state) {
    currentState = state;
    if (state === 'SNIFFER') {
        dot.style.background = '#faad14';
        dot.innerHTML = '📡';
    } else {
        dot.style.background = COLORS[state] || COLORS.IDLE;
        dot.innerHTML = state === 'PICKER' ? '👆' : '⚡';
    }
}

function updateMenu() {
    menu.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:12px;color:#666;margin-bottom:4px;border-bottom:1px solid #eee;padding-bottom:4px;';
    title.innerText = `状态: ${currentState}`;
    menu.appendChild(title);

    if (currentState === 'PRODUCT') {
        menu.appendChild(createBtn('📦 复制当前商品', COLORS.PRODUCT, () => handleProductCopy(document)));
    } else if (currentState === 'SHOP') {
        menu.appendChild(createBtn(`🏪 整店复制 (${detectedLinks.length})`, COLORS.SHOP, () => handleShopCopy(detectedLinks)));
        menu.appendChild(createBtn('👆 点选复制模式', COLORS.PICKER, enterPickerMode));
    } else if (currentState === 'SNIFFER') {
        const info = document.createElement('div');
        info.style.cssText = 'font-size:12px;color:#666;padding:4px;margin-bottom:4px;';
        info.innerText = '正在监听类目数据...\n若无自动下载，请点击下方按钮：';
        menu.appendChild(info);
        menu.appendChild(createBtn('🔍 一键内存提取', '#52c41a', extractFromMemory));
        menu.appendChild(createBtn('📸 强制提取屏幕类目', '#faad14', extractFromDOM));
    } else {
        menu.appendChild(createBtn('强制扫描', '#faad14', forceScan));
    }
}

function createBtn(text, color, onClick) {
    const btn = document.createElement('button');
    btn.innerText = text;
    btn.style.cssText = `padding:8px 12px;background:${color};color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;`;
    btn.onclick = async () => {
        if (text.includes('模式')) { onClick(); return; }
        const originalText = btn.innerText;
        btn.innerText = '执行中...';
        try {
            await onClick();
            if (!text.includes('提取') && !text.includes('内存')) {
                btn.innerText = '✅ 成功';
                setTimeout(() => btn.innerText = originalText, 2000);
            }
        } catch (e) {
            alert('失败: ' + e.message);
            btn.innerText = '❌ 失败';
            setTimeout(() => btn.innerText = originalText, 2000);
        }
    };
    return btn;
}

function extractFromMemory() {
    let found = null;

    // Scan window
    for (let key in window) {
        try {
            if (typeof window[key] === 'object' && window[key]) {
                const str = JSON.stringify(window[key]);
                if (str.includes('children') && str.includes('name') && str.length > 5000) {
                    found = window[key]; break;
                }
            }
        } catch (e) { }
    }

    // Scan localStorage
    if (!found) {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            const val = localStorage.getItem(key);
            if (val && val.includes('children') && val.length > 5000) {
                try { found = JSON.parse(val); break; } catch (e) { }
            }
        }
    }

    // Scan sessionStorage
    if (!found) {
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            const val = sessionStorage.getItem(key);
            if (val && val.includes('children') && val.length > 5000) {
                try { found = JSON.parse(val); break; } catch (e) { }
            }
        }
    }

    if (found) {
        chrome.runtime.sendMessage({
            action: 'download_category_json',
            data: { source: 'MEMORY_EXTRACT', data: found },
            url: window.location.href
        });
        const btn = Array.from(menu.querySelectorAll('button')).find(b => b.innerText.includes('内存'));
        if (btn) btn.innerText = '✅ 内存提取成功！';
    } else {
        alert('未在内存中找到类目数据。\n请确保页面已完全加载。');
    }
}

function extractFromDOM() {
    const lists = [];
    document.querySelectorAll('ul').forEach(ul => {
        const items = Array.from(ul.querySelectorAll('li')).map(li => li.innerText.trim()).filter(t => t);
        if (items.length > 3) lists.push({ type: 'ul', count: items.length, items });
    });

    const allDivs = document.querySelectorAll('div');
    allDivs.forEach(div => {
        if (div.children.length > 5 && div.innerText.length < 5000) {
            const childTag = div.children[0].tagName;
            const sameTagCount = Array.from(div.children).filter(c => c.tagName === childTag).length;
            if (sameTagCount / div.children.length > 0.8) {
                const items = Array.from(div.children).map(c => c.innerText.split('\n')[0].trim()).filter(t => t.length > 1 && t.length < 50);
                if (items.length > 5) lists.push({ type: 'div-list', tag: childTag, count: items.length, items });
            }
        }
    });

    if (lists.length === 0) {
        alert('未在页面上检测到明显的列表数据。');
        return;
    }

    chrome.runtime.sendMessage({
        action: 'download_category_json',
        data: { source: 'DOM_EXTRACT', extractedLists: lists },
        url: window.location.href
    });

    const btn = Array.from(menu.querySelectorAll('button')).find(b => b.innerText.includes('屏幕'));
    if (btn) btn.innerText = `✅ 已提取 ${lists.length} 组`;
}

function enterPickerMode() {
    isPickerMode = true;
    menu.style.display = 'none';
    dot.style.background = COLORS.PICKER;
    dot.innerHTML = '👆';
    detectedLinks.forEach(a => {
        a.dataset.originalBorder = a.style.border;
        a.style.border = '2px solid #52c41a';
        a.style.boxShadow = '0 0 5px #52c41a';
        a.style.cursor = 'copy';
        a.addEventListener('click', handlePickerClick, true);
    });
    showToast('已进入点选模式：点击任意商品链接即可复制');
}

function exitPickerMode() {
    isPickerMode = false;
    dot.innerHTML = '⚡';
    checkPage();
    detectedLinks.forEach(a => {
        a.style.border = a.dataset.originalBorder || '';
        a.style.boxShadow = '';
        a.style.cursor = '';
        a.removeEventListener('click', handlePickerClick, true);
    });
    showToast('已退出点选模式');
}

async function handlePickerClick(e) {
    e.preventDefault();
    e.stopPropagation();
    const link = e.currentTarget;
    const url = link.href;
    showToast('正在抓取: ' + url);
    try {
        const res = await fetch(url);
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        await handleProductCopy(doc, url);
        showToast('✅ 复制成功！');
        link.style.border = '2px solid #1677ff';
    } catch (err) {
        console.error(err);
        showToast('❌ 失败: ' + err.message);
    }
}

const script = document.createElement('script');
script.src = chrome.runtime.getURL('sniffer.js');
script.onload = function () { this.remove(); };
(document.head || document.documentElement).appendChild(script);

window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (event.data.type && event.data.type === 'ZCY_CATEGORY_DATA_CAPTURED') {
        console.log('Content Script received Category Data:', event.data);
        const data = event.data.data;
        const isLikelyCategory = JSON.stringify(data).includes('children') || JSON.stringify(data).includes('name');
        if (isLikelyCategory) {
            chrome.runtime.sendMessage({
                action: 'download_category_json',
                data: data,
                url: event.data.url
            });
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;top:20px;right:20px;background:#52c41a;color:white;padding:10px 20px;border-radius:4px;z-index:999999;box-shadow:0 4px 12px rgba(0,0,0,0.15);';
            toast.innerText = '✅ 成功捕获政采云类目数据！';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        }
    }
});

function showToast(msg) {
    let toast = document.getElementById('zcy-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'zcy-toast';
        toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.8);color:white;padding:10px 20px;border-radius:20px;z-index:2147483647;font-size:14px;';
        document.body.appendChild(toast);
    }
    toast.innerText = msg;
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

async function handleProductCopy(doc, url = window.location.href) {
    const title = doc.querySelector('.product-title, h1')?.textContent?.trim() || doc.title;
    let images = Array.from(doc.querySelectorAll('img')).map(img => img.src);
    images = images.map(src => new URL(src, url).href);
    images = images.filter(src => !src.includes('avatar') && !src.includes('icon') && (src.includes('jpg') || src.includes('png')));
    const response = await fetch('http://localhost:3000/api/copy/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            originalUrl: url, title, images: [...new Set(images)].slice(0, 15),
            attributes: {}, detailHtml: '', skuData: { price: '0', stock: '999', specs: [] },
            shopName: 'Unknown', userId: 'demo-user'
        })
    });
    if (!response.ok) throw new Error('保存失败');
}

async function handleShopCopy(links) {
    const uniqueLinks = [...new Set(links.map(a => a.href))];
    const response = await fetch('http://localhost:3000/api/copy/batch-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            shopUrl: window.location.href, shopName: document.title,
            productUrls: uniqueLinks, userId: 'demo-user'
        })
    });
    if (!response.ok) throw new Error('创建任务失败');
    alert(`已创建 ${uniqueLinks.length} 个商品的复制任务`);
}

function forceScan() {
    const links = Array.from(document.querySelectorAll('a'));
    const pLinks = links.filter(a => a.href && (a.href.includes('/product/') || a.href.includes('detail')));
    if (pLinks.length > 0) {
        detectedLinks = pLinks;
        setState('SHOP');
        updateMenu();
    } else {
        alert('未找到任何商品链接');
    }
}

setInterval(checkPage, 1000);
checkPage();
