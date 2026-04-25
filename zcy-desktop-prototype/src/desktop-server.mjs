import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_DIR = path.join(ROOT, 'src', 'desktop-ui')
const PORT = Number(process.env.ZCY_DESKTOP_PORT || 5177)
const NODE = process.execPath

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'GET' && req.url === '/api/health') {
      return sendJson(res, 200, { ok: true })
    }

    if (req.method === 'POST' && req.url === '/api/read-jd') {
      const body = await readJsonBody(req)
      const url = String(body.url || '').trim()
      if (!isJdItemUrl(url)) {
        return sendJson(res, 400, { ok: false, error: '请输入有效的京东商品链接' })
      }
      const result = await runJdReader(url)
      return sendJson(res, 200, { ok: true, result })
    }

    if (req.method === 'GET') {
      return serveStatic(req, res)
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed' })
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message || String(error) })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ZCY Desktop Prototype running at http://127.0.0.1:${PORT}`)
})

function isJdItemUrl(raw) {
  try {
    const url = new URL(raw)
    return url.hostname === 'item.jd.com' && /\/\d+\.html$/.test(url.pathname)
  } catch {
    return false
  }
}

function runJdReader(url) {
  return new Promise((resolve, reject) => {
    const child = spawn(NODE, ['src/collect-jd-cdp.mjs', '--url', url], {
      cwd: ROOT,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGTERM')
      reject(new Error('京东页面读取超时'))
    }, 180_000)

    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code !== 0) {
        reject(new Error((stderr || stdout || `进程退出：${code}`).slice(0, 1000)))
        return
      }
      try {
        resolve(parseReaderOutput(stdout))
      } catch (error) {
        reject(error)
      }
    })
  })
}

function parseReaderOutput(stdout) {
  const start = stdout.indexOf('{')
  if (start < 0) throw new Error('没有读取到商品 JSON 结果')
  const parsed = JSON.parse(stdout.slice(start))
  const data = parsed.scrapedData || {}
  return {
    state: parsed.state || {},
    title: parsed.title || data.title || '',
    brand: parsed.brand || data.brand || '',
    model: parsed.model || data.model || '',
    skuId: data.skuId || parsed.product?.info?.skuId || '',
    sourceUrl: data.sourceUrl || parsed.state?.url || '',
    categoryPath: data.categoryPath || [],
    mainImages: data.images || [],
    detailImages: data.detailImages || [],
    attributes: data.attributes || data.specs || {},
    selectedSaleSpecs: data.selectedSaleSpecs || [],
    specGroups: data.specGroups || [],
    skuSpecs: data.skuSpecs || [],
    skuData: data.skuData || [],
    outputPath: parsed.outputPath || '',
    skuOutputPath: parsed.skuOutputPath || '',
    raw: data
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 1024 * 1024) {
        req.destroy()
        reject(new Error('请求内容过大'))
      }
    })
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {})
      } catch {
        reject(new Error('请求 JSON 格式错误'))
      }
    })
    req.on('error', reject)
  })
}

function serveStatic(req, res) {
  const reqUrl = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
  let filePath = reqUrl.pathname === '/'
    ? path.join(PUBLIC_DIR, 'index.html')
    : path.join(PUBLIC_DIR, decodeURIComponent(reqUrl.pathname))
  const resolved = path.resolve(filePath)
  if (!resolved.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, 'Forbidden')
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    filePath = path.join(PUBLIC_DIR, 'index.html')
  }
  const ext = path.extname(filePath)
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  })
  fs.createReadStream(filePath).pipe(res)
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(text)
}
