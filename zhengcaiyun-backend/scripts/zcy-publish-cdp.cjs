const fs = require('fs');
const os = require('os');
const nodePath = require('path');
const { chromium } = require('playwright');

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const TEXT = {
  officeConsumables: '\u529e\u516c\u8bbe\u5907/\u8017\u6750',
  officeDevices: '\u529e\u516c\u8bbe\u5907',
  consumables: '\u8017\u6750',
  hardwareTools: '\u4e94\u91d1/\u5de5\u5177',
  hardware: '\u4e94\u91d1',
  tools: '\u5de5\u5177',
  brand: '\u54c1\u724c',
  model: '\u578b\u53f7',
  next: '\u4e0b\u4e00\u6b65',
  reset: '\u91cd\u7f6e',
  backToEdit: '\u8fd4\u56de\u4fee\u6539',
  confirm: '\u786e\u5b9a',
  cancel: '\u53d6\u6d88',
  chooseMarket: '\u9009\u62e9\u5356\u573a',
  modify: '\u4fee\u6539',
  chooseMarketTitle: '\u9009\u62e9\u4e0a\u67b6\u7684\u7535\u5b50\u5356\u573a',
  onlineMarket: '\u7f51\u4e0a\u8d85\u5e02',
  bidPrefix: '\u6807\u9879\u540d\u79f0',
};

const port = Number(arg('--port', process.env.ZCY_CDP_PORT || '9223'));
const payloadPath = arg('--payload', '');
const scanOptionsOnly = process.argv.includes('--scan-options');
if (!payloadPath && !scanOptionsOnly) throw new Error('Missing --payload');
const CATEGORY_ITEM_SELECTOR = 'li, [role="treeitem"], .category-item, .el-cascader-node';
const BACKEND_URL = process.env.GRAVOPS_BACKEND_URL || 'http://localhost:3000';
const phaseStarts = new Map();

function startPhase(name) {
  phaseStarts.set(name, Date.now());
  console.log(`[ZCY-CDP] phase start: ${name}`);
}

function endPhase(name) {
  const started = phaseStarts.get(name);
  const elapsed = started ? Date.now() - started : 0;
  console.log(`[ZCY-CDP] phase end: ${name} ${elapsed}ms`);
  phaseStarts.delete(name);
}

function readPayload(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

const payload = payloadPath ? readPayload(payloadPath) : {};

function normalize(text) {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/[()（）]/g, '')
    .trim()
    .toLowerCase();
}

function normalizeCategoryPath(path) {
  const parts = (Array.isArray(path) ? path : [])
    .map(String)
    .map(s => s.trim())
    .filter(Boolean);

  if (parts.length >= 2 && parts[0] === TEXT.officeDevices && parts[1] === TEXT.consumables) {
    return [TEXT.officeConsumables, ...parts.slice(2)];
  }
  if (parts.length >= 2 && parts[0] === TEXT.hardware && parts[1] === TEXT.tools) {
    return [TEXT.hardwareTools, ...parts.slice(2)];
  }
  return parts.map(part => part === '\u4e94\u91d1\u914d\u4ef6' ? '\u4e94\u91d1\u914d\u9644\u4ef6' : part);
}

function parseStoredPath(value) {
  if (!value) return [];
  if (Array.isArray(value)) return normalizeCategoryPath(value);
  const text = String(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return normalizeCategoryPath(parsed);
  } catch {}
  if (text.includes('>')) {
    return normalizeCategoryPath(text.split('>').map(s => s.trim()));
  }
  if (text.includes('/')) {
    if (text.startsWith(`${TEXT.officeConsumables}/`)) {
      return normalizeCategoryPath([TEXT.officeConsumables, ...text.slice(TEXT.officeConsumables.length + 1).split('/')]);
    }
    if (text.startsWith(`${TEXT.hardwareTools}/`)) {
      return normalizeCategoryPath([TEXT.hardwareTools, ...text.slice(TEXT.hardwareTools.length + 1).split('/')]);
    }
    return normalizeCategoryPath(text.split('/').map(s => s.trim()));
  }
  return [text];
}

function getCategoryPath(data) {
  const fromDraft = parseStoredPath(data.categoryPath);
  const fromTemplate = parseStoredPath(data.template?.categoryPath);
  return fromDraft.length ? fromDraft : fromTemplate;
}

function getBrand(data) {
  return data.brand || data.attributes?.[TEXT.brand] || data.attributes?.brand || '';
}

function getModel(data) {
  return data.model || data.attributes?.[TEXT.model] || data.attributes?.model || '';
}

function toObject(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {}
  }
  return {};
}

function positiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function buildPublishFieldValues(data, path) {
  const attributes = toObject(data.attributes);
  const skuData = toObject(data.skuData);
  const categoryText = path.join('>');
  const title = String(data.title || '');
  const brand = getBrand(data);
  const model = getModel(data);
  const price = positiveNumber(data.price) || positiveNumber(data.marketPrice) || positiveNumber(skuData.price);
  const stock = data.stock || skuData.stock || skuData.skuList?.[0]?.stock || 99;
  const unit = /打印机|复印机|扫描仪|传真|投影机|一体机|保险箱|碎纸机|装订机/.test(categoryText) ? '台' : '件';
  const values = new Map();

  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null && String(value).trim()) values.set(normalizeLabel(key), String(value).trim());
  }

  const put = (labels, value) => {
    if (value === undefined || value === null || String(value).trim() === '') return;
    for (const label of labels) values.set(normalizeLabel(label), String(value).trim());
  };

  put(['商品标题'], shortenTitleForZcy(title, brand, model, path[path.length - 1] || ''));
  put(['品牌', '品牌名称'], brand);
  put(['型号', '商品型号', '规格型号', '认证型号'], model);
  put(['电商平台链接', '电商链接', '商品链接', '原始链接', '来源链接'], data.originalUrl);
  put(['计量单位', '单位', '销售单位'], unit);
  put(['产地', '制造商所在区域'], '境内');
  put(['是否中小企业制造产品', '是否中小企业制造商品'], '否');
  put(['是否需要安装', '需要安装'], '否');
  put(['商品编号', '商品编码', 'SKU编码'], data.originalId || skuData.skuId || attributes['商品编号']);
  put(['生产厂商', '生产厂家', '生产商', '制造商名称'], attributes['生产厂商'] || attributes['制造商'] || attributes['厂家'] || brand);
  put(['产品标准分类'], path[path.length - 1]);
  put(['质保时间', '质保时间 (个月)', '保修时间'], attributes['质保时间'] || attributes['保修时间'] || '12');
  put(['产品详情'], buildProductDescription(data, attributes, path));
  put(['库存'], stock);
  if (price) {
    put(['市场价', '销售价', '供价'], price);
  }

  if (/A4/i.test(title) || /A4/i.test(attributes['国补备案型号'] || '')) put(['最大打印幅面'], 'A4');
  if (/A3/i.test(title) || /A3/i.test(attributes['国补备案型号'] || '')) put(['最大打印幅面'], 'A3');
  if (/wifi|wi-fi|无线/i.test(title)) put(['是否支持网络打印'], '是');
  if (/非自动双面|不支持/.test(attributes['双面打印'] || '')) put(['是否支持自动双面打印'], '否');
  if (/自动双面/.test(attributes['双面打印'] || '')) put(['是否支持自动双面打印'], '是');
  if (/USB3\.0/i.test(title)) put(['接口类型'], 'USB3.0');
  else if (/USB/i.test(title)) put(['接口类型'], 'USB2.0');

  if (/激光打印机/.test(categoryText)) {
    put(['耗材类型'], attributes['耗材类型'] || '硒鼓');
    put(['供纸盒容量', '供纸盒容量 (张)'], attributes['供纸盒容量'] || '250页');
    put(['最大分辨率', '最大分辨率 (dpi)'], attributes['最大分辨率'] || '600*600dpi');
  }

  if (/LBP621Cw/i.test(model) || /LBP621Cw/i.test(title)) {
    put(['产品尺寸', '产品尺寸（长宽高）(mm)', '产品尺寸（长*宽*高）(mm)'], attributes['产品尺寸'] || '430*418*287mm');
  }

  const readableUnit = /打印机|复印机|扫描仪|传真|投影机|一体机|保险柜|碎纸机|装订机/.test(categoryText + title) ? '台' : '件';
  const readableDescription = [
    title,
    `品牌：${brand || attributes['品牌'] || ''}`,
    `型号：${model || attributes['型号'] || attributes['认证型号'] || ''}`,
    `类目：${path.join(' > ')}`,
    data.originalUrl ? `电商平台链接：${data.originalUrl}` : '',
  ].filter(Boolean).join('\n');

  put(['商品标题', '商品名称'], shortenTitleForZcy(title, brand, model, path[path.length - 1] || ''));
  put(['品牌', '品牌名称'], brand);
  put(['型号', '商品型号', '规格型号', '认证型号', '货号'], model);
  put(['电商平台链接', '电商链接', '商品链接', '原始链接', '来源链接'], data.originalUrl);
  put(['计量单位', '单位', '销售单位'], readableUnit);
  put(['产地', '制造商所在区域', '生产地'], '境内');
  put(['是否中小企业制造产品', '是否中小企业制造商品'], '否');
  put(['是否需要安装', '需要安装', '是否安装'], '否');
  put(['商品编号', '商品编码', 'SKU编码', 'SKU 编码'], data.originalId || skuData.skuId || attributes['商品编号'] || model);
  put(['生产厂商', '生产厂家', '生产商', '制造商名称', '制造商'], attributes['生产厂商'] || attributes['制造商'] || attributes['厂家'] || brand);
  put(['产品标准分类'], path[path.length - 1]);
  put(['质保时间', '质保时间 (个月)', '保修时间'], attributes['质保时间'] || attributes['保修时间'] || '12');
  put(['产品详情', '商品详情', '商品描述'], readableDescription);
  put(['库存', '库存数量'], stock);
  if (price) {
    put(['市场价', '销售价', '供货价', '单价'], price);
  }

  return values;
}

function normalizeLabel(text) {
  return normalize(String(text || '').replace(/[:：?？*＊]/g, ''));
}

function shortenTitleForZcy(title, brand, model, categoryName) {
  const parts = [brand, model, categoryName].filter(Boolean).join(' ');
  const fallback = title || parts;
  const result = parts || fallback;
  return result.length > 70 ? result.slice(0, 70) : result;
}

