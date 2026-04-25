(() => {
  const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
  const text = (selector, root = document) => clean(root.querySelector(selector)?.textContent);
  const attr = (selector, name, root = document) => clean(root.querySelector(selector)?.getAttribute(name));

  const normalizeImage = (raw, bucket = 'n1') => {
    let url = String(raw || '').trim();
    if (!url || url.startsWith('data:')) return '';
    if (url.startsWith('//')) url = `https:${url}`;
    if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/${bucket}${url}`;
    if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/${bucket}/${url}`;
    if (/^s\d+x\d+_jfs\//i.test(url)) url = `https://img10.360buyimg.com/${bucket}/${url}`;
    try {
      url = new URL(url, location.href).href;
    } catch {
      return '';
    }
    if (!url.includes('360buyimg.com')) return '';
    if (url.includes('imagetools')) return '';
    url = url.replace(/^https:\/\/img\d+\.360buyimg\.com\//i, 'https://img10.360buyimg.com/');
    url = url.replace(/\.(avif|webp)$/i, '');

    if (bucket === 'sku') {
      if (url.includes('/pcpubliccms/')) return '';
      return url
        .replace(/\/s\d+x\d+_jfs\//gi, '/sku/jfs/')
        .replace(/\/s\d+x\d+_(jfs|t\d+)\//gi, '/$1/');
    }

    if (url.includes('/pcpubliccms/')) {
      return url.replace(/\/s\d+x\d+_jfs\//gi, '/s1440x1440_jfs/');
    }

    return url
      .replace(/\/s\d+x\d+_jfs\//gi, '/n1/jfs/')
      .replace(/\/s\d+x\d+_/gi, '/n1/')
      .replace(/\/n\d+\//gi, '/n1/');
  };

  const isDecorativeImage = (url) => {
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

  const urlPayloadSize = (url) => {
    const match = String(url || '').match(/\/(\d+)\/[^/]+\.(?:jpg|jpeg|png|gif)$/i);
    return match ? Number(match[1]) : 0;
  };

  const pushUnique = (list, seen, url) => {
    if (!url || seen.has(url) || isDecorativeImage(url)) return;
    seen.add(url);
    list.push(url);
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
    const name = attr('.label .text', 'title', item) || text('.label .text', item) || text('.label', item);
    const value = attr('.value', 'title', item) || text('.value .text', item) || text('.value', item);
    addParameter(name, value);
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
  const getParam = (names) => {
    for (const name of names) {
      if (attributes[name]) return attributes[name];
    }
    return '';
  };

  const specGroups = [];
  document.querySelectorAll('.specification-series-layout, .specification-group').forEach((group) => {
    const name = text('.layout-label', group) || text('.specification-group-label', group);
    if (!name) return;
    const optionDetails = Array.from(group.querySelectorAll('.specification-series-item, .specification-item-sku'))
      .map((item) => {
        const className = String(item.className || '');
        const rawName = clean(item.querySelector('.specification-series-item-text, .specification-item-sku-text')?.textContent || item.textContent);
        const img = item.querySelector('img');
        const image = normalizeImage(img?.getAttribute('src') || img?.getAttribute('data-src') || img?.currentSrc || '', 'n1');
        const disabled = /--disabled|--lack|lack|disabled|no-stock|out-of-stock/.test(className)
          || /无货|缺货|售罄/.test(rawName);
        return {
          name: clean(rawName.replace(/无货|缺货|售罄/g, '')),
          selected: className.includes('--selected') || className.includes('selected'),
          disabled,
          image
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
  const mainSelectors = [
    '.image-carousel-track img.image',
    '.image-carousel-track img',
    '#spec-list img',
    '#spec-n1 img',
    '.preview > img',
    '.preview #spec-list img',
    '.preview .spec-items img',
    '.preview .lh img',
    '#preview img'
  ].join(',');
  document.querySelectorAll(mainSelectors).forEach((img) => {
    const rect = img.getBoundingClientRect();
    const raw = img.getAttribute('data-url')
      || img.getAttribute('data-origin')
      || img.getAttribute('data-src')
      || img.getAttribute('data-lazy-img')
      || img.currentSrc
      || img.src;
    const url = normalizeImage(raw, 'n1');
    if (!url || isDecorativeImage(url)) return;
    if (rect.width > 0 && rect.height > 0 && (rect.width < 24 || rect.height < 24)) return;
    pushUnique(mainImages, mainSeen, url);
  });
  if (Array.isArray(window.imageAndVideoJson)) {
    window.imageAndVideoJson.forEach((item) => pushUnique(mainImages, mainSeen, normalizeImage(item?.img || item?.imgUrl || item?.url, 'n1')));
  }

  const addResourceImage = (raw) => {
    const url = normalizeImage(raw, 'n1');
    const lower = url.toLowerCase();
    if (!url || isDecorativeImage(url)) return;
    if (
      lower.includes('/n1/jfs/')
      || lower.includes('/n0/jfs/')
      || lower.includes('/n5/jfs/')
      || lower.includes('/sku/jfs/')
      || lower.includes('/pcpubliccms/')
    ) {
      pushUnique(resourceImages, resourceSeen, url);
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
    addResourceImage(raw);
  });

  if (performance?.getEntriesByType) {
    performance.getEntriesByType('resource').forEach((entry) => addResourceImage(entry.name));
  }

  if (mainImages.length === 0) {
    const resourceMainFirst = resourceImages
      .filter((url) => /\/(?:n0|n1|n5|sku|s1440x1440)_?\/?jfs\//i.test(url) || url.includes('/pcpubliccms/'));
    for (const url of [...resourceMainFirst, ...resourceImages]) {
      if (mainImages.length >= 12) break;
      pushUnique(mainImages, mainSeen, url);
    }
  }

  const detailImages = [];
  const detailSeen = new Set();
  const mainSet = new Set(mainImages);
  const detailContainers = [
    '#graphic-content',
    '#J-detail-content',
    '#J-detail',
    '#detail .tab-con',
    '#detail',
    '.tab-main',
    '.detail-main',
    '.detail-content',
    '.detail-content-wrap',
    '.detail-desc',
    '.goods-detail',
    '.product-detail',
    '.item-detail',
    '.ssd-module-detail',
    '.ssd-module-wrap'
  ];

  const addDetailFromImg = (img) => {
    const rect = img.getBoundingClientRect();
    const raw = img.getAttribute('data-lazyload')
      || img.getAttribute('data-src')
      || img.getAttribute('data-original')
      || img.currentSrc
      || img.src;
    const url = normalizeImage(raw, 'sku');
    const width = img.naturalWidth || rect.width || 0;
    const height = img.naturalHeight || rect.height || 0;
    const lower = url.toLowerCase();
    const size = urlPayloadSize(url);
    if (!url || detailSeen.has(url) || mainSet.has(url) || isDecorativeImage(url)) return;
    if (!(lower.includes('/sku/jfs/') || lower.includes('/imgzone/jfs/') || lower.includes('/img/jfs/'))) return;
    if (width && height && (width < 300 || height < 220)) return;
    if (size > 0 && size < 8000) return;
    pushUnique(detailImages, detailSeen, url);
  };

  const addDetailFromUrl = (raw, imageMeta = {}) => {
    const url = normalizeImage(raw, 'sku');
    const lower = url.toLowerCase();
    if (!url || detailSeen.has(url) || mainSet.has(url) || isDecorativeImage(url)) return;
    if (lower.includes('qrcode') || lower.includes('avatar') || lower.includes('/comment') || lower.includes('/shaidan/')) return;
    const size = urlPayloadSize(url);
    const width = Number(imageMeta.width || 0);
    const height = Number(imageMeta.height || 0);
    if (width && height && (width < 300 || height < 220)) return;
    if (size > 0 && size < 8000) return;
    if (
      lower.includes('/sku/jfs/')
      || lower.includes('/imgzone/jfs/')
      || lower.includes('/img/jfs/')
      || /\/s\d+x\d+_(?:jfs|t\d+)\//i.test(String(raw || ''))
    ) {
      pushUnique(detailImages, detailSeen, url);
    }
  };

  detailContainers.forEach((selector) => {
    const container = document.querySelector(selector);
    if (!container) return;
    container.querySelectorAll('img').forEach(addDetailFromImg);
  });

  if (detailImages.length < 3) {
    document.querySelectorAll('img').forEach((img) => {
      const rect = img.getBoundingClientRect();
      const width = img.naturalWidth || rect.width || 0;
      const height = img.naturalHeight || rect.height || 0;
      if (width < 300 || height < 220) return;
      addDetailFromUrl(
        img.getAttribute('data-lazyload')
          || img.getAttribute('data-src')
          || img.getAttribute('data-original')
          || img.currentSrc
          || img.src,
        { width, height }
      );
    });
  }

  if (mainImages.length === 0 && detailImages.length > 0) {
    detailImages.slice(0, 6).forEach((url) => pushUnique(mainImages, mainSeen, url));
  }

  const selectedSaleSpecs = specGroups
    .filter((group) => group.selected)
    .map((group) => ({ name: group.name, value: group.selected }));
  const selectedSpecMap = Object.fromEntries(selectedSaleSpecs.map((item) => [item.name, item.value]));
  const brand = getParam(['品牌']);
  const model = getParam(['型号', '商品型号', '货号']) || skuId;
  const categoryPath = Array.from(new Set(Array.from(document.querySelectorAll('.crumb .link, .crumb .item'))
    .map((item) => clean(item.textContent))
    .filter((item) => item && item !== '>')));

  const fallbackTitle = title || clean([
    brand,
    getParam(['商品名称', '品名']),
    model,
    skuId
  ].filter(Boolean).join(' '));

  return {
    title: fallbackTitle,
    price: '0',
    images: mainImages.slice(0, 12),
    detailImages: detailImages.slice(0, 60),
    detailHtml: detailImages.map((src) => `<p><img src="${src}" style="max-width:100%;" /></p>`).join('\n'),
    attributes,
    brand,
    model,
    categoryPath,
    shopName: '京东',
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
