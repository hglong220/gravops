import { probeRemoteImage } from '@/lib/image-probe'

type FilterOptions = {
  platform?: string
  kind: 'main' | 'detail'
  minSize: number
  maxCount: number
  concurrency?: number
  targetSize?: number
}

function uniqKeepOrder(items: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const item of items) {
    if (seen.has(item)) continue
    seen.add(item)
    out.push(item)
  }
  return out
}

/**
 * 规范化图片 URL（止血级代码）
 * 处理：协议相对 URL、base64、javascript、空字符串等
 */
function normalizeImageUrlSafe(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null

  let url = raw.trim()

  // 丢弃明显非法的
  if (url === '' || url === '#' || url.startsWith('data:') || url.startsWith('javascript:')) {
    return null
  }

  // 协议相对 URL -> https
  if (url.startsWith('//')) {
    url = 'https:' + url
  }

  // 必须是 http(s) 开头
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return null
  }

  // 最终校验
  try {
    new URL(url)
    return url
  } catch {
    return null
  }
}

function safeUrlString(url: string): string {
  const normalized = normalizeImageUrlSafe(url)
  return normalized || url
}

function normalizeJdImageUrl(url: string, target: number): string {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('360buyimg.com')) return url
    const nextPath = u.pathname
      .replace(/s\d+x\d+_jfs/gi, `s${target}x${target}_jfs`)
      .replace(/s\d+x\d+_/gi, `s${target}x${target}_`)
    if (nextPath === u.pathname) return url
    u.pathname = nextPath
    return u.toString()
  } catch {
    return url
  }
}

/**
 * 规范化天猫/淘宝图片 URL，尝试获取原始大图
 * 阿里 CDN 图片 URL 通常带有尺寸后缀，如：
 * - _100x100.jpg
 * - _400x400.jpg
 * - _790x790.jpg
 * - _q90.jpg (质量)
 * 去除这些后缀可以获取原始大图
 */
function normalizeTmallImageUrl(url: string): string {
  try {
    const u = new URL(url)
    if (!u.hostname.includes('alicdn.com') && !u.hostname.includes('taobaocdn.com')) {
      return url
    }
    // 去除尺寸后缀，如 _100x100.jpg -> .jpg
    const nextPath = u.pathname
      .replace(/_\d+x\d+(?:q\d+)?\.(jpg|png|jpeg)$/i, '.$1')
      .replace(/_\d+x\d+\.(jpg|png|jpeg)$/i, '.$1')
      .replace(/_q\d+\.(jpg|png|jpeg)$/i, '.$1')
    if (nextPath === u.pathname) return url
    u.pathname = nextPath
    return u.toString()
  } catch {
    return url
  }
}


function stripModernFormatSuffix(url: string): string {
  try {
    const u = new URL(url)
    const nextPath = u.pathname.replace(/\.(avif|webp)$/i, '')
    if (nextPath === u.pathname) return url
    u.pathname = nextPath
    return u.toString()
  } catch {
    return url
  }
}

function isMaybeUselessByUrl(url: string): boolean {
  const u = url.toLowerCase()
  const base = u.split('?')[0].split('#')[0]

  if (base.endsWith('.avif')) return true
  if (base.endsWith('.webp')) return true
  if (base.endsWith('.svg')) return true
  if (base.endsWith('.gif')) return true

  // 天猫/淘宝小尺寸图片过滤（如 App 下载引导图，URL 中包含 tps-236-298 这样的尺寸标识）
  const tpsMatch = u.match(/tps-(\d+)-(\d+)/)
  if (tpsMatch) {
    const width = parseInt(tpsMatch[1], 10)
    const height = parseInt(tpsMatch[2], 10)
    if (width < 400 || height < 400) {
      return true
    }
  }

  // common non-product assets / UI icons
  const keywords = [
    'sprite',
    'icon',
    'logo',
    'avatar',
    'emoji',
    'emoticon',
    'smile',
    'face',
    'qrcode',
    'qr',
    'wxcode',
    'weixin',
    'alipay',
    'play',
    'video',
    'btn',
    'button',
    'loading',
    'placeholder'
  ]

  return keywords.some((k) => u.includes(k))
}