function buildProductDescription(data, attributes, path) {
  const lines = [
    data.title,
    `品牌：${getBrand(data) || attributes['品牌'] || ''}`,
    `型号：${getModel(data) || attributes['认证型号'] || ''}`,
    `类目：${path.join(' > ')}`,
    data.originalUrl ? `电商平台链接：${data.originalUrl}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

function deriveBidName(path) {
  const joined = path.join('>');
  const level1 = path[0] || '';
  const level2 = path[1] || '';
  if (/打印机|复印机|扫描仪|传真|投影机|一体机|保险箱|碎纸机|装订机/.test(joined)) {
    return '\u529e\u516c\u8bbe\u5907';
  }
  if (joined.includes('\u4e94\u91d1') || joined.includes('\u5de5\u5177')) return '\u4e94\u91d1\u5de5\u5177';
  if (joined.includes('\u8ba1\u7b97\u673a')) return '\u8ba1\u7b97\u673a\u8bbe\u5907';
  if (joined.includes('\u52b3\u52a8\u4fdd\u62a4')) return '\u52b3\u52a8\u4fdd\u62a4\u7528\u54c1';
  if (joined.includes('\u706f\u5177')) return '\u706f\u5177\u5546\u54c1';
  if (level1.includes('\u65e5\u7528\u767e\u8d27')) return '\u65e5\u7528\u767e\u8d27';
  if (level1.includes('\u6587\u5316\u7528\u54c1')) return '\u529e\u516c\u7528\u54c1';

  if (level1 === TEXT.officeConsumables) {
    if (level2.includes('\u529e\u516c\u7528\u7eb8')
      || level2.includes('\u58a8\u7c89')
      || level2.includes('\u7852\u9f13')
      || level2.includes('\u6cb9\u58a8')
      || level2.includes('\u7ef3\u7d22')
      || level2.includes('\u80f6\u5e26')
      || level2.includes('\u5305\u88c5')) {
      return '\u529e\u516c\u7528\u54c1';
    }
    return '\u529e\u516c\u8bbe\u5907';
  }

  return level2 || level1;
}

async function getZcyPage(browser) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    for (const context of browser.contexts()) {
      for (const page of context.pages()) {
        if (page.url().includes('zcygov.cn')) return page;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error('No zcygov.cn WebView page found');
}

async function getVisibleTexts(locator, limit = 20) {
  return locator.evaluateAll((nodes, max) => nodes
    .filter(node => {
      const el = node;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map(node => (node.innerText || node.textContent || '').trim())
    .filter(Boolean)
    .slice(0, max), limit);
}

async function clickVisibleByText(page, text, timeout = 2000) {
  const candidates = page.locator('button, .el-button, .doraemon-btn, [role="button"], a, span').filter({ hasText: text });
  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const candidate = candidates.nth(i);
    const visible = await candidate.isVisible().catch(() => false);
    if (!visible) continue;
    await candidate.scrollIntoViewIfNeeded().catch(() => {});
    await candidate.click({ timeout }).catch(async () => {
      await candidate.evaluate(el => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }).catch(() => {});
    });
    return true;
  }
  return false;
}

async function resetCategorySelection(page) {
  const clicked = await clickVisibleByText(page, TEXT.reset, 2000);
  if (!clicked) {
    console.log('[ZCY-CDP] category reset button not found; continue with current page state');
    return;
  }
  console.log('[ZCY-CDP] reset category selection');
  await page.waitForTimeout(1000);
}

async function waitForMarketDialog(page, timeout = 6000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const dialog = page.locator('.doraemon-modal-wrap, .doraemon-dialog, .el-dialog, [role="dialog"]')
      .filter({ hasText: TEXT.onlineMarket })
      .first();
    if (await dialog.isVisible().catch(() => false)) return dialog;
    await page.waitForTimeout(250);
  }
  return null;
}

async function openMarketDialog(page) {
  const existing = await waitForMarketDialog(page, 1000);
  if (existing) return existing;

  const clicked = await clickVisibleByText(page, TEXT.chooseMarket, 3000)
    || await clickVisibleByText(page, TEXT.modify, 3000);
  if (!clicked) throw new Error('Choose market/modify button not found');

  const dialog = await waitForMarketDialog(page, 8000);
  if (!dialog) throw new Error('Choose market dialog did not open');
  console.log('[ZCY-CDP] opened market selector');
  return dialog;
}

async function expandOnlineMarket(page, dialog) {
  if (await dialog.locator(`text=${TEXT.bidPrefix}`).count().catch(() => 0)) return;

  const rows = dialog.locator('tr, .doraemon-table-row, [class*="table-row"], [class*="row"]')
    .filter({ hasText: TEXT.onlineMarket });
  const rowCount = await rows.count().catch(() => 0);
  for (let i = 0; i < rowCount; i += 1) {
    const row = rows.nth(i);
    if (!(await row.isVisible().catch(() => false))) continue;
    const expand = row.locator('button, .doraemon-btn, .el-button, [role="button"], .doraicon-plus, .doraicon-minus, [class*="plus"], [class*="expand"]').first();
    if (await expand.count().catch(() => 0)) {
      await expand.click({ timeout: 3000 }).catch(async () => {
        await expand.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).catch(() => {});
      });
    } else {
      await row.click({ timeout: 3000 }).catch(() => {});
    }
    await page.waitForTimeout(800);
    console.log('[ZCY-CDP] expanded online market row');
    return;
  }

  const anyExpand = dialog.locator('button, [role="button"], .doraicon-plus, [class*="plus"], [class*="expand"]').first();
  if (await anyExpand.count().catch(() => 0)) {
    await anyExpand.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(800);
    console.log('[ZCY-CDP] expanded first market row');
  }
}

async function selectBidInMarketDialog(page, dialog, bidName) {
  const exactPattern = new RegExp(`\\u6807\\u9879\\u540d\\u79f0\\s*[:\\uff1a]\\s*${escapeRegExp(bidName)}(?:\\s|$)`);
  const exactCell = dialog.locator('td, span, div, label').filter({ hasText: exactPattern });
  const exactCount = await exactCell.count().catch(() => 0);
  for (let i = 0; i < exactCount; i += 1) {
    const cell = exactCell.nth(i);
    if (!(await cell.isVisible().catch(() => false))) continue;
    const text = await cell.innerText().catch(() => '');
    if (!exactPattern.test(text)) continue;
    const row = cell.locator('xpath=ancestor-or-self::*[self::tr or contains(@class,"row") or contains(@class,"table-row")][1]');
    if (await clickBidRowRadio(page, row, bidName)) return true;
  }

  const rowLocator = dialog.locator('tr, .doraemon-table-row, [class*="table-row"], [class*="row"], label')
    .filter({ hasText: exactPattern });
  const count = await rowLocator.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const row = rowLocator.nth(i);
    if (!(await row.isVisible().catch(() => false))) continue;
    const text = await row.innerText().catch(() => '');
    if (!exactPattern.test(text)) continue;
    if (await clickBidRowRadio(page, row, bidName)) return true;
  }
  return false;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function clickBidRowRadio(page, row, bidName) {
  if (!(await row.count().catch(() => 0))) return false;
  const radio = row.locator('input[type="radio"], .doraemon-radio, .el-radio__input, .el-radio__inner, .el-radio, [role="radio"]').first();
  if (await radio.count().catch(() => 0)) {
    await radio.click({ timeout: 3000 }).catch(async () => {
      await radio.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).catch(() => {});
    });
  } else {
    await row.click({ timeout: 3000 }).catch(async () => {
      await row.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).catch(() => {});
    });
  }
  await page.waitForTimeout(500);
  console.log(`[ZCY-CDP] selected market bid: ${bidName}`);
  return true;
}

async function ensureSaleMarketForCategory(page, path) {
  const bidName = deriveBidName(path);
  if (!bidName) return;
  console.log(`[ZCY-CDP] ensuring sale market bid: ${bidName}`);

  const dialog = await openMarketDialog(page);
  await expandOnlineMarket(page, dialog);

  const selected = await selectBidInMarketDialog(page, dialog, bidName);
  if (!selected) {
    const sample = await getVisibleTexts(dialog.locator('tr, .doraemon-table-row, [class*="table-row"], label'), 30).catch(() => []);
    throw new Error(`Market bid not found: ${bidName}. Visible: ${sample.join(' / ')}`);
  }

  if (!await clickVisibleByText(page, TEXT.confirm, 3000)) {
    throw new Error('Market dialog confirm button not found');
  }
  await page.waitForTimeout(1800);
  console.log(`[ZCY-CDP] confirmed sale market bid: ${bidName}`);
}

async function closeBlockingDialogs(page) {
  const bodyText = await page.locator('body').innerText({ timeout: 2000 }).catch(() => '');
  if (bodyText.includes('\u672a\u9009\u62e9\u534f\u8bae') && bodyText.includes('\u662f\u5426\u7ee7\u7eed')) {
    if (await clickVisibleByText(page, TEXT.cancel, 2000)) {
      console.log('[ZCY-CDP] closed stale agreement warning dialog');
      await page.waitForTimeout(800);
    }
    return;
  }
  if (!bodyText.includes('\u6682\u4e0d\u80fd\u53d1\u5e03\u6b64\u6b3e\u5546\u54c1') && !bodyText.includes('SPU')) return;
  if (await clickVisibleByText(page, TEXT.backToEdit, 2000)) {
    console.log('[ZCY-CDP] closed stale ZCY blocking dialog');
    await page.waitForTimeout(800);
    return;
  }
  if (await clickVisibleByText(page, TEXT.confirm, 2000)) {
    console.log('[ZCY-CDP] confirmed stale ZCY blocking dialog');
    await page.waitForTimeout(800);
  }
}

async function categoryColumns(page) {
  const selectors = [
    '.category-list .doraemon-list-items',
    'ul.doraemon-list-items',
    '.category-panel ul',
    '.category-box ul',
    '.cascader-menu',
    '.category-tree ul',
    '[class*="category"] ul',
    '[class*="list-items"]'
  ];

  for (const selector of selectors) {
    const loc = page.locator(selector).filter({ has: page.locator(CATEGORY_ITEM_SELECTOR) });
    const count = await loc.count().catch(() => 0);
    if (count >= 2) {
      console.log(`[ZCY-CDP] category column selector: ${selector}, count=${count}`);
      return { selector, count };
    }
  }

  return { selector: '', count: 0 };
}

async function waitForCategoryColumns(page, timeout = 10000) {
  const deadline = Date.now() + timeout;
  let last = { selector: '', count: 0 };
  while (Date.now() < deadline) {
    last = await categoryColumns(page);
    if (last.selector) return last;
    await page.waitForTimeout(300);
  }
  return last;
}

async function findItemInColumn(column, name) {
  const items = column.locator(CATEGORY_ITEM_SELECTOR);
  const count = await items.count().catch(() => 0);
  const target = normalize(name);

  for (let i = 0; i < count; i += 1) {
    const item = items.nth(i);
    const text = await item.innerText().catch(() => '');
    const normalized = normalize(text);
    if (!normalized || normalized.length > Math.max(target.length + 20, 40)) continue;
    if (normalized === target || normalized.includes(target) || target.includes(normalized)) return item;
  }
  return null;
}

async function scrollColumn(column) {
  await column.evaluate(el => {
    const distance = Math.max(120, Math.floor(el.clientHeight * 0.7));
    el.scrollTop += distance;
    const wrap = el.querySelector('.el-scrollbar__wrap, [class*="scrollbar__wrap"]');
    if (wrap) wrap.scrollTop += distance;
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
        parent.scrollTop += distance;
        break;
      }
      parent = parent.parentElement;
    }
  }).catch(() => {});
}

async function clickInColumn(page, columns, level, name) {
  const column = page.locator(columns.selector).nth(level);
  await column.waitFor({ state: 'visible', timeout: 8000 });
  await column.evaluate(el => {
    el.scrollTop = 0;
    const wrap = el.querySelector('.el-scrollbar__wrap, [class*="scrollbar__wrap"]');
    if (wrap) wrap.scrollTop = 0;
    let parent = el.parentElement;
    while (parent) {
      const style = getComputedStyle(parent);
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && parent.scrollHeight > parent.clientHeight) {
        parent.scrollTop = 0;
        break;
      }
      parent = parent.parentElement;
    }
  }).catch(() => {});

  for (let round = 0; round < 18; round += 1) {
    const item = await findItemInColumn(column, name);
    if (item) {
      await item.scrollIntoViewIfNeeded().catch(() => {});
      await item.click({ timeout: 5000 });
      console.log(`[ZCY-CDP] selected level ${level + 1}: ${name}`);
      return;
    }
    await scrollColumn(column);
    await page.waitForTimeout(250);
  }

  const sample = await getVisibleTexts(column.locator(CATEGORY_ITEM_SELECTOR)).catch(() => []);
  throw new Error(`Category level ${level + 1} not found: ${name}. Visible: ${sample.join(' / ')}`);
}

async function selectCategoryPath(page, path) {
  if (path.length < 2) throw new Error(`Incomplete category path: ${JSON.stringify(path)}`);

  console.log(`[ZCY-CDP] selecting category: ${path.join(' > ')}`);
  await closeBlockingDialogs(page);
  const columns = await waitForCategoryColumns(page);
  if (!columns.selector) throw new Error('No ZCY category columns found');

  for (let i = 0; i < path.length; i += 1) {
    await clickInColumn(page, columns, i, path[i]);
    await page.waitForTimeout(800);
  }
}

async function selectDropdownField(page, label, value, required = false) {
  if (!value) return false;
  const rows = page.locator('.el-form-item, .doraemon-form-item, [class*="form-item"], tr')
    .filter({ hasText: label });
  const rowCount = await rows.count().catch(() => 0);
  let row = null;
  for (let i = 0; i < rowCount; i += 1) {
    const candidate = rows.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      row = candidate;
      break;
    }
  }
  if (!row) {
    if (required) throw new Error(`Field not found: ${label}`);
    return false;
  }

  const inputs = row.locator('input:not([type="checkbox"]):not([type="radio"]), textarea');
  const inputCount = await inputs.count().catch(() => 0);
  let input = null;
  for (let i = 0; i < inputCount; i += 1) {
    const candidate = inputs.nth(i);
    if (await candidate.isVisible().catch(() => false)) {
      input = candidate;
      break;
    }
  }
  if (!input) {
    const trigger = row.locator('.doraemon-select-selection, .el-select, [role="combobox"], [class*="select-selection"]').first();
    if (await trigger.count().catch(() => 0)) {
      await trigger.scrollIntoViewIfNeeded().catch(() => {});
      await trigger.click({ timeout: 5000 }).catch(async () => {
        await trigger.evaluate(el => {
          el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        }).catch(() => {});
      });
      await page.waitForTimeout(500);
      const reopened = row.locator('input:not([type="checkbox"]):not([type="radio"]), textarea');
      const reopenedCount = await reopened.count().catch(() => 0);
      for (let i = 0; i < reopenedCount; i += 1) {
        const candidate = reopened.nth(i);
        if (await candidate.isVisible().catch(() => false)) {
          input = candidate;
          break;
        }
      }
    }
  }
  if (!input) {
    if (required) throw new Error(`Field has no input: ${label}`);
    return false;
  }

  await input.scrollIntoViewIfNeeded().catch(() => {});
  await input.click({ timeout: 5000 });
  await input.fill(String(value));
  await page.waitForTimeout(800);

  const optionText = String(value).match(/[A-Za-z]+/)?.[0] || String(value);
  const option = page.locator('.el-select-dropdown li, .el-autocomplete-suggestion li, [class*="dropdown"] li, [class*="option"]')
    .filter({ hasText: optionText })
    .first();
  if (await option.count().catch(() => 0)) {
    await option.click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  return true;
}

async function waitForPublishForm(page, timeout = 12000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const count = await page.locator('.el-form-item, .doraemon-form-item, tr, [class*="form-item"]').count().catch(() => 0);
    const text = await page.locator('body').innerText({ timeout: 1000 }).catch(() => '');
    if (count > 8 && (text.includes('基本信息') || text.includes('销售信息'))) return;
    await page.waitForTimeout(300);
  }
}

async function discoverFormFields(page) {
  return page.evaluate(() => {
    const normalize = text => String(text || '').replace(/\s+/g, '').replace(/[()（）:：?？*＊]/g, '').trim().toLowerCase();
    const rows = Array.from(document.querySelectorAll('.el-form-item, .doraemon-form-item, tr, [class*="form-item"], [class*="attr-item"]'));
    const result = [];
    let id = 0;
    for (const row of rows) {
      const htmlRow = row;
      const labelNode = htmlRow.querySelector('.el-form-item__label, .doraemon-form-item-label, .doraemon-form-label, label, th, td:first-child, [class*="label"]');
      const rawLabel = labelNode?.innerText?.trim() || '';
      const label = rawLabel.replace(/[*＊]/g, '').trim();
      if (!label || label.length > 30) continue;
      const fieldId = htmlRow.getAttribute('data-zcy-cdp-field') || `zcy_cdp_field_${++id}_${Date.now()}`;
      htmlRow.setAttribute('data-zcy-cdp-field', fieldId);
      const required = rawLabel.includes('*') || rawLabel.includes('＊') || htmlRow.className.includes('required') || !!htmlRow.querySelector('[class*="required"]');
      const input = htmlRow.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea');
      const editable = htmlRow.querySelector('[contenteditable="true"], .ql-editor, [class*="editor"] [contenteditable]');
      const iframeEditor = htmlRow.querySelector('iframe');
      const hasControl = htmlRow.querySelector('input, textarea, .el-select, .doraemon-select, .el-radio, .doraemon-radio, .el-checkbox, .doraemon-checkbox');
      if (!hasControl && !editable && !iframeEditor) continue;
      const radios = Array.from(htmlRow.querySelectorAll('.el-radio, .doraemon-radio, label')).map(el => el.innerText?.trim()).filter(Boolean);
      const checks = Array.from(htmlRow.querySelectorAll('.el-checkbox, .doraemon-checkbox, label')).map(el => el.innerText?.trim()).filter(Boolean);
      result.push({
        id: fieldId,
        label,
        key: normalize(label),
        required,
        disabled: !!(input && (input.disabled || input.readOnly)) || htmlRow.className.includes('is-disabled'),
        current: input?.value || '',
        hasInput: !!input,
        hasEditable: !!editable,
        hasIframeEditor: !!iframeEditor,
        hasSelect: !!htmlRow.querySelector('.el-select, .doraemon-select, [class*="select"]'),
        radios,
        checks,
      });
    }
    return result;
  });
}

async function discoverFormFieldsV2(page) {
  return page.evaluate(() => {
    const normalize = text => String(text || '').replace(/\s+/g, '').replace(/[()（）:：*]/g, '').trim().toLowerCase();
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const controlSelector = 'input, textarea, .el-select, .doraemon-select, .el-radio, .doraemon-radio, .el-checkbox, .doraemon-checkbox, .doraemon-cascader-picker, .el-cascader, [contenteditable="true"], iframe, [class*="upload"]';
    const hasControl = el => !!el?.querySelector(controlSelector);
    const labels = Array.from(document.querySelectorAll([
      '.doraemon-form-item-required',
      '.el-form-item__label[required]',
      '.el-form-item__label',
      '.doraemon-form-item-label',
      '.doraemon-form-label',
      '.item-label',
      'label',
      'th',
      'td:first-child',
      '[class*="label"]',
    ].join(','))).filter(visible);
    const result = [];
    const seen = new Set();
    let id = 0;

    for (const labelNode of labels) {
      const rawLabel = String(labelNode.innerText || labelNode.textContent || '').trim();
      const label = rawLabel.replace(/[*：:]/g, '').trim();
      if (!label || label.length > 30) continue;
      const row = labelNode.closest('.el-form-item, .doraemon-row.doraemon-form-item, .doraemon-form-item, tr, [class*="form-item"], [class*="attr-item"], .item-container, .ReactVirtualized__Table__rowColumn');
      const labelCol = labelNode.closest('.doraemon-form-item-label, .el-form-item__label, [class*="form-item-label"], td, th');
      const required = rawLabel.includes('*')
        || label === '商品标题'
        || String(labelNode.className || '').includes('required')
        || !!labelNode.querySelector('[class*="required"]')
        || String(labelCol?.className || '').includes('required')
        || !!labelCol?.querySelector('[class*="required"]');
      if (!required) continue;

      const scope = [
        labelCol?.nextElementSibling,
        row ? Array.from(row.children).find(child => child !== labelCol && visible(child) && hasControl(child)) : null,
        row?.parentElement ? Array.from(row.parentElement.children).find(child => child !== row && visible(child) && hasControl(child)) : null,
        row,
      ].filter(Boolean).find(el => visible(el) && hasControl(el));
      if (!scope) continue;

      const rect = scope.getBoundingClientRect();
      const dedupeKey = `${normalize(label)}|${Math.round(rect.top + window.scrollY)}|${Math.round(rect.left)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const fieldId = scope.getAttribute('data-zcy-cdp-field') || `zcy_cdp_field_v2_${++id}_${Date.now()}`;
      scope.setAttribute('data-zcy-cdp-field', fieldId);
      const input = scope.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea');
      const editable = scope.querySelector('[contenteditable="true"], .ql-editor, [class*="editor"] [contenteditable]');
      const iframeEditor = scope.querySelector('iframe');
      const controlType = scope.querySelector('input[type="file"], .doraemon-upload, .el-upload') ? 'upload'
        : scope.querySelector('.doraemon-cascader-picker, .el-cascader, [class*="cascader"]') ? 'cascader'
        : scope.querySelector('.el-radio, .doraemon-radio, input[type="radio"]') ? 'radio'
        : scope.querySelector('.el-checkbox, .doraemon-checkbox, input[type="checkbox"]') ? 'checkbox'
        : scope.querySelector('[contenteditable="true"], iframe, .ql-editor, [class*="editor"]') ? 'richtext'
        : scope.querySelector('.doraemon-select-combobox, [class*="combobox"]') ? 'combobox'
        : scope.querySelector('.el-select, .doraemon-select, [role="combobox"], [class*="select"]') ? 'select'
        : scope.querySelector('textarea') ? 'textarea'
        : input ? 'input'
        : 'unknown';
      const radios = Array.from(scope.querySelectorAll('.el-radio, .doraemon-radio, label')).map(el => el.innerText?.trim()).filter(Boolean);
      const checks = Array.from(scope.querySelectorAll('.el-checkbox, .doraemon-checkbox, label')).map(el => el.innerText?.trim()).filter(Boolean);
      result.push({
        id: fieldId,
        label,
        key: normalize(label),
        required,
        disabled: !!(input && (input.disabled || input.readOnly)) || scope.className.includes('is-disabled'),
        current: input?.value || '',
        controlType,
        hasInput: !!input,
        hasEditable: !!editable,
        hasIframeEditor: !!iframeEditor,
        hasSelect: !!scope.querySelector('.el-select, .doraemon-select, [class*="select"]'),
        radios,
        checks,
      });
    }
    return result;
  });
}

