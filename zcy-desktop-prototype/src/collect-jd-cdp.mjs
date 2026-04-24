import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const USER_DATA_DIR = path.join(ROOT, '.browser-cdp-profile')
const OUTPUT_DIR = path.join(ROOT, 'output')
const DEBUG_PORT = Number(process.env.ZCY_CDP_PORT || 9223)

const args = process.argv.slice(2)
const urlArg = args.find((arg) => arg.startsWith('--url='))
const url = urlArg ? urlArg.slice('--url='.length) : args[args.indexOf('--url') + 1]
const browserArg = args.find((arg) => arg.startsWith('--browser='))
const browserName = (browserArg ? browserArg.slice('--browser='.length) : process.env.ZCY_BROWSER || 'edge').toLowerCase()
const includeDetailImages = !args.includes('--no-detail-images')

if (!url) {
  console.error('Usage: node src/collect-jd-cdp.mjs --url https://item.jd.com/100011969414.html')
  process.exit(1)
}

function findBrowser(name) {
  const chromeCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
  ]
  const edgeCandidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ]
  const candidates = name === 'chrome' ? chromeCandidates : edgeCandidates
  return candidates.find((p) => fs.existsSync(p))
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForCdp() {
  const endpoint = `http://127.0.0.1:${DEBUG_PORT}/json/version`
  for (let i = 0; i < 80; i++) {
    try {
      const res = await fetch(endpoint)
      if (res.ok) return
    } catch { }
    await sleep(250)
  }
  throw new Error(`Edge CDP endpoint not available on port ${DEBUG_PORT}`)
}

