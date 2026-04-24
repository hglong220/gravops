import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUTPUT_DIR = path.join(ROOT, 'output')
const NODE = process.execPath

const args = process.argv.slice(2)
const onlyPlatform = valueOf('--platform')
const limit = Number(valueOf('--limit') || 0)
const failFast = args.includes('--fail-fast')

const samples = [
  {
    id: 'jd-pen-deli',
    platform: 'jd',
    label: 'JD deli gel pen',
    url: 'https://item.jd.com/100010050091.html',
    min: { mainImages: 3, detailImages: 5, parameterCount: 5, specGroups: 1 },
    required: ['brand', 'model']
  },
  {
    id: 'jd-paper-tango',
    platform: 'jd',
    label: 'JD tango copy paper',
    url: 'https://item.jd.com/1195207.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 5, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-paper-baiwang-single',
    platform: 'jd',
    label: 'JD baiwang copy paper single',
    url: 'https://item.jd.com/100053288192.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 5, specGroups: 0 },
    required: ['brand']
  },
  {
    id: 'jd-paper-baiwang-red',
    platform: 'jd',
    label: 'JD red baiwang copy paper',
    url: 'https://item.jd.com/1657408.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 5, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-hp-toner-230a',
    platform: 'jd',
    label: 'JD HP toner',
    url: 'https://item.jd.com/29475495099.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand', 'model']
  },
  {
    id: 'jd-hp-consumable',
    platform: 'jd',
    label: 'JD HP consumable store',
    url: 'https://item.jd.com/10153717614531.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-960-toner',
    platform: 'jd',
    label: 'JD 960 toner',
    url: 'https://item.jd.com/100145834020.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-siege-toner',
    platform: 'jd',
    label: 'JD siege toner',
    url: 'https://item.jd.com/67357465267.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand', 'model']
  },
  {
    id: 'jd-deli-pen-real',
    platform: 'jd',
    label: 'JD deli pen real sample',
    url: 'https://item.jd.com/100007188565.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 5, specGroups: 2 },
    required: ['brand', 'model']
  },
  {
    id: 'jd-office-clips-real',
    platform: 'jd',
    label: 'JD office clips real sample',
    url: 'https://item.jd.com/100069291185.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 4, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-folder-real',
    platform: 'jd',
    label: 'JD folder real sample',
    url: 'https://item.jd.com/24221663767.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-store-detail-short',
    platform: 'jd',
    label: 'JD store detail short sample',
    url: 'https://item.jd.com/10184951211794.html',
    min: { mainImages: 3, detailImages: 2, parameterCount: 8, specGroups: 2 },
    required: ['brand']
  },
  {
    id: 'tb-shaver-superman',
    platform: 'taobao',
    label: 'Taobao superman shaver',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=591576115249&mi_id=0000tpPLQkgTYm1kadN6QCTvXyf5xSKAaWPsIHbtTUlR8Ug&ns=1&priceTId=214780e117770507293611357e11ce&skuId=4954757636116&spm=a21n57.1.item.1&utparam=%7B%22aplus_abtest%22%3A%223051ad45efabdabef5feded99d9e9c51%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 8, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'tb-shaver-manual',
    platform: 'taobao',
    label: 'Taobao manual shaver',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=847258646571&mi_id=0000jz07P8Qn6cVrd4T8hlRxafG9N7zt2GyKT0SiGv-DKkc&ns=1&priceTId=214780e117770507293611357e11ce&skuId=5800772523522&spm=a21n57.1.item.2&utparam=%7B%22aplus_abtest%22%3A%220dcd0e7954236ff49e33e07c68095403%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 4, specGroups: 0 },
    required: ['model']
  },
  {
    id: 'tmall-low-info',
    platform: 'taobao',
    label: 'Tmall low-info sample',
    url: 'https://detail.tmall.com/item.htm?abbucket=14&id=991054613002&mi_id=0000_AQb0BPVyYzyplXC65Z7n6mF1k2zp_vdRO0uGf7ixfs&ns=1&priceTId=214780e117770507399161672e11ce&spm=a21n57.1.item.1&utparam=%7B%22aplus_abtest%22%3A%22fe2ff69259488e732d76eb16a427c711%22%7D&xxc=taobaoSearch',
    min: { mainImages: 1, detailImages: 1, parameterCount: 1, specGroups: 0 },
    required: ['brand']
  },
  {
    id: 'tb-gift-logistics',
    platform: 'taobao',
    label: 'Taobao gift logistics',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=810274059864&mi_id=0000m-XmiRzBKltommo1Py4Tobnm_RSik0y_iaOfAKexFW8&ns=1&priceTId=214780e117770507399161672e11ce&skuId=5670221330465&spm=a21n57.1.item.2&utparam=%7B%22aplus_abtest%22%3A%226cdb6b1d2f106863d8187a20e1fd0fb5%22%7D&xxc=taobaoSearch',
    min: { mainImages: 2, detailImages: 1, parameterCount: 1, specGroups: 1 },
    required: []
  },
  {
    id: 'tb-socks-playboy',
    platform: 'taobao',
    label: 'Taobao playboy socks',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=645490095703&mi_id=0000pqAJ94VDY6aSOWZQTq9jd9o7iwpnD-jWnnd3OCd_llY&ns=1&priceTId=214780e117770507609582258e11ce&skuId=4646054785438&spm=a21n57.1.item.1&utparam=%7B%22aplus_abtest%22%3A%227141b3f0a53d7273000e128b3bcbde3e%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 8, specGroups: 2 },
    required: ['brand']
  },
  {
    id: 'tmall-socks-yuzhaolin',
    platform: 'taobao',
    label: 'Tmall yuzhaolin socks',
    url: 'https://detail.tmall.com/item.htm?abbucket=14&id=885829219462&mi_id=0000mN9OPFMxVloB5P6udsNk06MlRSHV9G_FtMrp5h8vc4Y&ns=1&priceTId=214780e117770507609582258e11ce&skuId=5895288018881&spm=a21n57.1.item.2&utparam=%7B%22aplus_abtest%22%3A%223d01b7f856740b7898e59c7ff931991a%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 8, specGroups: 2 },
    required: ['brand']
  },
  {
    id: 'tb-samsung-phone',
    platform: 'taobao',
    label: 'Taobao Samsung phone multi-spec',
    url: 'https://item.taobao.com/item.htm?id=921393353319&mi_id=0000BhbKpp6a_ihvr62sHLok7Kfw5FhfquQ7p-b60R1ov2w&pvid=8946c914-810d-4192-89e3-b118f36c74bc&scm=1007.40986.467924.0&skuId=5796564497160&spm=a21bo.tmall%2Fa.201876.d25.7216c3d5fjfSEj&xxc=home_recommend',
    min: { mainImages: 3, detailImages: 5, parameterCount: 12, specGroups: 4, selectedSpecCount: 4 },
    required: ['brand', 'model']
  },
  {
    id: 'tb-samsung-battery-real',
    platform: 'taobao',
    label: 'Taobao Samsung battery real sample',
    url: 'https://item.taobao.com/item.htm?id=853914137091&mi_id=0000FEvU8O2p5eo0TVi0r9DhCh0bwWBiPh5ud9YUNdNliH8&pvid=8946c914-810d-4192-89e3-b118f36c74bc&scm=1007.40986.467924.0&skuId=5655745985219&spm=a21bo.tmall%2Fa.201876.d1.7216c3d5fjfSEj&xxc=home_recommend',
    min: { mainImages: 3, detailImages: 8, parameterCount: 8, specGroups: 1, selectedSpecCount: 1 },
    required: ['brand', 'model']
  },
  {
    id: 'tmall-mainboard-real',
    platform: 'taobao',
    label: 'Tmall mainboard real sample',
    url: 'https://detail.tmall.com/item.htm?id=832257628838&mi_id=0000JSrv4Bk_zaFZsTmfAxr-jHZo1InYni5OHd5cHdieIdQ&pvid=8946c914-810d-4192-89e3-b118f36c74bc&scm=1007.40986.467924.0&skuId=6148818450301&spm=a21bo.tmall%2Fa.201876.d14.7216c3d5fjfSEj&xxc=home_recommend',
    min: { mainImages: 3, detailImages: 8, parameterCount: 2, specGroups: 1, selectedSpecCount: 1 },
    required: ['brand', 'model']
  }
]