async function fillPublishPage(page, data, path) {
  if (!/\/goods\/(publish|edit)/.test(page.url())) return;
  await waitForPublishForm(page);
  const values = buildPublishFieldValues(data, path);
  const seen = new Set();
  const totals = { filled: 0, skipped: 0 };

  startPhase('basic-required-fields');
  await fillVisiblePublishFields(page, values, seen, totals, 2, data, path);
  endPhase('basic-required-fields');
  startPhase('critical-required-fields');
  await fillCriticalPublishFields(page, data, path);
  endPhase('critical-required-fields');

  startPhase('main-image-upload');
  const imageResult = await uploadProductImages(page, data);
  endPhase('main-image-upload');
  console.log(`[ZCY-CDP] image upload phase complete: main=${imageResult.mainCount}, detail=${imageResult.detailCount}`);

  if (await clickVisibleByText(page, '\u56fe\u6587\u4fe1\u606f', 2000)) {
    await page.waitForTimeout(1000);
    startPhase('graphic-tab-fields');
    await fillVisiblePublishFields(page, values, seen, totals, 1, data, path);
    endPhase('graphic-tab-fields');
    if (imageResult.mainCount === 0) {
      startPhase('main-image-upload-retry');
      imageResult.mainCount = await uploadMainImages(page, getMainImageUrls(data));
      endPhase('main-image-upload-retry');
    }
    startPhase('detail-image-upload');
    const detailResult = await uploadDetailImages(page, data);
    endPhase('detail-image-upload');
    if (detailResult > imageResult.detailCount) imageResult.detailCount = detailResult;
  }

  if (await clickVisibleByText(page, '\u9500\u552e\u4fe1\u606f', 2000)) {
    await page.waitForTimeout(1000);
    startPhase('sales-tab-fields');
    await fillVisiblePublishFields(page, values, seen, totals, 1, data, path);
    endPhase('sales-tab-fields');
  }

  startPhase('sku-sales-table');
  await fillSkuSalesTable(page, data);
  endPhase('sku-sales-table');

  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  console.log(`[ZCY-CDP] publish form fill complete: filled=${totals.filled}, missingRequiredCandidates=${totals.skipped}`);
}

