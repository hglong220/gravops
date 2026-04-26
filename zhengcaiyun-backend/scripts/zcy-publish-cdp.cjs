const fs = require('fs');
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
  chooseMarketTitle: '\u9009\u62e9\u4e0a\u67b6\u7684\u7535\u5b50\u5356\u573a',
  onlineMarket: '\u7f51\u4e0a\u8d85\u5e02',
  bidPrefix: '\u6807\u9879\u540d\u79f0',
};

const port = Number(arg('--port', process.env.ZCY_CDP_PORT || '9223'));
const payloadPath = arg('--payload', '');
if (!payloadPath) throw new Error('Missing --payload');
const CATEGORY_ITEM_SELECTOR = 'li, [role="treeitem"], .category-item, .el-cascader-node';

function readPayload(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

const payload = readPayload(payloadPath);

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

function deriveBidName(path) {
  const joined = path.join('>');
  const level1 = path[0] || '';
  const level2 = path[1] || '';
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

  const clicked = await clickVisibleByText(page, TEXT.chooseMarket, 3000);
  if (!clicked) throw new Error('Choose market button not found');

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
  const rowLocator = dialog.locator('tr, .doraemon-table-row, [class*="table-row"], [class*="row"], label')
    .filter({ hasText: bidName });
  const count = await rowLocator.count().catch(() => 0);
  for (let i = 0; i < count; i += 1) {
    const row = rowLocator.nth(i);
    if (!(await row.isVisible().catch(() => false))) continue;
    const text = await row.innerText().catch(() => '');
    if (!text.includes(bidName)) continue;

    const radio = row.locator('input[type="radio"], .doraemon-radio, .el-radio, [role="radio"]').first();
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
  return false;
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
  await resetCategorySelection(page);
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

  if (/\/goods\/category\/attr\/select/.test(page.url())) {
    await ensureSaleMarketForCategory(page, path);
    await selectCategoryPath(page, path);
    await selectDropdownField(page, TEXT.brand, brand, true);
    await selectDropdownField(page, TEXT.model, model, false);
    await clickNextAndVerify(page);
  }

  console.log('[ZCY-CDP] category phase complete');
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('[ZCY-CDP] failed:', error.message || error);
    process.exit(1);
  });
