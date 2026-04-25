(() => {
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const text = (selector, root = document) => clean(root.querySelector(selector)?.textContent);
  const attr = (selector, name, root = document) => clean(root.querySelector(selector)?.getAttribute(name));

  const rawDetailCaptures = Array.isArray(window.__gravopsDetailCaptures) ? window.__gravopsDetailCaptures : [];
  const detailCaptures = rawDetailCaptures.map((capture) => ({
    seq: capture.seq ?? capture.Seq ?? 0,
    url: capture.url ?? capture.Url ?? '',
    kind: capture.kind ?? capture.Kind ?? '',
    source: capture.source ?? capture.Source ?? '',
    contentType: capture.contentType ?? capture.ContentType ?? '',
    body: capture.body ?? capture.Body ?? ''
  }));
  const legacyNetworkImages = Array.isArray(window.__gravopsDetailNetworkImages) ? window.__gravopsDetailNetworkImages : [];

  const detailContainerSelectors = [
    '#graphic-content',
    '#J-detail-content',
    '#detail',
    '.detail-content',
    '.ssd-module-detail',
    '.ssd-module-wrap',
    '.ssd-module',
    '.p-parameter',
    '.detail'
  ];

  const normalizeImage = (raw, mode = 'main') => {
    let url = String(raw || '').trim().replace(/^url\(["']?|["']?\)$/g, '');
    if (!url || url.startsWith('data:') || url === 'about:blank') return '';
    url = url.replace(/\\\//g, '/').replace(/&amp;/g, '&');
    if (url.startsWith('//')) url = `https:${url}`;
    if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/${mode === 'main' ? 'n1' : 'sku'}${url}`;
    if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/${mode === 'main' ? 'n1' : 'sku'}/${url}`;
    if (/^s\d+x\d+_jfs\//i.test(url)) url = `https://img10.360buyimg.com/${mode === 'main' ? 'n1' : 'sku'}/${url}`;
    try {
      url = new URL(url, location.href).href;
    } catch {
      return '';
    }
    if (!/360buyimg\.com/i.test(url)) return '';
    url = url
      .replace(/^http:/i, 'https:')
      .replace(/^https:\/\/img\d+\.360buyimg\.com\//i, 'https://img10.360buyimg.com/')
      .replace(/\.(avif|webp)(?=$|\?)/i, '');

    if (url.includes('/pcpubliccms/')) {
      return url.replace(/\/s\d+x\d+_jfs\//gi, '/s1440x1440_jfs/');
    }

    if (mode === 'main') {
      return url
        .replace(/\/s\d+x\d+_jfs\//gi, '/n1/jfs/')
        .replace(/\/s\d+x\d+_/gi, '/n1/')
        .replace(/\/n\d+\//gi, '/n1/');
    }

    return url
      .replace(/\/sku\/sku\/jfs\//gi, '/sku/jfs/')
      .replace(/\/n\d+\/sku\/jfs\//gi, '/sku/jfs/')
      .replace(/\/s\d+x\d+_jfs\//gi, '/sku/jfs/')
      .replace(/\/s\d+x\d+_(jfs|t\d+)\//gi, '/$1/');
  };

  const canonicalImageKey = (url) => normalizeImage(url, 'detail')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/s\d+x\d+_jfs\//g, '/jfs/')
    .replace(/\/(?:n0|n1|n2|n5|n7|n9|sku)\/jfs\//g, '/jfs/')
    .replace(/[?#].*$/, '');

  const urlPayloadSize = (url) => {
    try {
      const parts = new URL(String(url || ''), location.href).pathname.split('/').filter(Boolean);
      const fileIndex = parts.findIndex((part) => /\.(?:jpg|jpeg|png|gif)$/i.test(part));
      const beforeFile = fileIndex >= 0 ? parts.slice(0, fileIndex) : parts;
      for (let i = beforeFile.length - 1; i >= 0; i -= 1) {
        if (/^\d+$/.test(beforeFile[i])) return Number(beforeFile[i]);
      }
    } catch {
      const match = String(url || '').match(/\/(\d+)\/[^/]+\.(?:jpg|jpeg|png|gif)$/i);
      if (match) return Number(match[1]);
    }
    return 0;
  };

  const imagePathRules = (url) => {
    const lower = String(url || '').toLowerCase();
    const rules = [];
    if (lower.includes('/sku/jfs/')) rules.push('/sku/jfs/');
    if (lower.includes('/imgzone/jfs/')) rules.push('/imgzone/jfs/');
    if (lower.includes('/img/jfs/')) rules.push('/img/jfs/');
    if (lower.includes('/popwatermark/')) rules.push('/popWaterMark/');
    if (lower.includes('/pcpubliccms/')) rules.push('pcpubliccms');
    if (lower.includes('/jfs/')) rules.push('jfs/');
    return rules;
  };

  const collectUrlLikeValues = (value) => {
    const textValue = String(value || '').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    const urls = [];
    const patterns = [
      /https?:\/\/[^"'\\\s<>]+(?:jpg|jpeg|png|gif)(?:\?[^"'\\\s<>]*)?/gi,
      /\/\/[^"'\\\s<>]+(?:jpg|jpeg|png|gif)(?:\?[^"'\\\s<>]*)?/gi,
      /(?:^|["'\s(])((?:\/?jfs\/|s\d+x\d+_jfs\/)[^"'\\\s<>]+(?:jpg|jpeg|png|gif)(?:\?[^"'\\\s<>]*)?)/gi
    ];
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(textValue))) {
        urls.push(match[1] || match[0]);
      }
    }
    return urls;
  };

  const parseSrcset = (srcset) => String(srcset || '')
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean);

  const sourceBaseScore = {
    detail_html: 100,
    detail_dom: 90,
    network_detail: 70,
    network_image: 35
  };

  const candidates = [];
  const addCandidate = (rawUrl, source, meta = {}) => {
    const url = normalizeImage(rawUrl, source === 'network_image' || source === 'detail_dom' || source === 'detail_html' ? 'detail' : 'main');
    if (!url) return;
    const rules = imagePathRules(url);
    const payloadSize = urlPayloadSize(url);
    const score = (sourceBaseScore[source] || 0)
      + rules.length * 5
      + (payloadSize >= 8000 ? 5 : 0)
      + (payloadSize >= 80000 ? 5 : 0);
    candidates.push({
      url,
      source,
      order: candidates.length,
      sourceUrl: meta.sourceUrl || '',
      width: Number(meta.width || 0),
      height: Number(meta.height || 0),
      score,
      hitRules: rules,
      payloadSize
    });
  };

  const sourceUrl = location.href;
  const skuId = sourceUrl.match(/item\.jd\.com\/(\d+)\.html/)?.[1] || '';
  const title = text('.sku-title-name')
    || text('.sku-title-text')
    || text('.page-right-skuname')
    || text('.itemInfo-wrap .sku-name')
    || text('.product-intro .name')
    || text('h1')
    || clean(document.title.replace(/\u3010.*?\u3011|京东JD\.COM.*$/g, ''));

  const parameters = [];
  const seenParams = new Set();
  const addParameter = (name, value) => {
    name = clean(name).replace(/[：:]\s*$/, '');
    value = clean(value);
    if (!name || !value || name === value) return;
    const key = `${name}\u0000${value}`;
    if (seenParams.has(key)) return;
    seenParams.add(key);
    parameters.push({ name, value });
  };

  document.querySelectorAll('.attrs .item, .attribute .item').forEach((item) => {
    addParameter(
      attr('.label .text', 'title', item) || text('.label .text', item) || text('.label', item),
      attr('.value', 'title', item) || text('.value .text', item) || text('.value', item)
    );
  });

  document.querySelectorAll('#parameter-brand li, #parameter2 li, .parameter2 li, .p-parameter-list li, .p-parameter li').forEach((item) => {
    const raw = clean(item.textContent);
    const match = raw.match(/^(.+?)[：:\s]\s*(.+)$/);
    if (match) addParameter(match[1], match[2]);
  });

  document.querySelectorAll('.Ptable .Ptable-item dl, #detail dl, .detail-list dl').forEach((item) => {
    addParameter(text('dt', item), text('dd:not(.Ptable-tips)', item) || text('dd', item));
  });

  const attributes = Object.fromEntries(parameters.map((item) => [item.name, item.value]));
  const getParam = (names) => names.map((name) => attributes[name]).find(Boolean) || '';

  const specGroups = [];
  document.querySelectorAll('.specification-series-layout, .specification-group').forEach((group) => {
    const name = text('.layout-label', group) || text('.specification-group-label', group);
    if (!name) return;
    const optionDetails = Array.from(group.querySelectorAll('.specification-series-item, .specification-item-sku'))
      .map((item) => {
        const className = String(item.className || '');
        const rawName = clean(item.querySelector('.specification-series-item-text, .specification-item-sku-text')?.textContent || item.textContent);
        const img = item.querySelector('img');
        return {
          name: clean(rawName.replace(/无货|缺货|售罄/g, '')),
          selected: className.includes('--selected') || className.includes('selected'),
          disabled: /--disabled|--lack|lack|disabled|no-stock|out-of-stock/.test(className) || /无货|缺货|售罄/.test(rawName),
          image: normalizeImage(img?.getAttribute('src') || img?.getAttribute('data-src') || img?.currentSrc || '', 'main')
        };
      })
      .filter((item) => item.name);
    if (!optionDetails.length) return;
    specGroups.push({
      name: clean(name),
      selected: optionDetails.find((item) => item.selected)?.name || '',
      options: optionDetails.map((item) => item.name),
      optionDetails
    });
  });

  const mainImages = [];
  const mainSeen = new Set();
  const resourceImages = [];
  const resourceSeen = new Set();
  const isDecorativeMainImage = (url) => {
    const lower = String(url || '').toLowerCase();
    return !lower
      || lower.includes('logo')
      || lower.includes('avatar')
      || lower.includes('qrcode')
      || lower.includes('sprite')
      || lower.includes('icon')
      || lower.includes('joy')
      || lower.includes('/comment')
      || lower.includes('/shaidan/')
      || lower.includes('/user/')
      || lower.includes('/shop/')
      || lower.includes('/popshop/')
      || lower.includes('/babel/')
      || lower.includes('/common/');
  };
  const isLikelyRealMainImage = (url, minPayload = 8000) => {
    const lower = String(url || '').toLowerCase();
    if (!lower.match(/\.(jpg|jpeg|png|gif)(?:$|\?)/)) return false;
    const size = urlPayloadSize(url);
    return size === 0 || size >= minPayload;
  };
  const pushMainUnique = (list, seen, url) => {
    if (!url || seen.has(url) || isDecorativeMainImage(url)) return;
    seen.add(url);
    list.push(url);
  };
  const addMain = (raw) => {
    const url = normalizeImage(raw, 'main');
    if (!url || mainSeen.has(url) || isDecorativeMainImage(url) || !isLikelyRealMainImage(url, 8000)) return;
    const lower = url.toLowerCase();
    if (lower.includes('/sku/jfs/') || lower.includes('/n1/sku/jfs/')) return;
    pushMainUnique(mainImages, mainSeen, url);
  };
  document.querySelectorAll([
    '.image-carousel-track img.image',
    '.image-carousel-track img',
    '#spec-list img',
    '#spec-n1 img',
    '.preview > img',
    '.preview #spec-list img',
    '.preview .spec-items img',
    '.preview .lh img',
    '#preview img'
  ].join(',')).forEach((img) => {
    addMain(img.getAttribute('data-url')
      || img.getAttribute('data-origin')
      || img.getAttribute('data-src')
      || img.getAttribute('data-lazy-img')
      || img.currentSrc
      || img.src);
  });
  if (!mainImages.length && Array.isArray(window.imageAndVideoJson)) {
    window.imageAndVideoJson.forEach((item) => addMain(item?.img || item?.imgUrl || item?.url));
  }

  const addResourceMainImage = (raw) => {
    const url = normalizeImage(raw, 'main');
    const lower = url.toLowerCase();
    if (!url || isDecorativeMainImage(url) || !isLikelyRealMainImage(url, 8000)) return;
    if (
      lower.includes('/n1/jfs/')
      || lower.includes('/n0/jfs/')
      || lower.includes('/n5/jfs/')
      || lower.includes('/pcpubliccms/')
    ) {
      pushMainUnique(resourceImages, resourceSeen, url);
    }
  };

  document.querySelectorAll('img').forEach((img) => {
    const rect = img.getBoundingClientRect();
    const raw = img.getAttribute('data-url')
      || img.getAttribute('data-origin')
      || img.getAttribute('data-src')
      || img.getAttribute('data-lazy-img')
      || img.getAttribute('data-lazyload')
      || img.getAttribute('data-original')
      || img.getAttribute('src')
      || img.currentSrc;
    const width = img.naturalWidth || rect.width || 0;
    const height = img.naturalHeight || rect.height || 0;
    if (width && height && (width < 70 || height < 70)) return;
    addResourceMainImage(raw);
  });

  if (performance?.getEntriesByType) {
    performance.getEntriesByType('resource').forEach((entry) => addResourceMainImage(entry.name));
  }

  if (mainImages.length === 0) {
    const resourceMainFirst = resourceImages
      .filter((url) => /\/(?:n0|n1|n5|s1440x1440)_?\/?jfs\//i.test(url) || url.includes('/pcpubliccms/'));
    for (const url of [...resourceMainFirst, ...resourceImages]) {
      if (mainImages.length >= 12) break;
      pushMainUnique(mainImages, mainSeen, url);
    }
  }

  const mainKeys = new Set(mainImages.map(canonicalImageKey));

  const detailHtmlBodies = detailCaptures
    .filter((capture) => capture?.source === 'detail_html' && capture.body)
    .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0));
  detailHtmlBodies.forEach((capture) => {
    collectUrlLikeValues(capture.body).forEach((url) => addCandidate(url, 'detail_html', { sourceUrl: capture.url }));
  });

  const detailContainers = detailContainerSelectors
    .map((selector) => document.querySelector(selector))
    .filter(Boolean);
  detailContainers.forEach((container) => {
    container.querySelectorAll('img').forEach((img) => {
      const rect = img.getBoundingClientRect();
      [
        img.src,
        img.currentSrc,
        img.dataset?.src,
        img.dataset?.lazyload,
        img.dataset?.original,
        img.getAttribute('data-src'),
        img.getAttribute('data-lazyload'),
        img.getAttribute('data-original'),
        img.getAttribute('data-url'),
        img.getAttribute('data-origin')
      ].filter(Boolean).forEach((url) => addCandidate(url, 'detail_dom', {
        width: img.naturalWidth || rect.width,
        height: img.naturalHeight || rect.height
      }));
    });
    container.querySelectorAll('source').forEach((source) => {
      parseSrcset(source.srcset || source.getAttribute('srcset')).forEach((url) => addCandidate(url, 'detail_dom'));
    });
    container.querySelectorAll('[style*="url("]').forEach((node) => {
      collectUrlLikeValues(node.getAttribute('style')).forEach((url) => addCandidate(url, 'detail_dom'));
    });
  });

  detailCaptures
    .filter((capture) => capture?.source === 'network_image')
    .sort((a, b) => Number(a.seq || 0) - Number(b.seq || 0))
    .forEach((capture) => addCandidate(capture.url, 'network_image', { sourceUrl: capture.url }));
  legacyNetworkImages.forEach((url) => addCandidate(url, 'network_image', { sourceUrl: url }));

  const filterCandidate = (item) => {
    const reasons = [];
    const lower = item.url.toLowerCase();
    let host = '';
    try {
      host = new URL(item.url).hostname.toLowerCase();
    } catch {
      host = '';
    }
    if (!/\.(jpg|jpeg|png|gif)(?:$|\?)/i.test(new URL(item.url).pathname)) reasons.push('not-image-extension');
    if (mainKeys.has(canonicalImageKey(item.url))) reasons.push('same-as-main-image');
    if (/logo|avatar|qrcode|sprite|icon|joy|loading|refresh_loading|plus|crown/i.test(lower)) reasons.push('decorative');
    if (/\/comment|\/shaidan\/|getavatar|\/user\/|\/shop\/|\/popshop\/|\/babel\/|\/common\/|\/uba\/|\/misc\/|retail-mall|mall-common-component|imagetools/i.test(lower)) reasons.push('comment-shop-common-or-ui');
    if (host === 'storage.360buyimg.com' || host === 'misc.360buyimg.com') reasons.push('non-product-cdn');
    if (host === 'm.360buyimg.com' && !lower.includes('/sku/jfs/') && !lower.includes('/img/jfs/') && !lower.includes('/imgzone/jfs/')) reasons.push('mobile-ad-or-ui');
    if (item.width && item.height && (item.width < 120 || item.height < 120)) reasons.push('too-small-dom');
    if (item.payloadSize > 0 && item.payloadSize < 5000) reasons.push('too-small-payload');
    if (!item.hitRules.length && item.source === 'network_image') reasons.push('weak-network-path');
    if (item.source === 'detail_html'
      && !/detail|desc|description|graphic|content|ssd|sku|imgzone|\/img\/jfs\//i.test(`${item.sourceUrl} ${item.url}`)) {
      reasons.push('weak-detail-html-context');
    }
    return reasons;
  };

  const perImageDebug = [];
  const byKey = new Map();
  for (const item of candidates) {
    const reasons = filterCandidate(item);
    const kept = reasons.length === 0;
    perImageDebug.push({
      url: item.url,
      source: item.source,
      kept,
      filterReason: reasons,
      width: item.width,
      height: item.height,
      hitRules: item.hitRules,
      score: item.score,
      sourceUrl: item.sourceUrl
    });
    if (!kept) continue;
    const key = canonicalImageKey(item.url);
    const previous = byKey.get(key);
    if (!previous || item.score > previous.score || item.payloadSize > previous.payloadSize) {
      byKey.set(key, item);
    }
  }

  const sourceRank = { detail_html: 0, detail_dom: 1, network_image: 2 };
  const detailImages = Array.from(byKey.values())
    .sort((a, b) => (sourceRank[a.source] ?? 9) - (sourceRank[b.source] ?? 9) || a.order - b.order)
    .map((item) => item.url)
    .slice(0, 60);

  const selectedSaleSpecs = specGroups
    .filter((group) => group.selected)
    .map((group) => ({ name: group.name, value: group.selected }));
  const selectedSpecMap = Object.fromEntries(selectedSaleSpecs.map((item) => [item.name, item.value]));
  const brand = getParam(['品牌']);
  const model = getParam(['型号', '商品型号', '货号']) || skuId;
  const itemNo = getParam(['货号']);
  const categoryPath = Array.from(new Set(Array.from(document.querySelectorAll('.crumb .link, .crumb .item'))
    .map((item) => clean(item.textContent))
    .filter((item) => item && item !== '>')));

  const detailText = [
    ...detailContainers.map((node) => clean(node.textContent)),
    ...detailHtmlBodies.map((capture) => clean(capture.body))
  ].join('\n');
  const expectedCodes = new Set([itemNo, model, ...selectedSaleSpecs.map((item) => item.value)].filter(Boolean));
  const foundCodes = Array.from(new Set((detailText.match(/\b[A-Z]{1,5}\d{3,8}\b/g) || [])));
  const mismatchCodes = foundCodes.filter((code) => expectedCodes.size && !expectedCodes.has(code));
  const warnings = [];
  if (mismatchCodes.length) {
    warnings.push(`detail-code-mismatch: expected=${Array.from(expectedCodes).join('|')} found=${mismatchCodes.join('|')}`);
  }

  const debug = {
    skuId,
    itemNo,
    model,
    title,
    mainImageCount: mainImages.length,
    detailHtmlImageCount: candidates.filter((item) => item.source === 'detail_html').length,
    detailDomImageCount: candidates.filter((item) => item.source === 'detail_dom').length,
    networkImageCount: candidates.filter((item) => item.source === 'network_image').length,
    finalDetailImageCount: detailImages.length,
    filteredImageCount: perImageDebug.filter((item) => !item.kept).length,
    warnings,
    images: perImageDebug
  };

  return {
    title: title || clean([brand, getParam(['商品名称', '品名']), model, skuId].filter(Boolean).join(' ')),
    price: '0',
    images: mainImages.slice(0, 12),
    detailImages,
    detailHtml: detailImages.map((src) => `<p><img src="${src.replace(/"/g, '&quot;')}" style="max-width:100%;" /></p>`).join('\n'),
    attributes,
    brand,
    model,
    categoryPath,
    shopName: '京东',
    debug,
    skuData: {
      price: '0',
      stock: '99',
      skuId,
      model,
      specs: Object.keys(selectedSpecMap).length ? selectedSpecMap : attributes,
      specGroups,
      selectedSaleSpecs,
      skuSpecs: specGroups.map((group) => ({ name: group.name, values: group.options })),
      skuList: [{
        skuId: skuId || 'default',
        model: model || 'default',
        price: 0,
        stock: '99',
        specs: Object.keys(selectedSpecMap).length ? selectedSpecMap : attributes
      }]
    },
    sourceUrl
  };
})()
