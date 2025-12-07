/**
 * 采集策略API - 服务端策略模式
 * POST /api/plugin/strategy
 * 
 * 所有采集逻辑保存在服务端，插件只是执行器
 */

import { NextRequest, NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';

// 策略加密密钥
const STRATEGY_SECRET = process.env.STRATEGY_SECRET || 'gravops-strategy-secret-key-2024';

// ============================================
// 京东采集策略
// ============================================
const JD_STRATEGY = {
  platform: 'jd',
  urlPatterns: ['item.jd.com', 'item.m.jd.com'],
  scripts: {
    getTitle: `
            var el = document.querySelector('.sku-name') || document.querySelector('.itemInfo-wrap h1') || document.querySelector('.p-name');
            if (el && el.textContent) return el.textContent.trim();
            var title = document.title.split('-')[0].split('【')[0].trim();
            return title || '';
        `,
    getPrice: `
            if (window.pageConfig && window.pageConfig.product && window.pageConfig.product.price) {
                return window.pageConfig.product.price;
            }
            var el = document.querySelector('.p-price .price');
            if (el) return el.textContent.replace('¥', '').trim();
            return '';
        `,
    getImages: `
            var images = [];
            var seen = {};
            
            // 从imageAndVideoJson获取
            if (window.imageAndVideoJson) {
                for (var i = 0; i < window.imageAndVideoJson.length; i++) {
                    var item = window.imageAndVideoJson[i];
                    if (item.type === 1 || !item.type) {
                        var url = item.img || item.imgUrl || '';
                        if (url.indexOf('//') === 0) url = 'https:' + url;
                        if (url && !seen[url]) {
                            seen[url] = true;
                            images.push(url);
                        }
                    }
                }
            }
            
            // DOM兜底
            if (images.length < 3) {
                var imgs = document.querySelectorAll('#spec-list li img, #spec-n1 img');
                for (var j = 0; j < imgs.length; j++) {
                    var img = imgs[j];
                    var url = img.getAttribute('data-url') || img.getAttribute('data-src') || img.src;
                    if (url) {
                        url = url.replace(/\\/n5\\//, '/n1/');
                        if (url.indexOf('//') === 0) url = 'https:' + url;
                        if (url.indexOf('360buyimg.com') > -1 && !seen[url]) {
                            seen[url] = true;
                            images.push(url);
                        }
                    }
                }
            }
            
            return images;
        `,
    getParams: `
            var params = [];
            var rows = document.querySelectorAll('.Ptable-item, .parameter2 tr');
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var labelEl = row.querySelector('th, dt, td:first-child');
                var valueEl = row.querySelector('td:last-child, dd');
                if (labelEl && valueEl) {
                    var label = labelEl.textContent.trim();
                    var value = valueEl.textContent.trim();
                    if (label && value && label !== value) {
                        params.push({ name: label, value: value });
                    }
                }
            }
            return params;
        `,
    getDetailImages: `
            var images = [];
            var seen = {};
            var imgs = document.querySelectorAll('#J-detail-content img, .detail-content img');
            for (var i = 0; i < imgs.length; i++) {
                var img = imgs[i];
                var url = img.getAttribute('data-lazyload') || img.src;
                if (url && url.indexOf('360buyimg.com') > -1 && !seen[url]) {
                    if (url.indexOf('//') === 0) url = 'https:' + url;
                    seen[url] = true;
                    images.push(url);
                }
            }
            return images;
        `
  }
};

// ============================================
// 天猫采集策略
// ============================================
const TMALL_STRATEGY = {
  platform: 'tmall',
  urlPatterns: ['detail.tmall.com', 'chaoshi.detail.tmall.com'],
  scripts: {
    getTitle: `
            var el = document.querySelector('[class*="ItemHeader--mainTitle"]') || document.querySelector('.tb-main-title');
            if (el && el.textContent) return el.textContent.trim();
            var title = document.title.split('-')[0].trim();
            return title || '';
        `,
    getPrice: `
            var el = document.querySelector('[class*="Price--priceText"]') || document.querySelector('.tm-promo-price');
            if (el) return el.textContent.replace('¥', '').trim();
            return '';
        `,
    getImages: `
            var images = [];
            var seen = {};
            
            var imgs = document.querySelectorAll('[class*="PicGallery--thumbnail"] img, #J_UlThumb li img');
            for (var i = 0; i < imgs.length; i++) {
                var img = imgs[i];
                var url = img.getAttribute('data-src') || img.src;
                if (url) {
                    url = url.replace(/_\\d+x\\d+\\.jpg/, '.jpg').replace('_60x60q90', '');
                    if (url.indexOf('//') === 0) url = 'https:' + url;
                    if (!seen[url]) {
                        seen[url] = true;
                        images.push(url);
                    }
                }
            }
            return images;
        `,
    getParams: `
            var params = [];
            var items = document.querySelectorAll('[class*="Attrs--item"]');
            for (var i = 0; i < items.length; i++) {
                var text = items[i].textContent.trim();
                if (text.indexOf(':') > -1 || text.indexOf('：') > -1) {
                    var parts = text.split(/[:：]/);
                    if (parts[0] && parts[1]) {
                        params.push({ name: parts[0].trim(), value: parts[1].trim() });
                    }
                }
            }
            return params;
        `,
    getDetailImages: `
            var images = [];
            var seen = {};
            var imgs = document.querySelectorAll('[class*="descV2-container"] img, #description img');
            for (var i = 0; i < imgs.length; i++) {
                var url = imgs[i].getAttribute('data-src') || imgs[i].src;
                if (url && !seen[url]) {
                    if (url.indexOf('//') === 0) url = 'https:' + url;
                    seen[url] = true;
                    images.push(url);
                }
            }
            return images;
        `
  }
};

// ============================================
// 苏宁采集策略
// ============================================
const SUNING_STRATEGY = {
  platform: 'suning',
  urlPatterns: ['product.suning.com', 'item.suning.com'],
  scripts: {
    getTitle: `
            var el = document.querySelector('#itemDisplayName') || document.querySelector('.proName h1');
            if (el && el.textContent) return el.textContent.trim();
            return document.title.split('-')[0].trim() || '';
        `,
    getPrice: `
            var el = document.querySelector('.mainprice .price') || document.querySelector('#itemPrice');
            if (el) return el.textContent.replace('¥', '').trim();
            return '';
        `,
    getImages: `
            var images = [];
            var seen = {};
            
            var bigImg = document.querySelector('#bigImg');
            if (bigImg) {
                var url = bigImg.getAttribute('data-original') || bigImg.src;
                if (url) {
                    if (url.indexOf('//') === 0) url = 'https:' + url;
                    images.push(url);
                    seen[url] = true;
                }
            }
            
            var imgs = document.querySelectorAll('.imgList li img');
            for (var i = 0; i < imgs.length; i++) {
                var url = imgs[i].getAttribute('data-original') || imgs[i].src;
                if (url) {
                    if (url.indexOf('//') === 0) url = 'https:' + url;
                    if (!seen[url]) {
                        seen[url] = true;
                        images.push(url);
                    }
                }
            }
            return images;
        `,
    getParams: `
            var params = [];
            var rows = document.querySelectorAll('.procon-table tr, #itemParameter li');
            for (var i = 0; i < rows.length; i++) {
                var row = rows[i];
                var labelEl = row.querySelector('th, .name');
                var valueEl = row.querySelector('td, .val');
                if (labelEl && valueEl) {
                    params.push({ name: labelEl.textContent.trim(), value: valueEl.textContent.trim() });
                }
            }
            return params;
        `,
    getDetailImages: `
            var images = [];
            var imgs = document.querySelectorAll('#procon_desc img');
            for (var i = 0; i < imgs.length; i++) {
                var url = imgs[i].src;
                if (url && url.indexOf('suning') > -1) {
                    if (url.indexOf('//') === 0) url = 'https:' + url;
                    images.push(url);
                }
            }
            return images;
        `
  }
};

// ============================================
// ZCY发布策略
// ============================================
const ZCY_PUBLISH_STRATEGY = {
  platform: 'zcy',
  urlPatterns: ['zcygov.cn/goods-center/goods'],
  categorySelect: {
    selectors: {
      level1: '.ant-cascader-menu:nth-child(1) .ant-cascader-menu-item',
      level2: '.ant-cascader-menu:nth-child(2) .ant-cascader-menu-item',
      level3: '.ant-cascader-menu:nth-child(3) .ant-cascader-menu-item',
    }
  },
  publish: {
    selectors: {
      title: 'input[name="goodsName"]',
      price: 'input[name="price"]',
      stock: 'input[name="stock"]',
    }
  }
};

// ============================================
// 所有策略汇总
// ============================================
const ALL_STRATEGIES = {
  jd: JD_STRATEGY,
  tmall: TMALL_STRATEGY,
  suning: SUNING_STRATEGY,
  zcy: ZCY_PUBLISH_STRATEGY
};

// 加密函数
function encryptStrategy(data: any): string {
  const jsonStr = JSON.stringify(data);
  return CryptoJS.AES.encrypt(jsonStr, STRATEGY_SECRET).toString();
}

// CORS头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, action } = body;

    let strategy: any = {};

    if (platform && ALL_STRATEGIES[platform as keyof typeof ALL_STRATEGIES]) {
      strategy = ALL_STRATEGIES[platform as keyof typeof ALL_STRATEGIES];
    } else if (action === 'all') {
      strategy = ALL_STRATEGIES;
    } else {
      strategy = {
        jd: JD_STRATEGY,
        tmall: TMALL_STRATEGY,
        suning: SUNING_STRATEGY
      };
    }

    const payload = {
      strategy,
      timestamp: Date.now(),
      expiresIn: 3600000
    };

    const encrypted = encryptStrategy(payload);

    return NextResponse.json({
      success: true,
      data: encrypted
    }, { headers: corsHeaders });

  } catch (error) {
    console.error('[Strategy] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500, headers: corsHeaders });
  }
}