function uniqueTexts(values) {
  const seen = new Set();
  const result = [];
  for (const value of values || []) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function isBusinessOptionText(text) {
  const value = String(text || '').trim();
  return !!value
    && !value.includes('请输入')
    && !value.includes('请选择')
    && !value.includes('搜索')
    && !value.includes('未找到需要')
    && !value.includes('点击申请')
    && !value.includes('璇疯緭')
    && !value.includes('鏈壘');
}

async function scanRequiredSelectableOptions(page) {
  if (!/\/goods\/(publish|edit)/.test(page.url())) {
    throw new Error('Current page is not a ZCY publish/edit form');
  }
  await waitForPublishForm(page);
  const fields = await discoverFormFieldsV2(page);
  const results = [];
  for (const field of fields) {
    if (!field.required) continue;
    const type = field.controlType || (field.hasSelect ? 'select' : field.radios?.length ? 'radio' : field.checks?.length ? 'checkbox' : 'input');
    const item = {
      label: field.label,
      required: true,
      controlType: type,
      currentValue: field.current || '',
      options: [],
      optionSource: 'none',
    };
    if (type === 'radio' || type === 'checkbox') {
      item.options = await readInlineChoiceOptions(page, field.id);
      item.optionSource = 'inline';
    } else if (type === 'select' || type === 'combobox') {
      item.options = await readPopupOptionsForField(page, field.id, 'select');
      item.optionSource = item.options.length ? 'popup' : 'none';
    } else if (type === 'cascader') {
      const cascader = await readPopupOptionDetailsForField(page, field.id, 'cascader');
      item.options = cascader.options;
      item.optionLevels = cascader.levels;
      item.optionSource = item.options.length ? 'popup-level-1' : 'none';
    }
    results.push(item);
  }
  return results;
}

async function readInlineChoiceOptions(page, fieldId) {
  const values = await page.locator(`[data-zcy-cdp-field="${fieldId}"]`).evaluate(scope => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return Array.from(scope.querySelectorAll('.doraemon-radio-wrapper, .el-radio, .doraemon-checkbox-wrapper, .el-checkbox, label'))
      .filter(visible)
      .map(el => (el.innerText || el.textContent || '').trim())
      .filter(Boolean);
  }).catch(() => []);
  return uniqueTexts(values);
}

async function readPopupOptionsForField(page, fieldId, kind) {
  const details = await readPopupOptionDetailsForField(page, fieldId, kind);
  return details.options;
}

async function readPopupOptionDetailsForField(page, fieldId, kind) {
  const field = page.locator(`[data-zcy-cdp-field="${fieldId}"]`).first();
  if (!(await field.count().catch(() => 0))) return { options: [], levels: [] };
  await page.keyboard.press('Escape').catch(() => {});
  await field.scrollIntoViewIfNeeded().catch(() => {});
  const before = await visiblePopupSignature(page);
  let opened = false;
  const triggerSelector = kind === 'cascader'
    ? '.doraemon-cascader-picker, .el-cascader, .doraemon-cascader-input, .el-cascader input'
    : '.doraemon-select-selection, .el-select .el-input, .doraemon-select, .el-select, [role="combobox"]';
  const triggers = field.locator(triggerSelector);
  const triggerCount = await triggers.count().catch(() => 0);
  for (let i = 0; i < triggerCount; i += 1) {
    const trigger = triggers.nth(i);
    if (!(await trigger.isVisible().catch(() => false))) continue;
    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    const box = await trigger.boundingBox().catch(() => null);
    if (!box) continue;
    await trigger.click({
      timeout: 2000,
      force: true,
      position: { x: Math.max(4, box.width / 2), y: Math.max(4, box.height / 2) },
    }).catch(() => {});
    opened = true;
    break;
  }
  if (!opened) opened = await field.evaluate((scope, kind) => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const selectors = kind === 'cascader'
      ? ['.doraemon-cascader-picker', '.el-cascader', '.doraemon-cascader-input', '.el-cascader input']
      : ['.doraemon-select-selection', '.el-select .el-input', '.doraemon-select', '.el-select', '[role="combobox"]'];
    const trigger = selectors.flatMap(selector => Array.from(scope.querySelectorAll(selector))).find(visible);
    if (!trigger) return false;
    trigger.scrollIntoView({ block: 'center', inline: 'center' });
    const rect = trigger.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const event = { bubbles: true, cancelable: true, clientX, clientY: rect.top + rect.height / 2 };
    trigger.dispatchEvent(new MouseEvent('mousedown', event));
    trigger.dispatchEvent(new MouseEvent('mouseup', event));
    trigger.dispatchEvent(new MouseEvent('click', event));
    if (typeof trigger.click === 'function') trigger.click();
    return true;
  }, kind).catch(() => false);
  if (!opened) return { options: [], levels: [] };
  await page.waitForTimeout(kind === 'cascader' ? 800 : 350);
  let details = await readNewestVisiblePopupOptions(page, before, kind);
  let options = details.options;
  if (!options.length && kind !== 'cascader') {
    const current = await field.evaluate(scope => {
      const text = (scope.innerText || scope.textContent || '').replace(/\s+/g, ' ').trim();
      const input = scope.querySelector('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
      return (input?.value || text || '').replace(/请选择|请输入|搜索/g, '').trim();
    }).catch(() => '');
    options = uniqueTexts([current]);
    details = { options, levels: [] };
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(100);
  return { options, levels: details.levels || [] };
}

async function visiblePopupSignature(page) {
  return page.evaluate(() => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return Array.from(document.querySelectorAll('.doraemon-select-dropdown, .el-select-dropdown, .doraemon-cascader-menus, .el-cascader-panel'))
      .filter(visible)
      .map(el => `${Math.round(el.getBoundingClientRect().top)}:${Math.round(el.getBoundingClientRect().left)}:${(el.innerText || '').slice(0, 80)}`)
      .join('|');
  }).catch(() => '');
}