async function isCdpReady() {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
    return res.ok
  } catch {
    return false
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })

  const browserPath = findBrowser(browserName)
  if (!browserPath) throw new Error(`${browserName} not found`)

  if (!await isCdpReady()) {
    const launchedBrowser = spawn(browserPath, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--new-window',
      'about:blank'
    ], {
      detached: true,
      stdio: 'ignore'
    })
    launchedBrowser.unref()
  }

  await waitForCdp()

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`)
  const context = browser.contexts()[0] || await browser.newContext()
  const page = context.pages().find((candidate) => candidate.url().split('?')[0] === url.split('?')[0])
    || context.pages().find((candidate) => candidate.url() === 'about:blank' || candidate.url().startsWith('edge://newtab'))
    || await context.newPage()

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(6_000)

  const state = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    skuName: document.querySelector('.sku-name')?.textContent?.trim() || '',
    bodyStart: document.body?.innerText?.slice(0, 300) || '',
    counts: {
      specListImg: document.querySelectorAll('#spec-list img').length,
      specItemsImg: document.querySelectorAll('.spec-items img').length,
      previewImg: document.querySelectorAll('.preview img').length,
      detailImg: document.querySelectorAll('#detail img, #graphic-content img, #J-detail-content img').length,
      allImg: document.querySelectorAll('img').length
    }
  }))

  const product = await collectJdProduct(page, { includeDetailImages })
  const scrapedData = buildScrapedData(product)
  const outputPath = path.join(OUTPUT_DIR, 'jd-cdp-collection-result.json')
  const skuOutputPath = product.info.skuId
    ? path.join(OUTPUT_DIR, `jd-cdp-collection-${product.info.skuId}.json`)
    : ''
  fs.writeFileSync(outputPath, JSON.stringify({ state, product, scrapedData }, null, 2), 'utf8')
  if (skuOutputPath) fs.writeFileSync(skuOutputPath, JSON.stringify({ state, product, scrapedData }, null, 2), 'utf8')

  console.log(JSON.stringify({
    state,
    title: product.info.title,
    brand: product.info.brand,
    model: product.info.model,
    selectedSpecs: product.info.selectedSpecs,
    parameterCount: product.info.parameters.length,
    mainImages: product.mainImages.length,
    detailImages: product.detailImages.length,
    specGroups: scrapedData.specGroups?.length || 0,
    skuSpecs: scrapedData.skuSpecs?.length || 0,
    scrapedData,
    mainSamples: product.mainImages.slice(0, 10),
    detailSamples: includeDetailImages ? product.detailImages.slice(0, 10) : [],
    outputPath,
    skuOutputPath
  }, null, 2))

  await browser.close()
}

async function collectJdProduct(page, options = {}) {
  const detailNetworkImages = []
  if (options.includeDetailImages) {
    page.on('response', (response) => {
      if (response.request().resourceType() !== 'image') return
      const responseUrl = response.url()
      if (isJdDetailImageUrl(responseUrl)) detailNetworkImages.push(responseUrl)
    })
  }

  const info = await extractProductInfo(page)
  await preloadMainThumbnails(page)
  const mainImages = await extractMainImages(page)
  let detailImages = []
  if (options.includeDetailImages) {
    await openPreciseDetailTab(page)
    await openDetailTab(page)
    await scrollDetailArea(page)
    detailImages = await extractDetailImages(page, mainImages, detailNetworkImages)
  }
  return { info, mainImages, detailImages }
}

function buildScrapedData(product) {
  const info = product.info
  const attributes = Object.fromEntries(info.parameters.map((item) => [item.name, item.value]))
  const selectedSpecMap = Object.fromEntries(info.selectedSpecs.map((item) => [item.name, item.value]))
  const skuImages = {}
  for (const group of info.specGroups) {
    for (const item of group.optionDetails || []) {
      if (item.image) skuImages[item.name] = item.image
    }
  }
  const skuSpecs = info.specGroups.map((group) => ({
    name: group.name,
    values: group.options
  }))
  const skuData = [{
    code: info.skuId,
    model: info.model,
    specs: selectedSpecMap
  }]

  return {
    title: info.title,
    brand: info.brand,
    model: info.model,
    specs: attributes,
    attributes,
    categoryPath: info.categoryPath,
    sourceUrl: info.sourceUrl,
    skuId: info.skuId,
    itemNo: info.itemNo,
    productCode: info.productCode,
    images: product.mainImages,
    detailImages: product.detailImages,
    selectedSaleSpecs: info.selectedSpecs,
    specGroups: info.specGroups,
    skuImages,
    skuSpecs,
    skuData
  }
}

function isJdDetailImageUrl(raw) {
  try {
    const url = new URL(raw)
    return url.hostname.endsWith('360buyimg.com') && (
      url.pathname.includes('/sku/jfs/')
      || url.pathname.includes('/imgzone/jfs/')
    )
  } catch {
    return false
  }
}

async function extractProductInfo(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
    const text = (selector, root = document) => clean(root.querySelector(selector)?.textContent)
    const attr = (selector, name, root = document) => clean(root.querySelector(selector)?.getAttribute(name))

    const url = location.href
    const skuId = url.match(/item\.jd\.com\/(\d+)\.html/)?.[1] || ''
    const title = text('.sku-title-name')
      || text('.sku-title-text')
      || text('.page-right-skuname')
      || clean(document.title.replace(/【.*$/, ''))

    const parameters = []
    const seenParams = new Set()
    const addParameter = (name, value) => {
      name = clean(name)
      value = clean(value)
      if (!name || !value || name === value) return
      const key = `${name}\u0000${value}`
      if (seenParams.has(key)) return
      seenParams.add(key)
      parameters.push({ name, value })
    }

    document.querySelectorAll('.attrs .item, .attribute .item').forEach((item) => {
      const name = attr('.label .text', 'title', item) || text('.label .text', item) || text('.label', item)
      const value = attr('.value', 'title', item) || text('.value .text', item) || text('.value', item)
      addParameter(name, value)
    })

    document.querySelectorAll([
      '#parameter-brand li',
      '#parameter2 li',
      '.parameter2 li',
      '.p-parameter-list li',
      '.p-parameter li'
    ].join(',')).forEach((item) => {
      const raw = clean(item.textContent)
      const match = raw.match(/^(.+?)[:：]\s*(.+)$/)
      if (match) addParameter(match[1], match[2])
    })

    document.querySelectorAll('.Ptable .Ptable-item').forEach((group) => {
      group.querySelectorAll('dl').forEach((item) => {
        addParameter(text('dt', item), text('dd:not(.Ptable-tips)', item))
      })
    })

    document.querySelectorAll('#detail dl, .detail-list dl').forEach((item) => {
      addParameter(text('dt', item), text('dd', item))
    })

    const getParam = (names) => {
      for (const name of names) {
        const found = parameters.find((item) => item.name === name)
        if (found) return found.value
      }
      return ''
    }

    const specs = []
    document.querySelectorAll('.specification-series-layout, .specification-group').forEach((group) => {
      const label = text('.layout-label', group) || text('.specification-group-label', group)
      if (!label) return
      const options = Array.from(group.querySelectorAll('.specification-series-item, .specification-item-sku'))
        .map((item) => {
          const className = String(item.className || '')
          const rawName = clean(item.querySelector('.specification-series-item-text, .specification-item-sku-text')?.textContent || item.textContent)
          let image = clean(item.querySelector('img')?.getAttribute('src') || item.querySelector('img')?.getAttribute('data-src') || '')
          if (image.startsWith('//')) image = `https:${image}`
          const disabled = className.includes('--disabled')
            || className.includes('--lack')
            || className.includes('lack')
            || className.includes('disabled')
            || className.includes('no-stock')
            || className.includes('out-of-stock')
            || /无货|缺货|售罄/.test(rawName)
          return {
            name: clean(rawName.replace(/无货|缺货|售罄/g, '')),
            selected: className.includes('--selected') || className.includes('selected'),
            disabled,
            image
          }
        })
        .filter((item) => item.name)
      if (options.length === 0) return
      specs.push({
        name: label,
        selected: options.find((item) => item.selected)?.name || '',
        options: options.map((item) => item.name),
        optionDetails: options
      })
    })

    const categoryPath = Array.from(new Set(Array.from(document.querySelectorAll('.crumb .link, .crumb .item'))
      .map((item) => clean(item.textContent))
      .filter(Boolean)
      .filter((item) => item !== '>')))

    const serviceText = text('#service-support-new')
      || text('.page-right-serviceSupport .layout-content')
      || text('.page-right-serviceSupport')
    const factoryServiceText = text('.page-right-serviceOption')

    const brand = getParam(['品牌'])
    const model = getParam(['型号', '货号']) || skuId

    return {
      sourceUrl: url,
      skuId,
      title,
      categoryPath,
      brand,
      model,
      itemNo: getParam(['货号']),
      productCode: getParam(['商品编号']) || skuId,
      quantity: getParam(['数量']),
      type: getParam(['类型']),
      style: getParam(['风格']),
      material: getParam(['材质']),
      sizeSpec: getParam(['规格']),
      features: getParam(['产品特性']),
      scenes: getParam(['适用场景']),
      functions: getParam(['功能']),
      selectedSpecs: specs
        .filter((spec) => spec.selected)
        .map((spec) => ({ name: spec.name, value: spec.selected })),
      specGroups: specs,
      services: serviceText ? serviceText.split(/[·]/).map(clean).filter(Boolean) : [],
      factoryServices: factoryServiceText
        ? factoryServiceText
          .replace(/^原厂服务\s*/, '')
          .split(/\s+/)
          .map(clean)
          .filter(Boolean)
        : [],
      parameters
    }
  })
}

async function openPreciseDetailTab(page) {
  await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll('li, a, span, div, button'))
      .map((node) => {
        const text = (node.textContent || '').trim().replace(/\s+/g, '')
        const rect = node.getBoundingClientRect()
        return { node, text, area: rect.width * rect.height, width: rect.width, height: rect.height }
      })
      .filter(({ text, width, height }) => {
        if (!(text === '\u5546\u54c1\u8be6\u60c5' || text === '\u8be6\u60c5')) return false
        return width >= 20 && height >= 10
      })
      .sort((a, b) => a.area - b.area)
    const tab = candidates[0]?.node
    if (tab instanceof HTMLElement) tab.click()
  }).catch(() => undefined)
  await sleep(1_200)
}

async function preloadMainThumbnails(page) {
  const thumbs = await page.$$('#spec-list li, .spec-items li, .lh li')
  for (const thumb of thumbs.slice(0, 12)) {
    await thumb.hover().catch(() => undefined)
    await sleep(180)
  }
}

async function extractMainImages(page) {
  return page.evaluate(() => {
    const seen = new Set()
    const out = []
    const normalize = (raw) => {
      let url = String(raw || '').trim()
      if (!url || url.startsWith('data:')) return null
      if (url.startsWith('//')) url = `https:${url}`
      if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/n1${url}`
      if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/n1/${url}`
      if (/^s\d+x\d+_jfs\//i.test(url)) url = `https://img10.360buyimg.com/n1/${url}`
      try { url = new URL(url, location.href).href } catch { return null }
      if (!url.includes('360buyimg.com')) return null
      if (url.includes('imagetools')) return null
      url = url.replace(/\.(avif|webp)$/i, '')
      if (url.includes('/pcpubliccms/')) {
        return url.replace(/\/s\d+x\d+_jfs\//gi, '/s1440x1440_jfs/')
      }
      return url
        .replace(/\/s\d+x\d+_jfs\//gi, '/n1/jfs/')
        .replace(/\/s\d+x\d+_/gi, '/n1/')
        .replace(/\/n\d+\//gi, '/n1/')
    }
    const add = (raw) => {
      const url = normalize(raw)
      if (!url || seen.has(url)) return
      seen.add(url)
      out.push(url)
    }
    document.querySelectorAll('.image-carousel-track img.image, #spec-list img, .spec-items img, .lh img, #spec-n1 img, .preview img').forEach((img) => {
      add(img.getAttribute('data-url') || img.getAttribute('data-origin') || img.getAttribute('data-src') || img.getAttribute('data-lazy-img') || img.currentSrc || img.src)
    })
    if (Array.isArray(window.imageAndVideoJson)) {
      window.imageAndVideoJson.forEach((item) => add(item?.img || item?.imgUrl || item?.url))
    }
    return out.slice(0, 12)
  })
}