function valueOf(name) {
  const direct = args.find((arg) => arg.startsWith(`${name}=`))
  if (direct) return direct.slice(name.length + 1)
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : ''
}

function collectorFor(platform) {
  return platform === 'jd' ? 'src/collect-jd-cdp.mjs' : 'src/collect-taobao-cdp.mjs'
}

function parseCollectorOutput(stdout) {
  const start = stdout.indexOf('{')
  if (start < 0) throw new Error('collector did not print JSON')
  return JSON.parse(stdout.slice(start))
}

function evaluate(sample, data) {
  const failures = []
  const title = String(data.title || data.state?.title || '')
  if (/登录|登陆|欢迎登录/i.test(title)) failures.push('login required')
  for (const [field, min] of Object.entries(sample.min || {})) {
    const actual = field === 'selectedSpecCount'
      ? Number(data.selectedSpecs?.length || 0)
      : Number(data[field] ?? 0)
    if (actual < min) failures.push(`${field} ${actual} < ${min}`)
  }
  for (const field of sample.required || []) {
    if (!String(data[field] || '').trim()) failures.push(`${field} empty`)
  }
  failures.push(...evaluateCoreShape(data))
  return failures
}

function evaluateCoreShape(data) {
  const failures = []
  const scrapedData = data.scrapedData || {}
  const images = Array.isArray(scrapedData.images) ? scrapedData.images : []
  const detailImages = Array.isArray(scrapedData.detailImages) ? scrapedData.detailImages : []
  const specGroups = Array.isArray(scrapedData.specGroups) ? scrapedData.specGroups : []
  const selectedSpecs = Array.isArray(data.selectedSpecs)
    ? data.selectedSpecs
    : Array.isArray(scrapedData.selectedSaleSpecs) ? scrapedData.selectedSaleSpecs : []

  if (images.length && new Set(images).size !== images.length) failures.push('main image duplicates')
  if (detailImages.length && new Set(detailImages).size !== detailImages.length) failures.push('detail image duplicates')
  for (const [index, url] of images.entries()) {
    if (!isValidImageUrl(url)) failures.push(`main image ${index + 1} invalid`)
  }
  for (const [index, url] of detailImages.entries()) {
    if (!isValidImageUrl(url)) failures.push(`detail image ${index + 1} invalid`)
  }

  const groupsByName = new Map(specGroups.map((group) => [String(group.name || ''), group]))
  for (const selected of selectedSpecs) {
    const name = String(selected?.name || '')
    const value = String(selected?.value || '')
    if (!name || !value) {
      failures.push('selected spec missing name or value')
      continue
    }
    const group = groupsByName.get(name)
    if (!group) {
      failures.push(`selected spec group missing: ${name}`)
      continue
    }
    const options = Array.isArray(group.options) ? group.options.map(String) : []
    if (!options.includes(value)) failures.push(`selected spec not in options: ${name}`)
  }

  return failures
}