async function readNewestVisiblePopupOptions(page, beforeSignature, kind) {
  const deadline = Date.now() + 2500;
  while (Date.now() < deadline) {
    const payload = await page.evaluate(({ beforeSignature, kind }) => {
      const visible = el => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && rect.bottom > 0 && rect.top < window.innerHeight;
      };
      const rendered = el => {
        if (!el) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const rootSelector = kind === 'cascader'
        ? '.doraemon-cascader-menus, .el-cascader-panel'
        : '.doraemon-select-dropdown, .el-select-dropdown';
      const roots = Array.from(document.querySelectorAll(rootSelector))
        .filter(visible)
        .map(root => {
          const rect = root.getBoundingClientRect();
          const signature = `${Math.round(rect.top)}:${Math.round(rect.left)}:${(root.innerText || '').slice(0, 80)}`;
          return { root, rect, signature };
        })
        .filter(item => kind === 'cascader' || item.signature !== beforeSignature)
        .sort((a, b) => b.rect.top - a.rect.top);
      const root = roots[0]?.root;
      if (!root) return { options: [], levels: [] };
      const selector = kind === 'cascader'
        ? '.doraemon-cascader-menu-item, .el-cascader-node, li, [role="menuitem"]'
        : 'li, [role="option"], [class*="option"], .doraemon-select-dropdown-menu-item';
      const levelSelector = kind === 'cascader'
        ? '.doraemon-cascader-menu, .el-cascader-menu'
        : '';
      const levels = levelSelector
        ? Array.from(root.querySelectorAll(levelSelector))
          .filter(rendered)
          .map(level => Array.from(level.querySelectorAll(selector))
            .filter(rendered)
            .map(el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim())
            .filter(Boolean))
          .filter(level => level.length)
        : [];
      const options = Array.from(root.querySelectorAll(selector))
        .filter(rendered)
        .map(el => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return { options, levels };
    }, { beforeSignature, kind }).catch(() => ({ options: [] }));
    const options = uniqueTexts(payload.options).filter(isBusinessOptionText);
    const levels = (payload.levels || [])
      .map(level => uniqueTexts(level).filter(isBusinessOptionText).slice(0, 80))
      .filter(level => level.length);
    if (options.length) return { options: options.slice(0, 80), levels };
    await page.waitForTimeout(150);
  }
  return { options: [], levels: [] };
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getMainImageUrls(data) {
  return [...new Set([
    ...asArray(data.images),
    ...asArray(data.mainImages),
  ])].filter(isUsableImageUrl).slice(0, 8);
}

function getDetailImageUrls(data) {
  const detail = asArray(data.detailImages);
  const fallback = detail.length ? detail : asArray(data.images);
  return [...new Set(fallback)].filter(isUsableImageUrl).slice(0, 60);
}

function isUsableImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:image/')) return url.length < 8_000_000;
  if (url.length > 2000) return false;
  return /^https?:\/\//i.test(url) || /^\/\//.test(url);
}

function normalizeImageUrl(url) {
  let u = String(url || '').trim();
  if (u.startsWith('//')) u = `https:${u}`;
  u = u.split('?')[0];
  if (u.includes('360buyimg.com') || u.includes('jdcdn.com')) {
    u = u
      .replace(/s\d+x\d+_/g, '')
      .replace(/!\d{2,}x\d{2,}\w*/g, '')
      .replace(/n\d+\/jfs/g, 'jfs')
      .replace(/\/mobile\//g, '/');
  }
  if (u.includes('alicdn.com')) {
    u = u
      .replace(/_(\d+x\d+).*\.jpg$/i, '.jpg')
      .replace(/_(\d+x\d+).*\.png$/i, '.png')
      .replace(/\.(jpg|png)_\d+x\d+q\d+\.jpg$/i, '.$1');
  }
  return u;
}

function dataUrlToBuffer(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return {
    buffer: Buffer.from(match[2], 'base64'),
    contentType: match[1],
  };
}

function extensionFromContentType(contentType) {
  if (/png/i.test(contentType)) return '.png';
  if (/webp/i.test(contentType)) return '.webp';
  if (/gif/i.test(contentType)) return '.gif';
  return '.jpg';
}

async function downloadImageToTemp(url, dir, prefix, index) {
  const normalized = normalizeImageUrl(url);
  let buffer = null;
  let contentType = 'image/jpeg';

  if (normalized.startsWith('data:image/')) {
    const parsed = dataUrlToBuffer(normalized);
    if (!parsed) throw new Error(`Invalid data image at ${prefix}[${index}]`);
    buffer = parsed.buffer;
    contentType = parsed.contentType;
  } else {
    try {
      const response = await fetch(normalized, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
          Referer: normalized,
        },
      });
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
        contentType = response.headers.get('content-type') || contentType;
      }
    } catch {}

    if (!buffer) {
      const proxyResponse = await fetch(`${BACKEND_URL}/api/image-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalized }),
      });
      if (!proxyResponse.ok) throw new Error(`Image proxy failed ${proxyResponse.status}: ${normalized}`);
      const payload = await proxyResponse.json();
      const parsed = dataUrlToBuffer(payload.data || payload.base64 || '');
      if (!parsed) throw new Error(`Image proxy returned no data: ${normalized}`);
      buffer = parsed.buffer;
      contentType = payload.contentType || parsed.contentType || contentType;
    }
  }

  const filePath = nodePath.join(dir, `${prefix}_${index + 1}${extensionFromContentType(contentType)}`);
  await fs.promises.writeFile(filePath, buffer);
  return filePath;
}

async function prepareImageFiles(urls, prefix) {
  if (!urls.length) return { dir: '', files: [] };
  const dir = await fs.promises.mkdtemp(nodePath.join(os.tmpdir(), `gravops-zcy-${prefix}-`));
  const files = new Array(urls.length);
  let next = 0;
  const workerCount = Math.min(4, urls.length);
  const workers = Array.from({ length: workerCount }, async () => {
    while (next < urls.length) {
      const i = next;
      next += 1;
      try {
        files[i] = await downloadImageToTemp(urls[i], dir, prefix, i);
        console.log(`[ZCY-CDP] prepared ${prefix} image ${i + 1}/${urls.length}`);
      } catch (error) {
        console.log(`[ZCY-CDP] skip ${prefix} image ${i + 1}: ${error.message || error}`);
      }
    }
  });
  await Promise.all(workers);
  return { dir, files: files.filter(Boolean) };
}

async function cleanupPreparedFiles(prepared) {
  if (!prepared?.dir) return;
  await fs.promises.rm(prepared.dir, { recursive: true, force: true }).catch(() => {});
}

async function uploadProductImages(page, data) {
  const result = { mainCount: 0, detailCount: 0 };
  const mainUrls = getMainImageUrls(data);
  if (mainUrls.length) {
    result.mainCount = await uploadMainImages(page, mainUrls);
  }
  return result;
}

async function uploadMainImages(page, urls) {
  const prepared = await prepareImageFiles(urls, 'main');
  if (!prepared.files.length) {
    await cleanupPreparedFiles(prepared);
    return 0;
  }

  try {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(500);
    const opened = await openMainImageUploader(page);
    if (opened) {
      const uploaded = await setFilesInOpenUploadDialog(page, prepared.files, prepared.files.length);
      if (uploaded > 0) return uploaded;
    }

    const direct = await setFilesOnFirstPageInput(page, prepared.files, [
      '\u5546\u54c1\u56fe',
      '\u4e3b\u56fe',
      '\u56fe\u7247',
    ]);
    return direct;
  } finally {
    await cleanupPreparedFiles(prepared);
  }
}

async function openMainImageUploader(page) {
  const clicked = await page.evaluate(() => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const candidates = [
      '.upload-contain .image-upload .image-box',
      '.image-upload .image-box',
      '.upload-contain [class*="upload"]',
      '[class*="image-upload"]',
      '[class*="upload-card"]',
      '.doraemon-upload',
      '.el-upload',
    ];
    for (const selector of candidates) {
      const nodes = Array.from(document.querySelectorAll(selector)).filter(visible);
      for (const node of nodes) {
        const text = node.innerText || node.textContent || '';
        const rowText = node.closest('tr, .el-form-item, .doraemon-form-item, [class*="form-item"], section, div')?.innerText || '';
        if (/质检报告|营业执照|附件|证明/.test(rowText)) continue;
        if (text.length > 120 && !/上传|图片|主图|\+/.test(text)) continue;
        node.scrollIntoView({ block: 'center', inline: 'center' });
        node.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) return false;
  await page.waitForTimeout(1200);
  const modal = await findUploadDialog(page, 5000);
  return !!modal;
}

async function findUploadDialog(page, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const modal = page.locator('.doraemon-modal, .ant-modal, .el-dialog, [role="dialog"]')
      .filter({ has: page.locator('input[type="file"]') })
      .last();
    if (await modal.count().catch(() => 0)) {
      if (await modal.isVisible().catch(() => true)) return modal;
    }
    await page.waitForTimeout(200);
  }
  return null;
}

async function setFilesInOpenUploadDialog(page, files, expectedCount) {
  const modal = await findUploadDialog(page, 3000);
  if (!modal) return 0;
  const input = modal.locator('input[type="file"]').first();
  if (!(await input.count().catch(() => 0))) return 0;

  await input.setInputFiles(files);
  console.log(`[ZCY-CDP] injected ${files.length} files into upload dialog`);
  await waitForUploadedImagesVisible(page, modal, expectedCount, 12000);

  const selected = await selectRecentlyUploadedImages(page, modal, expectedCount);
  const confirmed = await clickDialogConfirm(page, modal);
  console.log(`[ZCY-CDP] upload dialog result: selected=${selected}, confirmed=${confirmed}`);
  await page.waitForTimeout(500);
  if (!confirmed) return 0;
  const attachedCount = await countAttachedProductImages(page);
  if (attachedCount) console.log(`[ZCY-CDP] product image slots now contain ${attachedCount} images`);
  return files.length;
}

async function countDialogImageItems(modal) {
  return modal.evaluate(root => {
    const visible = el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    return Array.from(root.querySelectorAll('.image-panel__item, .img-border .item-img, .material-img-item, .img-wrapper, .doraemon-image-card, .item-img, [class*="image-card"], img'))
      .filter(visible).length;
  }).catch(() => 0);
}

async function countAttachedProductImages(page) {
  return page.evaluate(() => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const contain = document.querySelector('.upload-contain');
    if (!contain) return 0;
    return Array.from(contain.querySelectorAll('img')).filter(visible).length;
  }).catch(() => 0);
}

async function selectRecentlyUploadedImages(page, modal, expectedCount) {
  await page.waitForTimeout(500);
  const clicked = await modal.evaluate((root, max) => {
    const visible = el => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const preferred = Array.from(root.querySelectorAll('.image-panel__item, .img-border .item-img, .material-img-item, .img-wrapper, .doraemon-image-card, .item-img, [class*="image-card"], [class*="upload-list"] [class*="item"], [class*="file-list"] [class*="item"]'))
      .filter(visible);
    const generic = Array.from(root.querySelectorAll('img'))
      .filter(img => visible(img) && img.naturalWidth > 40 && img.naturalHeight > 40)
      .map(img => img.closest('.img-border, .material-img-item, .img-wrapper, .doraemon-image-card, .item-img, [class*="image"], [class*="upload"], li, div') || img)
      .filter(visible);
    const seen = new Set();
    const items = [...preferred, ...generic].filter(item => {
      if (seen.has(item)) return false;
      seen.add(item);
      const text = item.innerText || item.textContent || '';
      return !/上传|选择文件|文件夹|返回|取消|确定/.test(text) || item.querySelector('img');
    }).slice(0, max);
    for (const item of items) {
      const checkbox = item.querySelector('input[type="checkbox"], .image-panel__item--mask__checkbox, .doraemon-checkbox, .el-checkbox, [class*="checkbox"]');
      const target = checkbox || item.querySelector('img') || item;
      target.click();
    }
    return items.length;
  }, expectedCount).catch(() => 0);
  if (clicked) {
    console.log(`[ZCY-CDP] selected ${clicked} uploaded images in material dialog`);
    await page.waitForTimeout(500);
  }
  return clicked;
}

async function waitForUploadedImagesVisible(page, modal, expectedCount, timeout = 12000) {
  const deadline = Date.now() + timeout;
  let lastCount = 0;
  let stableCount = 0;
  while (Date.now() < deadline) {
    const state = await modal.evaluate(root => {
      const visible = el => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
      };
      const imageCount = Array.from(root.querySelectorAll('img')).filter(img => visible(img) && img.naturalWidth > 40 && img.naturalHeight > 40).length;
      const loading = !!root.querySelector('[class*="loading"], [class*="uploading"], .doraemon-spin, .el-loading-mask');
      const buttonLoading = Array.from(root.querySelectorAll('button, .doraemon-btn, .ant-btn, .el-button')).some(btn => {
        const cls = String(btn.className || '');
        return cls.includes('loading') || cls.includes('is-loading');
      });
      return { imageCount, loading, buttonLoading };
    }).catch(() => ({ imageCount: 0, loading: false, buttonLoading: false }));
    stableCount = state.imageCount === lastCount ? stableCount + 1 : 0;
    lastCount = state.imageCount;
    if (state.imageCount >= Math.min(expectedCount, 2) && stableCount >= 2 && !state.loading && !state.buttonLoading) break;
    await page.waitForTimeout(500);
  }
  console.log(`[ZCY-CDP] upload dialog thumbnails visible: ${lastCount}`);
}

async function clickDialogConfirm(page, modal) {
  const imagePanelConfirmed = await page.evaluate(() => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const button = Array.from(document.querySelectorAll('.image-panel__footer-button, button, .doraemon-btn, .ant-btn, .el-button'))
      .find(el => visible(el) && (el.innerText || el.textContent || '').trim() === '确定');
    if (!button || button.disabled) return false;
    const rect = button.getBoundingClientRect();
    const options = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
    button.dispatchEvent(new MouseEvent('mousedown', options));
    button.dispatchEvent(new MouseEvent('mouseup', options));
    button.dispatchEvent(new MouseEvent('click', options));
    if (typeof button.click === 'function') button.click();
    return true;
  }).catch(() => false);
  if (imagePanelConfirmed) {
    console.log('[ZCY-CDP] clicked image panel confirm');
    return true;
  }

  const buttons = modal.locator('button, .doraemon-btn, .ant-btn, .el-button').filter({ hasText: TEXT.confirm });
  const count = await buttons.count().catch(() => 0);
  for (let i = count - 1; i >= 0; i -= 1) {
    const button = buttons.nth(i);
    if (!(await button.isVisible().catch(() => false))) continue;
    await waitUntilButtonReady(page, button);
    await button.click({ timeout: 5000 }).catch(async () => {
      await button.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).catch(() => {});
    });
    console.log('[ZCY-CDP] clicked upload dialog confirm');
    return true;
  }
  console.log('[ZCY-CDP] upload dialog confirm button not found');
  return false;
}

async function waitUntilButtonReady(page, button, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const ready = await button.evaluate(el => {
      const className = String(el.className || '');
      return !el.disabled && !className.includes('loading') && !className.includes('is-loading');
    }).catch(() => true);
    if (ready) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

async function setFilesOnFirstPageInput(page, files, labelHints) {
  const handles = await page.locator('input[type="file"]').elementHandles().catch(() => []);
  for (const handle of handles) {
    const meta = await handle.evaluate((input, hints) => {
      const row = input.closest('tr, .el-form-item, .doraemon-form-item, [class*="form-item"], section, div');
      const text = row?.innerText || document.body.innerText || '';
      return {
        bad: /质检报告|营业执照|附件|证明/.test(text),
        good: hints.some(hint => text.includes(hint)),
      };
    }, labelHints).catch(() => ({ bad: false, good: false }));
    if (meta.bad) continue;
    if (!meta.good && labelHints.length) continue;
    await handle.setInputFiles(files).catch(() => null);
    console.log(`[ZCY-CDP] injected ${files.length} files into page file input`);
    await page.waitForTimeout(2000);
    return files.length;
  }
  return 0;
}

async function uploadDetailImages(page, data) {
  const urls = getDetailImageUrls(data);
  if (!urls.length) return 0;
  const prepared = await prepareImageFiles(urls, 'detail');
  if (!prepared.files.length) {
    await cleanupPreparedFiles(prepared);
    return 0;
  }

  try {
    await clickVisibleByText(page, '\u56fe\u6587\u4fe1\u606f', 2000);
    await page.waitForTimeout(500);
    const opened = await openDetailImageUploader(page);
    if (!opened) {
      console.log('[ZCY-CDP] detail image upload button not found');
      return 0;
    }
    const uploaded = await setFilesInOpenUploadDialog(page, prepared.files, prepared.files.length);
    return uploaded;
  } finally {
    await cleanupPreparedFiles(prepared);
  }
}

async function openDetailImageUploader(page) {
  const clicked = await page.evaluate(() => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const selectors = [
      '.edui-for-simpleuploadgoodsdetail .edui-button-body',
      '.edui-for-simpleuploadgoodsdetail',
      '.edui-for-simpleupload .edui-button-body',
      '.edui-for-simpleupload',
      '.edui-for-insertimage .edui-button-body',
      '.edui-for-insertimage',
      '[title="\u5355\u56fe\u4e0a\u4f20"]',
      '[title="\u56fe\u7247"]',
      '[title="\u63d2\u5165\u56fe\u7247"]',
    ];
    for (const selector of selectors) {
      const node = Array.from(document.querySelectorAll(selector)).find(visible);
      if (node) {
        node.scrollIntoView({ block: 'center', inline: 'center' });
        node.click();
        return true;
      }
    }
    const boxes = Array.from(document.querySelectorAll('.edui-box[id^="edui"], [class*="toolbar"] button, [class*="editor"] button')).filter(visible);
    for (const box of boxes) {
      const className = String(box.className || '');
      const title = box.getAttribute('title') || '';
      const text = box.innerText || box.textContent || '';
      if (/simpleupload|insertimage|image/i.test(className) || /图片|上传|插入图片/.test(`${title}${text}`)) {
        const body = box.querySelector('.edui-button-body') || box;
        body.click();
        return true;
      }
    }
    return false;
  });
  if (!clicked) return false;
  await page.waitForTimeout(1000);
  return !!(await findUploadDialog(page, 8000));
}

async function fillSkuSalesTable(page, data) {
  const skuData = toObject(data.skuData);
  const stock = String(data.stock || skuData.stock || skuData.skuList?.[0]?.stock || 99);
  const skuId = String(data.originalId || skuData.skuId || skuData.skuList?.[0]?.skuId || '');
  const url = String(data.originalUrl || '');
  const price = positiveNumber(data.price) || positiveNumber(data.marketPrice) || positiveNumber(skuData.price);

  const filled = await page.evaluate(({ stock, skuId, url, price }) => {
    const table = document.querySelector('.sku-table, [class*="sku-table"], [class*="sku"]');
    if (!table) return [];
    const inputs = Array.from(table.querySelectorAll('input')).filter(input => !input.disabled && !input.readOnly);
    const setValue = (input, value) => {
      if (!input || value === undefined || value === null || String(value) === '') return false;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, String(value));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const result = [];
    if (price && setValue(inputs[0], price)) result.push('市场价');
    if (price && setValue(inputs[1], price)) result.push('销售价');
    if (setValue(inputs[2], stock)) result.push('库存');
    if (setValue(inputs[3], skuId)) result.push('SKU编码');
    if (setValue(inputs[4], url)) result.push('电商链接');
    return result;
  }, { stock, skuId, url, price });

  if (filled.length) console.log(`[ZCY-CDP] filled SKU sales table: ${filled.join(', ')}`);
}

async function fillVisiblePublishFields(page, values, seen, totals, passes, data = payload, path = getCategoryPath(payload)) {
  for (let pass = 0; pass < passes; pass += 1) {
    const fields = await discoverFormFieldsV2(page);
    for (const field of fields) {
      if (seen.has(field.id) || field.disabled) continue;
      if (!field.required) continue;
      const decision = await decidePublishFieldValue(page, field, values, data, path);
      if (decision.skip) {
        if (decision.reason === 'already-filled') seen.add(field.id);
        else totals.skipped += 1;
        if (decision.reason !== 'already-filled') console.log(`[ZCY-CDP] skip ${field.label}: ${decision.reason}`);
        continue;
      }
      const value = decision.value;
      if (!value) {
        totals.skipped += field.required ? 1 : 0;
        continue;
      }
      const started = Date.now();
      const ok = await fillPublishField(page, field, value);
      const elapsed = Date.now() - started;
      if (elapsed > 1000) console.log(`[ZCY-CDP] slow field ${field.label}: ${elapsed}ms`);
      if (ok) {
        seen.add(field.id);
        totals.filled += 1;
        const printableValue = Array.isArray(value) ? value.join('|') : value;
        console.log(`[ZCY-CDP] filled ${field.label}: ${printableValue === '__FIRST_OPTION__' ? '(first option)' : printableValue}${decision.reason ? ` (${decision.reason})` : ''}`);
      }
    }
    await page.mouse.wheel(0, Math.floor((await page.viewportSize())?.height || 900) * 0.75).catch(() => {});
    await page.waitForTimeout(600);
  }
}

async function decidePublishFieldValue(page, field, values, data, path) {
  const row = page.locator(`[data-zcy-cdp-field="${field.id}"]`).first();
  const existing = await getMeaningfulFieldValue(row, field).catch(() => '');
  const type = field.controlType || (field.hasSelect ? 'select' : field.radios?.length ? 'radio' : field.checks?.length ? 'checkbox' : 'input');
  const label = String(field.label || '').trim();

  if (existing && shouldKeepExistingFieldValue(label, type)) {
    return { skip: true, reason: 'already-filled', existing };
  }

  const base = values.get(field.key);
  const candidates = inferFieldCandidates(field, data, path, base);
  if (!candidates.length) return { skip: true, reason: 'no-confident-candidate' };

  if (type === 'select' || type === 'combobox') {
    return { value: candidates, reason: `option-candidates:${candidates.join('|')}` };
  }

  if (type === 'radio' || type === 'checkbox') {
    return { value: candidates, reason: `inline-candidates:${candidates.join('|')}` };
  }

  if (type === 'cascader') {
    if (existing) return { skip: true, reason: 'already-filled', existing };
    return { skip: true, reason: 'cascader-needs-level-rule' };
  }

  if (existing && !shouldOverwriteTextField(label)) {
    return { skip: true, reason: 'already-filled', existing };
  }

  return { value: candidates[0], reason: 'direct' };
}

async function getMeaningfulFieldValue(row, field) {
  if (!(await row.count().catch(() => 0))) return '';
  const raw = await row.evaluate((scope, meta) => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const clean = text => String(text || '').replace(/\s+/g, ' ').trim();
    const values = [];
    const textInputs = Array.from(scope.querySelectorAll('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea')).filter(visible);
    for (const input of textInputs) {
      if (input.value) values.push(input.value);
    }
    if (['input', 'textarea'].includes(meta.type)) {
      return values.map(clean).filter(Boolean).join(' | ');
    }
    for (const selector of ['.doraemon-select-selection-selected-value', '.el-input__inner', '.doraemon-cascader-picker-label', '.doraemon-radio-wrapper-checked', '.el-radio.is-checked', '.doraemon-checkbox-wrapper-checked', '.el-checkbox.is-checked']) {
      for (const node of Array.from(scope.querySelectorAll(selector)).filter(visible)) {
        const text = clean(node.innerText || node.textContent || node.value || '');
        if (text) values.push(text);
      }
    }
    if (meta.type === 'richtext') {
      const editor = scope.querySelector('[contenteditable="true"], .ql-editor, iframe');
      const editorText = clean(editor?.innerText || editor?.textContent || '');
      return editorText;
    }
    const scopeText = clean(scope.innerText || scope.textContent || '');
    values.push(scopeText);
    return values
      .map(clean)
      .filter(Boolean)
      .filter(text => text !== meta.label)
      .filter(text => !text.includes('请输入') && !text.includes('请选择') && !text.includes('搜索') && !text.includes('未找到需要'))
      .join(' | ');
  }, { label: field.label, type: field.controlType || '' }).catch(() => '');
  return normalizeExistingValue(raw, field.label);
}

function normalizeExistingValue(raw, label) {
  const value = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!value) return '';
  const labelText = String(label || '').replace(/\s+/g, '');
  const parts = value.split('|').map(part => part.trim()).filter(Boolean);
  const useful = parts.find(part => {
    const compact = part.replace(/\s+/g, '');
    return compact
      && compact !== labelText
      && !compact.includes('请输入')
      && !compact.includes('请选择')
      && !compact.includes('请填写')
      && !compact.includes('未找到需要');
  });
  return useful || '';
}

function shouldKeepExistingFieldValue(label, type) {
  if (shouldOverwriteTextField(label)) return false;
  return ['select', 'combobox', 'radio', 'checkbox', 'cascader'].includes(type);
}

function shouldOverwriteTextField(label) {
  const key = normalizeLabel(label);
  return ['商品标题', '商品名称'].some(name => key === normalizeLabel(name));
}

function chooseCandidateFromOptions(candidates, options) {
  const cleanOptions = uniqueTexts(options).filter(isBusinessOptionText);
  for (const candidate of uniqueTexts(candidates)) {
    const wanted = String(candidate || '').replace(/\s+/g, '').trim();
    if (!wanted) continue;
    const exact = cleanOptions.find(option => option.replace(/\s+/g, '') === wanted);
    if (exact) return exact;
    const contains = cleanOptions.find(option => option.replace(/\s+/g, '').includes(wanted) || wanted.includes(option.replace(/\s+/g, '')));
    if (contains) return contains;
  }
  return '';
}

function inferFieldCandidates(field, data, path, base) {
  const label = String(field.label || '');
  const key = normalizeLabel(label);
  const candidates = [];
  const add = value => {
    if (value === undefined || value === null) return;
    const text = String(value).trim();
    if (text && !candidates.includes(text)) candidates.push(text);
  };
  const attributes = toObject(data.attributes);
  const skuData = toObject(data.skuData);
  const title = String(data.title || '');
  const brand = getBrand(data);
  const model = getModel(data);
  const price = positiveNumber(data.price) || positiveNumber(data.marketPrice) || positiveNumber(skuData.price) || getFallbackPrice(data);
  const stock = data.stock || skuData.stock || skuData.skuList?.[0]?.stock || 99;

  if (isLabel(key, ['商品标题', '商品名称'])) add(shortenTitleForZcy(title, brand, model, path[path.length - 1] || ''));
  if (isLabel(key, ['品牌', '品牌名称'])) add(brand);
  if (isLabel(key, ['型号', '商品型号', '规格型号', '认证型号', '货号'])) add(model);
  if (isLabel(key, ['电商平台链接', '电商链接', '商品链接', '原始链接', '来源链接'])) add(data.originalUrl);
  if (isLabel(key, ['计量单位', '单位', '销售单位'])) inferUnitCandidates(data, path).forEach(add);
  if (isLabel(key, ['是否中小企业制造产品', '是否中小企业制造商品'])) ['否', '不是', '不属于'].forEach(add);
  if (isLabel(key, ['是否需要安装', '需要安装', '是否安装'])) inferInstallCandidates(data, path).forEach(add);
  if (isLabel(key, ['生产厂商', '生产厂家', '生产商', '制造商名称', '制造商'])) add(attributes['生产厂商'] || attributes['制造商'] || attributes['厂家'] || brand);
  if (isLabel(key, ['质保时间', '质保时间个月', '保修时间'])) add(attributes['质保时间'] || attributes['保修时间'] || '12');
  if (isLabel(key, ['库存', '库存数量'])) add(stock);
  if (isLabel(key, ['市场价', '销售价', '供货价', '供价', '单价'])) add(price || getFallbackPrice(data));
  if (isLabel(key, ['上架时间'])) ['立即上架', '马上上架'].forEach(add);
  if (isLabel(key, ['仓库'])) ['默认仓库', '默认'].forEach(add);
  if (isLabel(key, ['运费模板'])) ['默认', '包运费', '002'].forEach(add);

  if (!candidates.length && base) add(base);
  if (!candidates.length) {
    for (const [attrKey, attrValue] of Object.entries(attributes)) {
      if (normalizeLabel(attrKey) === key) add(attrValue);
    }
  }
  return candidates;
}

function isLabel(key, names) {
  return names.some(name => key === normalizeLabel(name));
}

function inferUnitCandidates(data, path) {
  const attributes = toObject(data.attributes);
  const text = `${path.join('>')} ${data.title || ''} ${Object.values(attributes).join(' ')}`;
  const rules = [
    [/打印机|复印机|扫描仪|传真机|投影机|一体机|电视|空调|冰箱|洗衣机|服务器|电脑|显示器|保险柜|碎纸机|装订机/, ['台', '件']],
    [/办公桌|会议桌|课桌|书桌|餐桌/, ['张', '件', '套']],
    [/椅|凳|沙发/, ['把', '张', '件', '套']],
    [/柜|架|床|屏风/, ['个', '件', '组', '套']],
    [/硒鼓|墨盒|粉盒|色带|碳粉|墨粉/, ['支', '个', '盒', '件']],
    [/复印纸|打印纸|纸张|纸巾|抽纸/, ['箱', '包', '令', '件']],
    [/电池|插座|鼠标|键盘|U盘|硬盘|灯管|灯泡|开关|水龙头/, ['个', '只', '件']],
    [/服装|工作服|制服|鞋|帽|手套/, ['件', '双', '套', '个']],
    [/药品|试剂|清洁剂|消毒液|胶水|油漆/, ['瓶', '桶', '盒', '支']],
  ];
  for (const [pattern, units] of rules) {
    if (pattern.test(text)) return units;
  }
  return ['件', '个', '套'];
}

function inferInstallCandidates(data, path) {
  const text = `${path.join('>')} ${data.title || ''}`;
  if (/空调|热水器|电视|投影幕|监控|摄像头|门禁|柜|架|桌|床/.test(text)) {
    return ['需要', '不需要', '否'];
  }
  return ['不需要', '否', '需要'];
}

function getFallbackPrice(data) {
  const configured = positiveNumber(process.env.ZCY_DEFAULT_PRICE)
    || positiveNumber(data.defaultPrice)
    || positiveNumber(data.template?.defaultPrice);
  return configured || 1;
}

async function fillCriticalPublishFields(page, data, path) {
  const categoryText = path.join('>');
  const title = String(data.title || '');
  const attributes = toObject(data.attributes);
  const manufacturer = attributes['生产厂商'] || attributes['制造商'] || attributes['厂家'] || getBrand(data) || data.brand || '';
  const unit = /打印机|复印机|扫描仪|传真|投影机|一体机|保险柜|碎纸机|装订机/.test(categoryText + title) ? '台' : '件';
  const tasks = [
    ['产地', async () => selectCascaderAddressRequired(page, '产地', ['北京', '北京市', '西城区'])],
    ['计量单位', async () => selectDropdownRequired(page, '计量单位', [unit])],
    ['是否中小企业制造产品', async () => selectDropdownRequired(page, '是否中小企业制造产品', ['否'])],
    ['生产厂商', async () => fillInputRequired(page, '生产厂商', manufacturer)],
    ['是否需要安装', async () => selectDropdownRequired(page, '是否需要安装', ['否', '不需要'])],
    ['质保时间', async () => selectDropdownRequired(page, '质保时间', [attributes['质保时间'] || attributes['保修时间'] || '12'])],
    ['最大分辨率', async () => fillInputRequired(page, '最大分辨率', attributes['最大分辨率'] || '600*600dpi')],
    ['产品尺寸', async () => fillInputRequired(page, '产品尺寸', attributes['产品尺寸'] || '430*418*287mm')],
  ];

  for (const [label, run] of tasks) {
    try {
      const ok = await run();
      console.log(`[ZCY-CDP] required field ${label}: ${ok ? 'ok' : 'not changed'}`);
    } catch (error) {
      console.log(`[ZCY-CDP] required field ${label} failed: ${error.message || error}`);
    }
  }
}

async function findControlledRow(page, label) {
  const scopeId = await page.evaluate(label => {
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const hasControl = el => !!el?.querySelector('input, textarea, .doraemon-select, .el-select, .doraemon-cascader-picker, .el-cascader, [role="combobox"]');
    const clean = text => String(text || '').replace(/\s+/g, '').replace(/[：:*]/g, '');
    const labelText = clean(label);
    const labelSelectors = [
      '.el-form-item__label',
      '.doraemon-form-item-label',
      '.doraemon-form-label',
      'th',
      'td',
      'label',
      '[class*="label"]',
    ].join(',');
    const labels = Array.from(document.querySelectorAll(labelSelectors))
      .filter(el => visible(el) && clean(el.innerText || el.textContent).includes(labelText))
      .sort((a, b) => clean(a.innerText || a.textContent).length - clean(b.innerText || b.textContent).length);
    for (const labelNode of labels) {
      const cell = labelNode.closest('td, th');
      const sibling = cell?.nextElementSibling;
      const labelCol = labelNode.closest('.doraemon-form-item-label, .el-form-item__label, [class*="form-item-label"]');
      const row = labelCol?.parentElement || labelNode.parentElement;
      const controlSibling = labelCol?.nextElementSibling || labelNode.nextElementSibling;
      const rowControl = row ? Array.from(row.children).find(child => child !== labelCol && visible(child) && hasControl(child)) : null;
      const candidates = [
        sibling,
        controlSibling,
        rowControl,
        labelNode.closest('.el-form-item, .doraemon-form-item, [class*="form-item"]'),
        labelNode.parentElement,
        cell?.parentElement,
      ].filter(Boolean);
      const scope = candidates.find(el => visible(el) && hasControl(el));
      if (!scope) continue;
      const id = scope.getAttribute('data-zcy-critical-scope') || `zcy_critical_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      scope.setAttribute('data-zcy-critical-scope', id);
      return id;
    }
    return '';
  }, label).catch(() => '');
  if (!scopeId) return null;
  return page.locator(`[data-zcy-critical-scope="${scopeId}"]`).first();
}