async function openDetailTab(page) {
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('li, a, span, div')).find((node) => {
      const text = (node.textContent || '').trim()
      return text === '\u5546\u54c1\u8be6\u60c5' || text === '\u8be6\u60c5' || text.includes('\u5546\u54c1\u8be6\u60c5')
    })
    if (tab instanceof HTMLElement) tab.click()
  }).catch(() => undefined)
  await page.evaluate(() => {
    const tab = Array.from(document.querySelectorAll('li, a, span, div')).find((node) => {
      const text = (node.textContent || '').trim()
      return text === '商品详情' || text === '详情' || text.includes('商品详情')
    })
    if (tab instanceof HTMLElement) tab.click()
  }).catch(() => undefined)
  await sleep(800)
}

async function scrollDetailArea(page) {
  await page.evaluate(() => {
    const root = document.querySelector('#graphic-content') || document.querySelector('#J-detail-content') || document.querySelector('#detail') || document.body
    root.scrollIntoView({ block: 'start' })
  }).catch(() => undefined)
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 900)
    await sleep(450)
  }
}

async function extractDetailImages(page, mainImages, networkImages) {
  return page.evaluate(({ mainImagesFromNode, networkImagesFromNode }) => {
    const seen = new Set()
    const out = []
    const mainSet = new Set(mainImagesFromNode || [])
    const normalize = (raw) => {
      let url = String(raw || '').trim()
      if (!url || url.startsWith('data:')) return null
      if (url.startsWith('//')) url = `https:${url}`
      if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/sku/${url.replace(/^\/+/, '')}`
      if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/sku/${url}`
      try { url = new URL(url, location.href).href } catch { return null }
      if (!url.includes('360buyimg.com')) return null
      if (url.includes('/pcpubliccms/')) return null
      return url
        .replace(/\.(avif|webp)$/i, '')
        .replace(/\/s\d+x\d+_jfs\//gi, '/sku/jfs/')
        .replace(/\/s\d+x\d+_(jfs|t\d+)\//gi, '/$1/')
    }
    const useful = (url, fromDetailContainer = false, imageMeta = {}) => {
      const lower = url.toLowerCase()
      if (mainSet.has(url)) return false
      const isLargeInlineDetail = fromDetailContainer
        && lower.includes('/img/jfs/')
        && (
          (Number(imageMeta.width) >= 300 && Number(imageMeta.height) >= 300)
          || Number(url.match(/\/(\d+)\/[^/]+\.(?:jpg|jpeg|png|gif)$/i)?.[1] || 0) >= 10_000
        )
      const isDetailBucket = lower.includes('/sku/jfs/')
        || lower.includes('/imgzone/jfs/')
        || isLargeInlineDetail
      if (!isDetailBucket) return false
      if (lower.includes('imagetools') || lower.includes('qrcode') || lower.includes('logo') || lower.includes('avatar')) return false
      if (lower.includes('/shaidan/') || lower.includes('comment')) return false
      return true
    }
    const add = (raw, fromDetailContainer = false, imageMeta = {}) => {
      const url = normalize(raw)
      if (!url || seen.has(url) || !useful(url, fromDetailContainer, imageMeta)) return
      seen.add(url)
      out.push(url)
    }
    performance.getEntriesByType('resource')
      .map((entry) => entry.name)
      .forEach(add)
    ;(networkImagesFromNode || []).forEach(add)

    const containers = ['#graphic-content', '#J-detail-content', '#J-detail', '#detail .tab-con', '.detail-main', '.detail-content', '.ssd-module-detail', '.detail-content-wrap']
    for (const selector of containers) {
      const container = document.querySelector(selector)
      if (!container) continue
      container.querySelectorAll('img').forEach((img) => {
        const rect = img.getBoundingClientRect()
        add(img.getAttribute('data-lazyload') || img.getAttribute('data-src') || img.getAttribute('data-original') || img.currentSrc || img.src, true, {
          width: img.naturalWidth || rect.width,
          height: img.naturalHeight || rect.height
        })
      })
    }
    return out.slice(0, 60)
  }, { mainImagesFromNode: mainImages, networkImagesFromNode: networkImages })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
