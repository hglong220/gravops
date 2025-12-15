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

function safeUrlString(url: string): string {
  try {
    return new URL(url).toString()
  } catch {
    return url
  }
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
    } catch {}
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

  const cleaned = uniqKeepOrder(
    (Array.isArray(inputUrls) ? inputUrls : [])
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean)
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
      const candidates = uniqKeepOrder([
        platform === 'jd' ? normalizeJdImageUrl(stripped, targetSize) : stripped,
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
  if (kind === 'main' && filtered.length === 0) {
    const fallback = platform === 'jd' ? normalizeJdImageUrl(cleaned[0], targetSize) : cleaned[0]
    return [fallback].filter(Boolean).slice(0, maxCount)
  }

  return filtered
}