async function selectDropdownRequired(page, label, values) {
  const row = await findControlledRow(page, label);
  if (!row) return false;
  await row.scrollIntoViewIfNeeded().catch(() => {});
  const before = await row.innerText().catch(() => '');
  if (values.some(value => before.includes(value) && !before.includes('请输入'))) return true;

  await page.keyboard.press('Escape').catch(() => {});
  const trigger = row.locator('.doraemon-select, .el-select, [role="combobox"], .doraemon-select-selection, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])').last();
  if (!(await trigger.count().catch(() => 0))) return false;
  await trigger.click({ timeout: 3000 }).catch(async () => {
    await trigger.evaluate(el => {
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }).catch(() => {});
  });
  await page.waitForTimeout(400);

  for (const value of values) {
    const clicked = await clickVisibleDropdownOption(page, value);
    if (!clicked) continue;
    await page.waitForTimeout(250);
    const after = await row.innerText().catch(() => '');
    if (after.includes(value) || (value === '否' && after.includes('不需要'))) return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

async function clickVisibleDropdownOption(page, value) {
  const clicked = await page.evaluate(value => {
    const wanted = String(value || '').trim();
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && rect.bottom > 0 && rect.top < window.innerHeight;
    };
    const dropdowns = Array.from(document.querySelectorAll('.doraemon-select-dropdown, .el-select-dropdown, [class*="dropdown"]'))
      .filter(visible)
      .sort((a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top);
    const roots = dropdowns.length ? dropdowns : [document.body];
    for (const root of roots) {
      const options = Array.from(root.querySelectorAll('li, [class*="option"], [role="option"]')).filter(visible);
      const target = options.find(el => (el.innerText || el.textContent || '').trim() === wanted)
        || options.find(el => (el.innerText || el.textContent || '').trim().replace(/\s+/g, '') === wanted.replace(/\s+/g, ''))
        || options.find(el => (el.innerText || el.textContent || '').trim().replace(/\s+/g, '').startsWith(wanted.replace(/\s+/g, '')));
      if (!target) continue;
      const rect = target.getBoundingClientRect();
      const event = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      target.dispatchEvent(new MouseEvent('mousedown', event));
      target.dispatchEvent(new MouseEvent('mouseup', event));
      target.dispatchEvent(new MouseEvent('click', event));
      if (typeof target.click === 'function') target.click();
      return true;
    }
    return false;
  }, String(value)).catch(() => false);
  return clicked;
}

async function fillInputRequired(page, label, value) {
  if (!value) return false;
  const row = await findControlledRow(page, label);
  if (!row) return false;
  await row.scrollIntoViewIfNeeded().catch(() => {});
  const before = await row.innerText().catch(() => '');
  if (before.includes(String(value)) && !before.includes('请输入')) return true;

  const input = row.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea').first();
  if (!(await input.count().catch(() => 0))) return false;
  await input.click({ timeout: 3000 }).catch(() => {});
  await input.fill(String(value)).catch(async () => {
    await input.evaluate((el, v) => {
      const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, String(v));
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
  });
  await input.press('Enter').catch(() => {});
  await input.evaluate(el => {
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }).catch(() => {});
  await page.waitForTimeout(300);
  const after = await row.innerText().catch(() => '');
  return after.includes(String(value)) || await input.evaluate((el, v) => String(el.value || '').includes(String(v)), String(value)).catch(() => false);
}

function addressVariants(part) {
  return [...new Set([
    part,
    part.replace(/省$/, ''),
    part.replace(/市$/, ''),
    part.replace(/区$/, ''),
  ])];
}

async function selectCascaderAddressRequired(page, label, parts) {
  const row = await findControlledRow(page, label);
  if (!row) return false;
  await row.scrollIntoViewIfNeeded().catch(() => {});
  const radio = row.locator('.doraemon-radio, .el-radio, label').filter({ hasText: '境内' }).first();
  if (await radio.count().catch(() => 0)) {
    await radio.click({ timeout: 2000 }).catch(() => {});
    await page.waitForTimeout(250);
  }

  const before = await row.innerText().catch(() => '');
  if (parts.every(part => before.includes(part))) return true;

  const input = row.locator('.doraemon-cascader-input, .el-cascader input, input[placeholder*="请选择"]').last();
  if (!(await input.count().catch(() => 0))) return before.includes('境内');
  await input.click({ timeout: 3000 }).catch(async () => {
    await input.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).catch(() => {});
  });
  await page.waitForTimeout(400);

  const clicked = [];
  for (const part of parts) {
    let selected = false;
    for (const variant of addressVariants(part)) {
      const item = page.locator('.doraemon-cascader-menu-item, .el-cascader-node, [role="menuitem"], li')
        .filter({ hasText: variant })
        .first();
      if (!(await item.isVisible().catch(() => false))) continue;
      await item.click({ timeout: 3000 }).catch(async () => {
        await item.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).catch(() => {});
      });
      clicked.push(variant);
      selected = true;
      await page.waitForTimeout(350);
      break;
    }
    if (!selected) break;
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(400);

  const after = await row.innerText().catch(() => '');
  const ok = after.includes('境内') && parts.slice(0, 2).some(part => after.includes(part));
  console.log(`[ZCY-CDP] cascader ${label} clicked=${clicked.join('>')} text=${after.slice(0, 80)}`);
  return ok;
}

async function selectDropdownByLabel(page, label, value) {
  return page.evaluate(async ({ label, value }) => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const click = el => {
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      const options = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      el.dispatchEvent(new MouseEvent('mousedown', options));
      el.dispatchEvent(new MouseEvent('mouseup', options));
      el.dispatchEvent(new MouseEvent('click', options));
      if (typeof el.click === 'function') el.click();
      return true;
    };
    const row = Array.from(document.querySelectorAll('.el-form-item, .doraemon-form-item, tr, [class*="form-item"]'))
      .find(el => visible(el) && (el.innerText || el.textContent || '').includes(label));
    if (!row) return false;
    const beforeText = row.innerText || '';
    if (beforeText.includes(value) && !beforeText.includes('请输入')) return true;

    const trigger = row.querySelector('.doraemon-select, .el-select, [role="combobox"], [class*="select-selection"], input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
    if (!click(trigger)) return false;
    await sleep(250);

    const options = Array.from(document.querySelectorAll([
      '.doraemon-select-dropdown:not([style*="display: none"]) li',
      '.el-select-dropdown:not([style*="display: none"]) li',
      '.doraemon-select-dropdown [class*="option"]',
      '.el-select-dropdown [class*="option"]',
      '[class*="dropdown"] li',
      '[class*="option"]'
    ].join(','))).filter(visible);
    const exact = options.find(el => (el.innerText || el.textContent || '').trim() === value);
    const partial = options.find(el => (el.innerText || el.textContent || '').includes(value));
    const target = exact || partial;
    if (!target) {
      document.body.click();
      return false;
    }
    click(target);
    await sleep(300);
    return (row.innerText || '').includes(value);
  }, { label, value }).catch(() => false);
}

async function selectCascaderAddressField(page, label, addressParts) {
  return page.evaluate(async ({ label, addressParts }) => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const visible = el => {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const click = el => {
      if (!el) return false;
      el.scrollIntoView({ block: 'center', inline: 'center' });
      const rect = el.getBoundingClientRect();
      const options = { bubbles: true, cancelable: true, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2 };
      el.dispatchEvent(new MouseEvent('mousedown', options));
      el.dispatchEvent(new MouseEvent('mouseup', options));
      el.dispatchEvent(new MouseEvent('click', options));
      if (typeof el.click === 'function') el.click();
      return true;
    };
    const row = Array.from(document.querySelectorAll('.el-form-item, .doraemon-form-item, tr, [class*="form-item"]'))
      .find(el => visible(el) && (el.innerText || el.textContent || '').includes(label));
    if (!row) return false;

    const radio = Array.from(row.querySelectorAll('.doraemon-radio, .el-radio, label, span'))
      .find(el => visible(el) && (el.innerText || el.textContent || '').trim() === '境内');
    if (radio) {
      click(radio.closest('.doraemon-radio, .el-radio, label') || radio);
      await sleep(200);
    }

    if (addressParts.every(part => (row.innerText || '').includes(part))) return true;
    const input = row.querySelector('.doraemon-cascader-input, .el-cascader input, input[placeholder*="请选择"], input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"])');
    if (!input) return (row.innerText || '').includes('境内');
    click(input);
    await sleep(250);

    const variants = text => [...new Set([text, text.replace(/省$/, ''), text.replace(/市$/, ''), text.replace(/区$/, ''), text.replace(/(省|市|区)$/, '')])];
    for (const part of addressParts) {
      let chosen = false;
      for (let retry = 0; retry < 12 && !chosen; retry += 1) {
        const nodes = Array.from(document.querySelectorAll('.doraemon-cascader-menu-item, .el-cascader-node, li, [role="menuitem"]')).filter(visible);
        for (const variant of variants(part)) {
          const target = nodes.find(el => {
            const text = (el.innerText || el.textContent || '').trim();
            return text === variant || text.includes(variant);
          });
          if (target) {
            click(target);
            chosen = true;
            await sleep(220);
            break;
          }
        }
        if (!chosen) await sleep(150);
      }
      if (!chosen) break;
    }
    document.body.click();
    await sleep(250);
    const finalText = row.innerText || '';
    return finalText.includes('境内') && addressParts.slice(0, 2).some(part => finalText.includes(part));
  }, { label, addressParts }).catch(() => false);
}

async function fillPublishField(page, field, value) {
  const row = page.locator(`[data-zcy-cdp-field="${field.id}"]`).first();
  if (!(await row.count().catch(() => 0))) return false;
  await row.scrollIntoViewIfNeeded().catch(() => {});
  const values = Array.isArray(value) ? uniqueTexts(value) : [value];

  if (field.radios?.length) {
    for (const candidate of values) {
      const option = row.locator('.el-radio, .doraemon-radio, label').filter({ hasText: String(candidate) }).first();
      if (await option.count().catch(() => 0)) {
        await option.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250);
        return true;
      }
    }
  }

  if (field.checks?.length) {
    for (const candidate of values) {
      const option = row.locator('.el-checkbox, .doraemon-checkbox, label').filter({ hasText: String(candidate) }).first();
      if (await option.count().catch(() => 0)) {
        await option.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(250);
        return true;
      }
    }
  }

  if (field.hasEditable || field.hasIframeEditor) {
    const filledEditor = await fillEditorInRow(page, row, values[0]);
    if (filledEditor) return true;
  }

  const input = row.locator('input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), textarea').first();
  if (field.hasSelect) {
    const inputCount = await input.count().catch(() => 0);
    const inputBelongsToSelect = inputCount
      ? await input.evaluate(el => !!el.closest('.el-select, .doraemon-select, [role="combobox"], [class*="select"]')).catch(() => true)
      : true;
    if (!inputCount || inputBelongsToSelect) return selectOptionInRow(page, row, values);
  }

  if (await input.count().catch(() => 0)) {
    const editable = await input.evaluate(el => !el.disabled && !el.readOnly).catch(() => false);
    if (!editable) return false;
    await input.click({ timeout: 3000 }).catch(() => {});
    await input.fill(String(values[0])).catch(async () => {
      await input.evaluate((el, v) => {
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(el, String(v));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, String(values[0]));
    });
    await page.waitForTimeout(300);
    return true;
  }

  if (field.hasSelect) return selectOptionInRow(page, row, values);

  return false;
}

async function fillEditorInRow(page, row, value) {
  const editable = row.locator('[contenteditable="true"], .ql-editor, [class*="editor"] [contenteditable]').first();
  if (await editable.count().catch(() => 0)) {
    await editable.click({ timeout: 3000 }).catch(() => {});
    await editable.evaluate((el, v) => {
      el.innerHTML = String(v).split('\n').map(line => `<p>${line.replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]))}</p>`).join('');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
    await page.waitForTimeout(300);
    return true;
  }

  const iframe = row.locator('iframe').first();
  const frameElement = await iframe.elementHandle().catch(() => null);
  const frame = await frameElement?.contentFrame().catch(() => null);
  if (frame) {
    await frame.evaluate(value => {
      const body = document.body;
      const escape = text => String(text).replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
      body.innerHTML = String(value).split('\n').map(line => `<p>${escape(line)}</p>`).join('');
      body.dispatchEvent(new Event('input', { bubbles: true }));
      body.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(value));
    await page.waitForTimeout(300);
    return true;
  }

  return false;
}

async function selectOptionInRow(page, row, value) {
  const values = Array.isArray(value) ? uniqueTexts(value) : [value];
  const trigger = row.locator('.el-select, .doraemon-select, [role="combobox"], [class*="select"]').first();
  if (!(await trigger.count().catch(() => 0))) return false;
  await trigger.click({ timeout: 3000 }).catch(async () => {
    await trigger.evaluate(el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))).catch(() => {});
  });
  await page.waitForTimeout(400);
  if (values.includes('__FIRST_OPTION__')) return chooseFirstOpenDropdownOption(page);
  return chooseOpenDropdownOption(page, values);
}

async function chooseOpenDropdownOption(page, value) {
  for (const wanted of (Array.isArray(value) ? uniqueTexts(value) : [value])) {
    if (await clickVisibleDropdownOption(page, String(wanted).trim())) {
      await page.waitForTimeout(250);
      return true;
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

async function chooseFirstOpenDropdownOption(page) {
  const options = page.locator('.el-select-dropdown:not([style*="display: none"]) li:not(.is-disabled), .el-select-dropdown li:not(.is-disabled), .doraemon-select-dropdown li, [class*="dropdown"] li:not(.is-disabled), [class*="option"]:not(.is-disabled)');
  const count = await options.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const option = options.nth(i);
    if (!(await option.isVisible().catch(() => false))) continue;
    const text = (await option.innerText().catch(() => '')).trim();
    if (!text || text.includes('请输入') || text.includes('搜索')) continue;
    await option.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(250);
    return true;
  }
  await page.keyboard.press('Escape').catch(() => {});
  return false;
}

async function clickNextAndVerify(page) {
  const button = page.locator('button, .el-button, [role="button"]').filter({ hasText: TEXT.next }).first();
  if (!(await button.count().catch(() => 0))) {
    throw new Error('Next button not found after category selection');
  }

  await button.scrollIntoViewIfNeeded().catch(() => {});
  await button.click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  let bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  if (bodyText.includes('\u672a\u9009\u62e9\u534f\u8bae') && bodyText.includes('\u662f\u5426\u7ee7\u7eed')) {
    console.log('[ZCY-CDP] confirm publish without selected agreement');
    if (!await clickVisibleByText(page, TEXT.confirm, 3000)) {
      throw new Error('Agreement warning confirm button not found');
    }
    await page.waitForTimeout(1500);
    bodyText = await page.locator('body').innerText({ timeout: 3000 }).catch(() => '');
  }
  if (bodyText.includes('\u6682\u4e0d\u80fd\u53d1\u5e03\u6b64\u6b3e\u5546\u54c1') || bodyText.includes('SPU')) {
    throw new Error('\u653f\u91c7\u4e91\u5df2\u5b8c\u6210\u7c7b\u76ee\u548c\u5173\u952e\u5c5e\u6027\u9009\u62e9\uff0c\u4f46\u5f53\u524d\u7c7b\u76ee\u8981\u6c42\u5148\u7533\u8bf7\u6536\u5f55\u6b64\u6b3e SPU\uff0c\u6682\u65f6\u4e0d\u80fd\u76f4\u63a5\u8fdb\u5165\u53d1\u5e03\u9875\u3002');
  }
  await page.waitForURL(/\/goods\/(publish|edit)/, { timeout: 15000 }).catch(() => null);
  if (!/\/goods\/(publish|edit)/.test(page.url())) {
    throw new Error('Still on category page after clicking next; required category attributes may be missing');
  }
}

async function main() {
  const path = getCategoryPath(payload);
  const brand = getBrand(payload);
  const model = getModel(payload);

  console.log(`[ZCY-CDP] payload category: ${path.join(' > ') || '(empty)'}`);
  console.log(`[ZCY-CDP] payload brand/model: ${brand || '(empty)'} / ${model || '(empty)'}`);

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const page = await getZcyPage(browser);
  await page.bringToFront().catch(() => {});
  await page.waitForLoadState('domcontentloaded').catch(() => {});

  console.log(`[ZCY-CDP] page: ${page.url()}`);
  console.log(`[ZCY-CDP] product: ${payload.title || ''}`);

  if (scanOptionsOnly) {
    const scan = await scanRequiredSelectableOptions(page);
    console.log(JSON.stringify({ url: page.url(), requiredCount: scan.length, fields: scan }, null, 2));
    return;
  }

  if (/\/goods\/category\/attr\/select/.test(page.url())) {
    await ensureSaleMarketForCategory(page, path);
    await selectCategoryPath(page, path);
    await selectDropdownField(page, TEXT.brand, brand, true);
    await selectDropdownField(page, TEXT.model, model, false);
    await clickNextAndVerify(page);
  }

  await fillPublishPage(page, payload, path);

  console.log('[ZCY-CDP] category and form phase complete');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[ZCY-CDP] failed:', error.message || error);
    process.exit(1);
  });