function isValidImageUrl(raw) {
  try {
    const url = new URL(String(raw || ''))
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    if (!/\.(jpg|jpeg|png|gif)(?:$|\?)/i.test(url.pathname)) return false
    return !/data:|avatar|getavatar|qrcode|sprite|logo|icon/i.test(url.href)
  } catch {
    return false
  }
}

function compactResult(sample, data, failures, elapsedMs) {
  return {
    id: sample.id,
    label: sample.label,
    platform: sample.platform,
    ok: failures.length === 0,
    failures,
    elapsedMs,
    title: data.title || '',
    brand: data.brand || '',
    model: data.model || '',
    mainImages: Number(data.mainImages ?? 0),
    detailImages: Number(data.detailImages ?? 0),
    parameterCount: Number(data.parameterCount ?? 0),
    specGroups: Number(data.specGroups ?? 0),
    skuSpecs: Number(data.skuSpecs ?? 0),
    selectedSpecCount: Number(data.selectedSpecs?.length || 0),
    url: data.url || sample.url
  }
}

function printTable(results) {
  const rows = results.map((item) => ({
    ok: item.ok ? 'OK' : 'FAIL',
    id: item.id,
    platform: item.platform,
    main: item.mainImages,
    detail: item.detailImages,
    params: item.parameterCount,
    specs: item.specGroups,
    selected: item.selectedSpecCount,
    brand: item.brand || '-',
    model: item.model || '-',
    failures: item.failures.join('; ')
  }))
  console.table(rows)
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

let selected = samples
if (onlyPlatform) selected = selected.filter((sample) => sample.platform === onlyPlatform)
if (limit > 0) selected = selected.slice(0, limit)

const startedAt = new Date()
const results = []

for (const sample of selected) {
  const script = collectorFor(sample.platform)
  const started = Date.now()
  console.log(`\n[collect] ${sample.id} ${sample.label}`)
  const run = spawnSync(NODE, [script, '--url', sample.url], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 150_000
  })
  const elapsedMs = Date.now() - started

  if (run.error || run.status !== 0) {
    const message = run.error?.message || run.stderr || run.stdout || `exit ${run.status}`
    results.push({
      id: sample.id,
      label: sample.label,
      platform: sample.platform,
      ok: false,
      failures: [String(message).slice(0, 500)],
      elapsedMs,
      title: '',
      brand: '',
      model: '',
      mainImages: 0,
      detailImages: 0,
      parameterCount: 0,
      specGroups: 0,
      skuSpecs: 0,
      selectedSpecCount: 0,
      url: sample.url
    })
    if (failFast) break
    continue
  }

  try {
    const data = parseCollectorOutput(run.stdout)
    const failures = evaluate(sample, data)
    results.push(compactResult(sample, data, failures, elapsedMs))
    if (failFast && failures.length) break
  } catch (error) {
    results.push({
      id: sample.id,
      label: sample.label,
      platform: sample.platform,
      ok: false,
      failures: [error.message],
      elapsedMs,
      title: '',
      brand: '',
      model: '',
      mainImages: 0,
      detailImages: 0,
      parameterCount: 0,
      specGroups: 0,
      skuSpecs: 0,
      selectedSpecCount: 0,
      url: sample.url
    })
    if (failFast) break
  }
}

const summary = {
  startedAt: startedAt.toISOString(),
  finishedAt: new Date().toISOString(),
  total: results.length,
  passed: results.filter((item) => item.ok).length,
  failed: results.filter((item) => !item.ok).length,
  results
}

const outputPath = path.join(OUTPUT_DIR, 'collection-regression-summary.json')
fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2), 'utf8')

printTable(results)
console.log(`\nSummary: ${summary.passed}/${summary.total} passed`)
console.log(`Output: ${outputPath}`)

if (summary.failed > 0) process.exitCode = 1