function defaultReferer(platform: string | undefined, imageUrl: string): string | undefined {
  if (platform === 'jd') {
    try {
      const u = new URL(imageUrl)
      if (u.hostname.includes('360buyimg.com')) return 'https://item.jd.com/'
    } catch { }
  }
  if (platform === 'tmall' || platform === 'taobao') {
    try {
      const u = new URL(imageUrl)
      if (u.hostname.includes('alicdn.com')) return 'https://detail.tmall.com/'
    } catch { }
  }
  return undefined
}

async function pMapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = next
      next += 1
      if (index >= items.length) break
      out[index] = await mapper(items[index], index)
    }
  })

  await Promise.all(workers)
  return out
}

export async function filterImageUrlsForUpload(inputUrls: string[], options: FilterOptions): Promise<string[]> {
  const {
    platform,
    kind,
    minSize,
    maxCount,
    concurrency = 5,
    targetSize = 900
  } = options

  // 先规范化所有 URL，过滤掉无效的（协议相对、base64 等）
  const normalizedUrls = (Array.isArray(inputUrls) ? inputUrls : [])
    .map(x => typeof x === 'string' ? normalizeImageUrlSafe(x) : null)
    .filter((x): x is string => x !== null)

  const cleaned = uniqKeepOrder(
    normalizedUrls
      .slice(0, Math.max(maxCount * 3, 30))
      .map(safeUrlString)
  )

  if (cleaned.length === 0) return []

  const minBytes = kind === 'main' ? 12_000 : 8_000

  const results = await pMapLimit(
    cleaned,
    concurrency,
    async (originalUrl): Promise<string | null> => {
      const stripped = stripModernFormatSuffix(originalUrl)

      // 根据平台尝试获取更大尺寸的图片
      let normalizedUrl = stripped
      if (platform === 'jd') {
        normalizedUrl = normalizeJdImageUrl(stripped, targetSize)
      } else if (platform === 'tmall' || platform === 'taobao') {
        normalizedUrl = normalizeTmallImageUrl(stripped)
      }

      const candidates = uniqKeepOrder([
        normalizedUrl,
        stripped,
        originalUrl
      ])

      for (const candidate of candidates) {
        if (!candidate) continue
        if (isMaybeUselessByUrl(candidate)) continue

        const probe = await probeRemoteImage(candidate, {
          referer: defaultReferer(platform, candidate)
        })

        if (!probe) continue
        if (probe.type === 'gif' || probe.type === 'webp') continue

        if (probe.width < minSize || probe.height < minSize) continue
        if (probe.byteSize != null && probe.byteSize < minBytes) continue

        return candidate
      }

      return null
    }
  )

  const filtered = uniqKeepOrder(
    results
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      .map((x) => x.trim())
  ).slice(0, maxCount)

  // Never return empty main images: keep at least one original (still helps UI not crash).
  // 但确保不使用明显无效的图片（如 tps 小图）作为 fallback
  if (kind === 'main' && filtered.length === 0) {
    // 找到第一个不是无用图片的 URL 作为 fallback
    const validFallback = cleaned.find(url => !isMaybeUselessByUrl(url))
    if (validFallback) {
      let fallback = validFallback
      if (platform === 'jd') {
        fallback = normalizeJdImageUrl(validFallback, targetSize)
      } else if (platform === 'tmall' || platform === 'taobao') {
        fallback = normalizeTmallImageUrl(validFallback)
      }
      return [fallback].filter(Boolean).slice(0, maxCount)
    }
    // 如果所有图片都无效，返回空数组而不是无效图片
    return []
  }

  return filtered
}
