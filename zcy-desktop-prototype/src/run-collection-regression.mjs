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
    label: 'JD 得力中性笔',
    url: 'https://item.jd.com/100010050091.html',
    min: { mainImages: 3, detailImages: 5, parameterCount: 5, specGroups: 1 },
    required: ['brand', 'model']
  },
  {
    id: 'jd-paper-tango',
    platform: 'jd',
    label: 'JD 天章复印纸',
    url: 'https://item.jd.com/1195207.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 5, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-paper-baiwang-single',
    platform: 'jd',
    label: 'JD 百旺复印纸单品',
    url: 'https://item.jd.com/100053288192.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 5, specGroups: 0 },
    required: ['brand']
  },
  {
    id: 'jd-paper-baiwang-red',
    platform: 'jd',
    label: 'JD 红百旺复印纸',
    url: 'https://item.jd.com/1657408.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 5, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-hp-toner-230a',
    platform: 'jd',
    label: 'JD HP 硒鼓',
    url: 'https://item.jd.com/29475495099.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand', 'model']
  },
  {
    id: 'jd-hp-consumable',
    platform: 'jd',
    label: 'JD HP 耗材店铺',
    url: 'https://item.jd.com/10153717614531.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-960-toner',
    platform: 'jd',
    label: 'JD 玖六零硒鼓',
    url: 'https://item.jd.com/100145834020.html',
    min: { mainImages: 3, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'jd-siege-toner',
    platform: 'jd',
    label: 'JD 赛格硒鼓',
    url: 'https://item.jd.com/67357465267.html',
    min: { mainImages: 2, detailImages: 8, parameterCount: 8, specGroups: 1 },
    required: ['brand', 'model']
  },
  {
    id: 'tb-shaver-superman',
    platform: 'taobao',
    label: '淘宝 超人剃须刀',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=591576115249&mi_id=0000tpPLQkgTYm1kadN6QCTvXyf5xSKAaWPsIHbtTUlR8Ug&ns=1&priceTId=214780e117770507293611357e11ce&skuId=4954757636116&spm=a21n57.1.item.1&utparam=%7B%22aplus_abtest%22%3A%223051ad45efabdabef5feded99d9e9c51%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 8, specGroups: 1 },
    required: ['brand']
  },
  {
    id: 'tb-shaver-manual',
    platform: 'taobao',
    label: '淘宝 手动剃须刀',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=847258646571&mi_id=0000jz07P8Qn6cVrd4T8hlRxafG9N7zt2GyKT0SiGv-DKkc&ns=1&priceTId=214780e117770507293611357e11ce&skuId=5800772523522&spm=a21n57.1.item.2&utparam=%7B%22aplus_abtest%22%3A%220dcd0e7954236ff49e33e07c68095403%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 4, specGroups: 0 },
    required: ['model']
  },
  {
    id: 'tmall-low-info',
    platform: 'taobao',
    label: '天猫 低信息量样本',
    url: 'https://detail.tmall.com/item.htm?abbucket=14&id=991054613002&mi_id=0000_AQb0BPVyYzyplXC65Z7n6mF1k2zp_vdRO0uGf7ixfs&ns=1&priceTId=214780e117770507399161672e11ce&spm=a21n57.1.item.1&utparam=%7B%22aplus_abtest%22%3A%22fe2ff69259488e732d76eb16a427c711%22%7D&xxc=taobaoSearch',
    min: { mainImages: 1, detailImages: 1, parameterCount: 1, specGroups: 0 },
    required: ['brand']
  },
  {
    id: 'tb-gift-logistics',
    platform: 'taobao',
    label: '淘宝 礼品物流',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=810274059864&mi_id=0000m-XmiRzBKltommo1Py4Tobnm_RSik0y_iaOfAKexFW8&ns=1&priceTId=214780e117770507399161672e11ce&skuId=5670221330465&spm=a21n57.1.item.2&utparam=%7B%22aplus_abtest%22%3A%226cdb6b1d2f106863d8187a20e1fd0fb5%22%7D&xxc=taobaoSearch',
    min: { mainImages: 2, detailImages: 1, parameterCount: 1, specGroups: 1 },
    required: []
  },
  {
    id: 'tb-socks-playboy',
    platform: 'taobao',
    label: '淘宝 花花公子袜子',
    url: 'https://item.taobao.com/item.htm?abbucket=14&id=645490095703&mi_id=0000pqAJ94VDY6aSOWZQTq9jd9o7iwpnD-jWnnd3OCd_llY&ns=1&priceTId=214780e117770507609582258e11ce&skuId=4646054785438&spm=a21n57.1.item.1&utparam=%7B%22aplus_abtest%22%3A%227141b3f0a53d7273000e128b3bcbde3e%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 8, specGroups: 2 },
    required: ['brand']
  },
  {
    id: 'tmall-socks-yuzhaolin',
    platform: 'taobao',
    label: '天猫 俞兆林袜子',
    url: 'https://detail.tmall.com/item.htm?abbucket=14&id=885829219462&mi_id=0000mN9OPFMxVloB5P6udsNk06MlRSHV9G_FtMrp5h8vc4Y&ns=1&priceTId=214780e117770507609582258e11ce&skuId=5895288018881&spm=a21n57.1.item.2&utparam=%7B%22aplus_abtest%22%3A%223d01b7f856740b7898e59c7ff931991a%22%7D&xxc=taobaoSearch',
    min: { mainImages: 3, detailImages: 5, parameterCount: 8, specGroups: 2 },
    required: ['brand']
  },
  {
    id: 'tb-samsung-phone',
    platform: 'taobao',
    label: '淘宝 三星手机多规格',
    url: 'https://item.taobao.com/item.htm?id=921393353319&mi_id=0000BhbKpp6a_ihvr62sHLok7Kfw5FhfquQ7p-b60R1ov2w&pvid=8946c914-810d-4192-89e3-b118f36c74bc&scm=1007.40986.467924.0&skuId=5796564497160&spm=a21bo.tmall%2Fa.201876.d25.7216c3d5fjfSEj&xxc=home_recommend',
    min: { mainImages: 3, detailImages: 5, parameterCount: 12, specGroups: 4, selectedSpecCount: 4 },
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
  for (const [field, min] of Object.entries(sample.min || {})) {
    const actual = field === 'selectedSpecCount'
      ? Number(data.selectedSpecs?.length || 0)
      : Number(data[field] ?? 0)
    if (actual < min) failures.push(`${field} ${actual} < ${min}`)
  }
  for (const field of sample.required || []) {
    if (!String(data[field] || '').trim()) failures.push(`${field} empty`)
  }
  return failures
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
