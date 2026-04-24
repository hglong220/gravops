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

if (!url) {
  console.error('Usage: node src/collect-taobao-cdp.mjs --url https://detail.tmall.com/item.htm?id=...')
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
  return (name === 'chrome' ? chromeCandidates : edgeCandidates).find((p) => fs.existsSync(p))
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function isCdpReady() {
  try {
    const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
    return res.ok
  } catch {
    return false
  }
}

async function waitForCdp() {
  for (let i = 0; i < 80; i++) {
    if (await isCdpReady()) return
    await sleep(250)
  }
  throw new Error(`Browser CDP endpoint not available on port ${DEBUG_PORT}`)
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
  fs.mkdirSync(USER_DATA_DIR, { recursive: true })

  const browserPath = findBrowser(browserName)
  if (!browserPath) throw new Error(`${browserName} not found`)

  if (!await isCdpReady()) {
    const browserProcess = spawn(browserPath, [
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${USER_DATA_DIR}`,
      '--no-first-run',
      '--new-window',
      'about:blank'
    ], { detached: true, stdio: 'ignore' })
    browserProcess.unref()
  }

  await waitForCdp()

  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`)
  const context = browser.contexts()[0] || await browser.newContext()
  const page = context.pages().find((candidate) => candidate.url().split('?')[0] === url.split('?')[0])
    || context.pages().find((candidate) => candidate.url() === 'about:blank' || candidate.url().startsWith('edge://newtab'))
    || await context.newPage()

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(8_000)
  await scrollForDetail(page)

  const product = await collectTaobaoProduct(page)
  const outputPath = path.join(OUTPUT_DIR, 'taobao-cdp-collection-result.json')
  const itemOutputPath = product.itemId
    ? path.join(OUTPUT_DIR, `taobao-cdp-collection-${product.itemId}.json`)
    : ''

  fs.writeFileSync(outputPath, JSON.stringify({ product, scrapedData: product.scrapedData }, null, 2), 'utf8')
  if (itemOutputPath) fs.writeFileSync(itemOutputPath, JSON.stringify({ product, scrapedData: product.scrapedData }, null, 2), 'utf8')

  console.log(JSON.stringify({
    url: product.sourceUrl,
    title: product.title,
    brand: product.brand,
    model: product.model,
    itemId: product.itemId,
    mainImages: product.images.length,
    detailImages: product.detailImages.length,
    parameterCount: Object.keys(product.attributes).length,
    specGroups: product.specGroups.length,
    skuSpecs: product.scrapedData.skuSpecs.length,
    selectedSpecs: product.selectedSpecs,
    scrapedData: product.scrapedData,
    mainSamples: product.images.slice(0, 8),
    detailSamples: product.detailImages.slice(0, 8),
    outputPath,
    itemOutputPath
  }, null, 2))

  await browser.close()
}

async function scrollForDetail(page) {
  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 1100)
    await page.waitForTimeout(350)
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => undefined)
  await page.waitForTimeout(800)
}

async function collectTaobaoProduct(page) {
  return page.evaluate(() => {
    const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim()
    const text = (selector, root = document) => clean(root.querySelector(selector)?.textContent)

    const normalizeImage = (raw) => {
      let url = String(raw || '').trim()
      if (!url || url.startsWith('data:')) return null
      if (url.startsWith('//')) url = `https:${url}`
      try { url = new URL(url, location.href).href } catch { return null }
      if (!/(alicdn|tbcdn|taobaocdn)\.com/.test(url)) return null
      if (/avatar|getavatar|sns_logo|\/s\.gif|sprite|qrcode|logo|icon/i.test(url)) return null
      url = url
        .replace(/\.webp$/i, '')
        .replace(/_\d+x\d+q\d+\.jpg_?/i, '')
        .replace(/_q\d+\.jpg_?/i, '')
        .replace(/_\d+x\d+\.jpg_?/i, '')
        .replace(/_\d+x\d+\.png_?/i, '')
        .replace(/\.jpg_\d+x\d+\.jpg/i, '.jpg')
        .replace(/\.png_\d+x\d+\.png/i, '.png')
        .replace(/\.jpg_$/i, '.jpg')
        .replace(/\.png_$/i, '.png')
      return url
    }

    const usefulImage = (url, kind) => {
      const lower = url.toLowerCase()
      if (lower.includes('-rate.')) return false
      if (lower.includes('/bao/uploaded/') && kind !== 'main') return false
      if (lower.includes('-tps-')) {
        const m = lower.match(/-tps-(\d+)-(\d+)/)
        if (!m) return false
        const w = Number(m[1])
        const h = Number(m[2])
        if (kind === 'detail') return w >= 500 && h >= 300
        return w >= 300 && h >= 300
      }
      return true
    }

    const addUnique = (list, seen, raw, kind) => {
      const url = normalizeImage(raw)
      if (!url || seen.has(url) || !usefulImage(url, kind)) return
      seen.add(url)
      list.push(url)
    }

    const itemId = new URL(location.href).searchParams.get('id') || ''
    const skuId = new URL(location.href).searchParams.get('skuId') || ''
    const title = text('h1')
      || text('[class*=mainTitle]')
      || text('[class*=ItemTitle]')
      || clean(document.title.split(/[-_]/)[0])

    const mainImages = []
    const seenMain = new Set()
    document.querySelectorAll([
      '[class*=picGallery] img',
      '[class*=PicGallery] img',
      '[class*=thumbnail] img',
      '[class*=mainPic] img',
      '[class*=MainPic] img',
      '#J_UlThumb img',
      '.tb-thumb img',
      '#J_ImgBooth'
    ].join(',')).forEach((img) => {
      addUnique(mainImages, seenMain, img.getAttribute('data-src') || img.getAttribute('data-ks-lazyload') || img.currentSrc || img.src, 'main')
    })

    const detailImages = []
    const seenDetail = new Set()
    document.querySelectorAll([
      '.desc-root img',
      '[class*=desc] img',
      '[class*=Desc] img',
      '[class*=imageText] img',
      '#description img',
      '#J_DivItemDesc img',
      '#J_DetailMeta img'
    ].join(',')).forEach((img) => {
      addUnique(detailImages, seenDetail, img.getAttribute('data-src') || img.getAttribute('data-ks-lazyload') || img.getAttribute('data-original') || img.currentSrc || img.src, 'detail')
    })

    const attributes = {}
    const addParam = (name, value) => {
      name = clean(name).replace(/[:：]$/, '')
      value = clean(value)
      if (!name || !value || name === value || name.length > 40 || value.length > 500) return
      if (!attributes[name]) attributes[name] = value
    }
    const setParam = (name, value) => {
      name = clean(name).replace(/[:：]$/, '')
      value = clean(value)
      if (!name || !value || name === value || name.length > 40 || value.length > 500) return
      attributes[name] = value
    }

    document.querySelectorAll([
      '#J_AttrUL li',
      '.attributes-list li',
      '.tb-property-cont li',
      '[class*=attributes] li',
      '[class*=Attrs] li',
      '[class*=Parameter] li',
      '[class*=param] li'
    ].join(',')).forEach((row) => {
      const raw = clean(row.textContent)
      const match = raw.match(/^(.+?)[:：]\s*(.+)$/)
      if (match) addParam(match[1], match[2])
    })

    const bodyLines = document.body.innerText.split(/\n+/).map(clean).filter(Boolean)
    const PARAM_INFO = '\u53c2\u6570\u4fe1\u606f'
    const BRAND_KEY = '\u54c1\u724c'
    const MODEL_KEY = '\u578b\u53f7'
    const ITEM_NO_KEY = '\u8d27\u53f7'
    const APPLICABLE_MODEL_KEY = '\u9002\u7528\u578b\u53f7'
    const stopWords = new Set(['\u56fe\u6587\u8be6\u60c5', '\u7528\u6237\u8bc4\u4ef7', '\u672c\u5e97\u63a8\u8350', '\u770b\u4e86\u53c8\u770b', '\u95ee\u5927\u5bb6'])
    const knownKeys = [
      BRAND_KEY, MODEL_KEY, ITEM_NO_KEY, '\u989c\u8272\u5206\u7c7b', '\u989c\u8272', '\u5c3a\u7801', '\u89c4\u683c', '\u6750\u8d28', '\u4ea7\u5730',
      '\u9002\u7528\u54c1\u724c', APPLICABLE_MODEL_KEY, '\u9002\u7528\u624b\u673a\u578b\u53f7', '\u7535\u6c60\u5bb9\u91cf', '\u7535\u6c60\u7c7b\u578b', '\u662f\u5426\u539f\u88c5',
      '3C\u8bc1\u4e66\u7f16\u53f7', '\u7269\u6d41\u914d\u9001\u5b89\u88c5\u670d\u52a1', '\u4e0a\u5e02\u65f6\u95f4', '\u529f\u80fd', '\u98ce\u683c', '\u7c7b\u578b',
      '\u5206\u8fa8\u7387', 'CPU\u578b\u53f7', '\u5b58\u50a8\u5bb9\u91cf', '\u5c4f\u5e55\u5237\u65b0\u7387', '\u5c4f\u5e55\u5c3a\u5bf8', '\u4e3b\u6444\u50cf\u7d20',
      '\u662f\u5426\u652f\u6301NFC', '\u4e09\u661f\u578b\u53f7', 'CPU\u54c1\u724c', '\u552e\u540e\u670d\u52a1', '\u5c4f\u5e55\u6750\u8d28',
      '\u63a5\u53e3\u7c7b\u578b', '\u7248\u672c\u7c7b\u578b', '\u50cf\u7d20', '\u5957\u9910\u7c7b\u578b', '\u524d\u7f6e\u6444\u50cf\u5934\u50cf\u7d20',
      '\u7f51\u7edc\u7c7b\u578b', '\u5145\u7535\u529f\u7387', '\u6709\u7ebf\u5145\u7535\u529f\u7387', '\u7535\u4fe1\u8bbe\u5907\u8fdb\u7f51\u8bb8\u53ef\u8bc1\u7f16\u53f7',
      '\u673a\u8eab\u989c\u8272'
    ]
    const knownKeySet = new Set(knownKeys)
    const keyHints = ['\u7f16\u53f7', '\u5bb9\u91cf', '\u7c7b\u578b', '\u989c\u8272', '\u5c3a\u5bf8', '\u6750\u8d28', '\u529f\u7387', '\u50cf\u7d20', '\u670d\u52a1']
    const isParamKey = (line) => {
      if (!line || line.length > 30 || line === PARAM_INFO) return false
      return knownKeySet.has(line) || keyHints.some((hint) => line.includes(hint))
    }
    const isParamValue = (line) => {
      if (!line || line === PARAM_INFO || stopWords.has(line) || isParamKey(line)) return false
      return line.length <= 500
    }
    const paramNameHints = [
      '\u54c1\u724c', '\u4ea7\u5730', '\u6750\u8d28', '\u578b\u53f7', '\u7535\u538b', '\u79cd\u7c7b', '\u65b9\u5f0f', '\u6a21\u5f0f',
      '\u65f6\u95f4', '\u670d\u52a1', '\u4fdd\u4fee', '\u89c4\u683c', '\u7c7b\u578b', '\u529f\u80fd', '\u914d\u7f6e', '\u5206\u7c7b',
      '\u56fe\u6848', '\u6027\u522b', '\u5b63\u8282', '\u6b3e\u5f0f', '\u7b52\u9ad8', '\u88c6\u4f4d', '\u5c3a\u7801', '\u98ce\u683c',
      '\u6e20\u9053', '\u5e74\u9f84', '\u539a\u8584', '\u53cc\u6570', '\u6b3e\u53f7', '\u540a\u724c\u4ef7', '\u5bb9\u91cf', '\u7f16\u53f7',
      '\u529f\u7387', '\u50cf\u7d20', '\u5c3a\u5bf8', '\u5237\u65b0\u7387', '\u63a5\u53e3', '\u7f51\u7edc', '\u989c\u8272', '\u9762\u6599'
    ]
    const isGenericParamName = (line) => {
      if (!line || line === PARAM_INFO || stopWords.has(line)) return false
      if (line.length > 30) return false
      if (/^[￥¥]?\d+(?:\.\d+)?(?:元)?$/.test(line)) return false
      if (/[,，、/]/.test(line)) return false
      if (/^(不支持|支持|无|有)[\u4e00-\u9fa5A-Za-z0-9]*$/.test(line) && !line.startsWith('\u662f\u5426')) return false
      if (/(已购|好评|发货|退款|客服|进店|搜索|首页|购物车|收藏|评价|问大家)/.test(line)) return false
      return isParamKey(line) || paramNameHints.some((hint) => line.includes(hint))
    }
    const paramStart = bodyLines.findLastIndex
      ? bodyLines.findLastIndex((line) => line.includes(PARAM_INFO))
      : bodyLines.map((line, index) => line.includes(PARAM_INFO) ? index : -1).filter((index) => index >= 0).pop() ?? -1
    let paramEnd = -1
    if (paramStart >= 0) {
      paramEnd = bodyLines.findIndex((line, index) => index > paramStart && stopWords.has(line))
      if (paramEnd < 0) paramEnd = Math.min(bodyLines.length, paramStart + 80)
    }
    if (paramStart >= 0 && paramEnd > paramStart + 2) {
      const block = bodyLines.slice(paramStart + 1, paramEnd)
      let mode = isParamKey(block[0]) ? 'keyNext' : 'valueKey'
      for (let i = 0; i < block.length; i++) {
        const line = block[i]
        if (!isParamKey(line)) continue
        const prev = block[i - 1]
        const next = block[i + 1]
        if (isParamKey(prev)) mode = 'keyNext'
        if (isParamKey(next) && isParamValue(prev)) mode = 'valueKey'
        if (mode === 'keyNext' && isParamValue(next)) {
          setParam(line, next)
          mode = 'keyNext'
        } else if (mode === 'valueKey' && isParamValue(prev)) {
          setParam(line, prev)
          mode = 'valueKey'
        } else if (isParamValue(prev)) {
          setParam(line, prev)
          mode = 'valueKey'
        } else if (isParamValue(next)) {
          setParam(line, next)
          mode = 'keyNext'
        }
      }
      let keyNextScore = 0
      let valueKeyScore = 0
      for (let i = 0; i < Math.min(block.length - 1, 30); i += 2) {
        if (isParamKey(block[i])) keyNextScore += 1
        if (isParamKey(block[i + 1])) valueKeyScore += 1
      }
      const pairMode = valueKeyScore > keyNextScore ? 'valueKey' : keyNextScore > valueKeyScore ? 'keyNext' : mode
      for (let i = 0; i < block.length - 1; i += 2) {
        const leftIsName = isGenericParamName(block[i])
        const rightIsName = isGenericParamName(block[i + 1])
        const localMode = leftIsName && !rightIsName ? 'keyNext' : rightIsName && !leftIsName ? 'valueKey' : pairMode
        const name = localMode === 'valueKey' ? block[i + 1] : block[i]
        const value = localMode === 'valueKey' ? block[i] : block[i + 1]
        if (isGenericParamName(name) && isParamValue(value)) setParam(name, value)
      }
    }

    const specGroups = []
    const selectedSpecs = []
    const seenGroups = new Set()
    const specLabels = new Set(['\u989c\u8272\u5206\u7c7b', '\u989c\u8272', '\u5c3a\u7801', '\u89c4\u683c', '\u7248\u672c', '\u7248\u672c\u7c7b\u578b', '\u5957\u9910\u7c7b\u578b', '\u5bb9\u91cf', '\u5b58\u50a8\u5bb9\u91cf', '\u7f51\u7edc\u7c7b\u578b', '\u673a\u8eab\u989c\u8272', '\u5c3a\u5bf8'])
    const specStopLabels = new Set(['\u6570\u91cf', '\u4fdd\u969c\u670d\u52a1', '\u52a0\u5165\u8d2d\u7269\u8f66', '\u7acb\u5373\u8d2d\u4e70', '\u670d\u52a1', '\u539f\u5382\u670d\u52a1', PARAM_INFO, '\u53c2\u6570', '\u56fe\u6587\u8be6\u60c5'])
    const ignoredOptionText = new Set(['\u5207\u6362\u5927\u56fe\u6a21\u5f0f', '\u6570\u91cf', '\u4fdd\u969c\u670d\u52a1', '\u52a0\u5165\u8d2d\u7269\u8f66', '\u9886\u5238\u8d2d\u4e70', '\u6536\u85cf', '\u63a8\u8350', '\u8fd1\u671f\u70ed\u9500', '\u5343\u4eba\u52a0\u8d2d'])
    const allNodes = Array.from(document.querySelectorAll('div, section, dl, ul'))
      .filter((node) => {
        const t = clean(node.textContent)
        if (t.length < 4 || t.length > 2000) return false
        return Array.from(specLabels).some((label) => t.startsWith(label) || t.includes(`${label} `))
      })
      .sort((a, b) => clean(a.textContent).length - clean(b.textContent).length)

    for (const node of allNodes) {
      const raw = clean(node.textContent)
      const label = Array.from(specLabels).find((item) => raw.startsWith(item) || raw.includes(`${item} `))
      if (!label || seenGroups.has(label)) continue
      const optionNodes = Array.from(node.querySelectorAll('button, [role=button], li, a, span, div'))
        .filter((item) => {
          const value = clean(item.textContent)
          const rect = item.getBoundingClientRect()
          return value && value !== label && value.length <= 80 && rect.width > 10 && rect.height > 10
        })
      const options = []
      const seenOptions = new Set()
      for (const item of optionNodes) {
        const value = clean(item.textContent).replace(/^推荐\s*/, '')
        if (!value || value === label || seenOptions.has(value)) continue
        if (ignoredOptionText.has(value)) continue
        let image = normalizeImage(item.querySelector('img')?.getAttribute('src') || item.querySelector('img')?.getAttribute('data-src') || '')
        const className = String(item.className || '')
        const selected = className.includes('selected') || className.includes('active') || className.includes('Checked') || className.includes('checked')
        options.push({ name: value, selected, image: image || '' })
        seenOptions.add(value)
      }
      if (options.length === 0 && attributes[label]) {
        attributes[label].split(/[,，]/).map(clean).filter(Boolean).forEach((value) => options.push({ name: value, selected: false, image: '' }))
      }
      if (options.length === 0) continue
      const selected = options.find((item) => item.selected)?.name || ''
      if (selected) selectedSpecs.push({ name: label, value: selected })
      specGroups.push({
        name: label,
        selected,
        options: options.map((item) => item.name),
        optionDetails: options
      })
      seenGroups.add(label)
    }

    document.querySelectorAll('#skuOptionsArea [class*=skuItem], [id*=skuOptionsArea] [class*=skuItem]').forEach((groupNode) => {
      const label = clean(groupNode.querySelector('[class*=ItemLabel]')?.textContent || groupNode.querySelector('[title]')?.getAttribute('title') || '')
      if (!label) return
      const options = []
      const seenOptions = new Set()
      groupNode.querySelectorAll('[class*=valueItem]').forEach((item) => {
        const textNode = item.querySelector('[class*=valueItemText], [title]')
        const value = clean(textNode?.getAttribute('title') || textNode?.textContent || item.textContent).replace(/\s+/g, ' ')
        if (!value || value === label || seenOptions.has(value) || ignoredOptionText.has(value)) return
        const className = String(item.className || '')
        const selected = /(^|\s|-)isSelected|selected|checked|active/i.test(className)
        let image = normalizeImage(item.querySelector('img')?.getAttribute('src') || item.querySelector('img')?.getAttribute('data-src') || '')
        options.push({ name: value, selected, image: image || '' })
        seenOptions.add(value)
      })
      if (options.length === 0) return
      const selected = options.find((item) => item.selected)?.name || ''
      const group = { name: label, selected, options: options.map((item) => item.name), optionDetails: options }
      const existingIndex = specGroups.findIndex((item) => item.name === label)
      if (existingIndex >= 0) specGroups[existingIndex] = group
      else specGroups.push(group)
      seenGroups.add(label)
    })

    const addLineSpecGroup = (name, values) => {
      const options = []
      const seenOptions = new Set()
      for (const raw of values) {
        String(raw || '').split(/[,，]/).map(clean).forEach((value) => {
          if (!value || seenOptions.has(value) || ignoredOptionText.has(value)) return
          if (value.length > 100 || specLabels.has(value) || specStopLabels.has(value)) return
          seenOptions.add(value)
          options.push({ name: value, selected: false, image: '' })
        })
      }
      if (options.length === 0) return
      const existingIndex = specGroups.findIndex((group) => group.name === name)
      const previousSelected = existingIndex >= 0 ? specGroups[existingIndex].selected : ''
      const previousSelectedSet = new Set((existingIndex >= 0 ? specGroups[existingIndex].optionDetails || [] : [])
        .filter((item) => item.selected)
        .map((item) => item.name))
      for (const item of options) {
        if (item.name === previousSelected || previousSelectedSet.has(item.name)) item.selected = true
      }
      const selected = options.find((item) => item.selected)?.name || ''
      const group = { name, selected, options: options.map((item) => item.name), optionDetails: options }
      if (existingIndex >= 0) {
        if (options.length > specGroups[existingIndex].options.length) specGroups[existingIndex] = group
      } else {
        specGroups.push(group)
        seenGroups.add(name)
      }
    }

    const isSpecLabel = (line) => specLabels.has(line)
    const isSpecStop = (line) => specStopLabels.has(line) || stopWords.has(line)
    for (let i = 0; i < bodyLines.length; i++) {
      const label = bodyLines[i]
      if (!isSpecLabel(label)) continue
      if (paramStart >= 0 && i > paramStart && i < paramEnd) continue
      const values = []
      for (let j = i + 1; j < bodyLines.length && values.length < 80; j++) {
        const value = bodyLines[j]
        if (isSpecLabel(value) || isSpecStop(value) || isParamKey(value)) break
        if (value.length <= 120 && !/^[￥¥]?\d+(?:\.\d+)?$/.test(value)) values.push(value)
      }
      if (values.length) addLineSpecGroup(label, values)
    }
    for (const label of specLabels) {
      if (attributes[label]) addLineSpecGroup(label, [attributes[label]])
    }
    for (let i = specGroups.length - 1; i >= 0; i--) {
      const group = specGroups[i]
      const details = (group.optionDetails || [])
        .filter((item) => item.name && !ignoredOptionText.has(item.name) && !specLabels.has(item.name))
        .filter((item) => !item.name.includes('\u52a0\u8d2d') && !item.name.includes('\u70ed\u9500') && !item.name.includes('\u63a8\u8350'))
      if (details.length === 0) specGroups.splice(i, 1)
      else {
        group.optionDetails = details
        group.options = details.map((item) => item.name)
        group.selected = details.find((item) => item.selected)?.name || group.selected || ''
      }
    }

    const brand = attributes[BRAND_KEY] || ''
    const model = attributes[MODEL_KEY] || attributes[ITEM_NO_KEY] || attributes[APPLICABLE_MODEL_KEY] || attributes['\u4e09\u661f\u578b\u53f7'] || ''
    selectedSpecs.splice(0, selectedSpecs.length, ...specGroups
      .filter((group) => group.selected)
      .map((group) => ({ name: group.name, value: group.selected })))
    const selectedSpecMap = Object.fromEntries(selectedSpecs.map((item) => [item.name, item.value]))
    const skuImages = {}
    for (const group of specGroups) {
      for (const item of group.optionDetails || []) {
        if (item.image) skuImages[item.name] = item.image
      }
    }
    const skuSpecs = specGroups.map((group) => ({ name: group.name, values: group.options }))
    const skuData = [{ code: skuId || itemId, model, specs: selectedSpecMap }]

    const scrapedData = {
      title,
      brand,
      model,
      specs: attributes,
      attributes,
      sourceUrl: location.href,
      itemId,
      skuId,
      images: mainImages.slice(0, 12),
      detailImages: detailImages.slice(0, 60),
      selectedSaleSpecs: selectedSpecs,
      specGroups,
      skuImages,
      skuSpecs,
      skuData
    }

    return {
      sourceUrl: location.href,
      itemId,
      skuId,
      title,
      brand,
      model,
      images: mainImages.slice(0, 12),
      detailImages: detailImages.slice(0, 60),
      attributes,
      selectedSpecs,
      specGroups,
      scrapedData
    }
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
