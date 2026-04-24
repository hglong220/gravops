import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const USER_DATA_DIR = path.join(ROOT, '.browser-profile')
const OUTPUT_DIR = path.join(ROOT, 'output')

const args = process.argv.slice(2)
const urlArg = args.find((arg) => arg.startsWith('--url='))
const url = urlArg ? urlArg.slice('--url='.length) : args[args.indexOf('--url') + 1]

if (!url) {
  console.error('Usage: pnpm collect:jd -- --url https://item.jd.com/100011969414.html')
  process.exit(1)
}

function chooseChannel() {
  return process.env.ZCY_BROWSER_CHANNEL || 'msedge'
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })

  const imageRequests = new Set()

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: chooseChannel(),
    headless: false,
    viewport: { width: 1440, height: 1000 },
    ignoreDefaultArgs: [
      '--enable-automation'
    ],
    args: [
      '--disable-dev-shm-usage'
    ]
  })

  const page = context.pages()[0] || await context.newPage()

  page.on('requestfinished', async (request) => {
    const requestUrl = request.url()
    if (requestUrl.includes('360buyimg.com')) {
      imageRequests.add(requestUrl)
    }
  })

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)

  const title = await page.title()
  if (title.includes('欢迎登录') || page.url().includes('passport.jd.com')) {
    console.log('当前浏览器跳到了京东登录页。请在打开的浏览器里完成登录。登录完成后回到这里按回车继续采集。')
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    await rl.question('登录完成后按回车继续...')
    rl.close()
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => undefined)
  }

  const product = await collectJdProduct(page, imageRequests)

  const outputPath = path.join(OUTPUT_DIR, 'jd-collection-result.json')
  fs.writeFileSync(outputPath, JSON.stringify(product, null, 2), 'utf8')

  console.log(JSON.stringify({
    title: product.title,
    mainImages: product.mainImages.length,
    detailImages: product.detailImages.length,
    mainSamples: product.mainImages.slice(0, 10),
    detailSamples: product.detailImages.slice(0, 10),
    outputPath
  }, null, 2))

  await context.close()
}

async function collectJdProduct(page, imageRequests) {
  await page.waitForSelector('.sku-name, #spec-list, .spec-items', { timeout: 20_000 }).catch(() => undefined)

  await preloadMainThumbnails(page)
  const title = await page.locator('.sku-name, .itemInfo-wrap h1, .p-name').first().textContent({ timeout: 5_000 }).catch(() => '')
  const mainImages = await extractMainImages(page)

  const detailImages = await extractDetailImages(page, imageRequests, mainImages)

  return {
    sourceUrl: page.url(),
    title: String(title || '').trim(),
    mainImages,
    detailImages,
    collectedAt: new Date().toISOString()
  }
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

    const normalizeJdImage = (raw) => {
      let url = String(raw || '').trim()
      if (!url || url.startsWith('data:')) return null
      if (url.startsWith('//')) url = `https:${url}`
      if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/n1${url}`
      if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/n1/${url}`
      if (/^s\d+x\d+_jfs\//i.test(url)) url = `https://img10.360buyimg.com/n1/${url}`

      try {
        url = new URL(url, location.href).href
      } catch {
        return null
      }

      if (!url.includes('360buyimg.com')) return null

      url = url
        .replace(/\.(avif|webp)$/i, '')
        .replace(/\/s\d+x\d+_jfs\//gi, '/n1/jfs/')
        .replace(/\/s\d+x\d+_/gi, '/n1/')
        .replace(/\/n\d+\//gi, '/n1/')

      return url
    }

    const add = (raw) => {
      const url = normalizeJdImage(raw)
      if (!url || seen.has(url)) return
      seen.add(url)
      out.push(url)
    }

    const selectors = [
      '#spec-list img',
      '.spec-items img',
      '.lh img',
      '#spec-n1 img',
      '.preview img'
    ]

    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((img) => {
        add(
          img.getAttribute('data-url') ||
          img.getAttribute('data-origin') ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-lazy-img') ||
          img.currentSrc ||
          img.src
        )
      })
    }

    const pageJson = window.imageAndVideoJson
    if (Array.isArray(pageJson)) {
      for (const item of pageJson) {
        if (item && (item.type === undefined || item.type === 1)) {
          add(item.img || item.imgUrl || item.url)
        }
      }
    }

    return out.slice(0, 12)
  })
}

async function extractDetailImages(page, imageRequests, mainImages) {
  await openDetailTab(page)
  await scrollDetailArea(page)

  return page.evaluate((mainImagesFromNode) => {
    const seen = new Set()
    const out = []
    const mainSet = new Set(mainImagesFromNode || [])

    const normalizeJdImage = (raw) => {
      let url = String(raw || '').trim()
      if (!url || url.startsWith('data:')) return null
      if (url.startsWith('//')) url = `https:${url}`
      if (url.startsWith('/jfs/')) url = `https://img10.360buyimg.com/ssd/${url.replace(/^\/+/, '')}`
      if (url.startsWith('jfs/')) url = `https://img10.360buyimg.com/ssd/${url}`

      try {
        url = new URL(url, location.href).href
      } catch {
        return null
      }

      if (!url.includes('360buyimg.com')) return null

      url = url
        .replace(/\.(avif|webp)$/i, '')
        .replace(/\/s\d+x\d+_jfs\//gi, '/ssd/jfs/')

      return url
    }

    const isUsefulDetail = (url) => {
      const lower = url.toLowerCase()
      if (mainSet.has(url)) return false
      if (lower.includes('qrcode') || lower.includes('logo') || lower.includes('avatar')) return false
      if (lower.includes('/shaidan/') || lower.includes('comment')) return false
      if (lower.includes('recommend') || lower.includes('guess') || lower.includes('shop')) return false
      return true
    }

    const add = (raw) => {
      const url = normalizeJdImage(raw)
      if (!url || seen.has(url) || !isUsefulDetail(url)) return
      seen.add(url)
      out.push(url)
    }

    const containers = [
      '#graphic-content',
      '#J-detail-content',
      '#J-detail',
      '#detail .tab-con',
      '.detail-content',
      '.ssd-module-detail'
    ]

    for (const selector of containers) {
      const container = document.querySelector(selector)
      if (!container) continue
      container.querySelectorAll('img').forEach((img) => {
        add(
          img.getAttribute('data-lazyload') ||
          img.getAttribute('data-src') ||
          img.getAttribute('data-original') ||
          img.currentSrc ||
          img.src
        )
      })
      if (out.length > 0) break
    }

    return out.slice(0, 60)
  }, mainImages)
}

async function openDetailTab(page) {
  await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('li, a, span, div'))
    const tab = nodes.find((node) => {
      const text = (node.textContent || '').trim()
      return text === '商品详情' || text === '详情' || text.includes('商品详情')
    })
    if (tab instanceof HTMLElement) tab.click()
  }).catch(() => undefined)
  await sleep(600)
}

async function scrollDetailArea(page) {
  await page.evaluate(() => {
    const root =
      document.querySelector('#graphic-content') ||
      document.querySelector('#J-detail-content') ||
      document.querySelector('#detail') ||
      document.body
    root.scrollIntoView({ block: 'start' })
  }).catch(() => undefined)

  for (let i = 0; i < 8; i++) {
    await page.mouse.wheel(0, 900)
    await sleep(450)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
