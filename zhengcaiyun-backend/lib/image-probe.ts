export type ProbedImage = {
  width: number
  height: number
  type: 'jpeg' | 'png' | 'webp' | 'gif' | 'unknown'
  byteSize: number | null
}

type ProbeOptions = {
  maxBytes?: number
  timeoutMs?: number
  referer?: string
}

const DEFAULT_MAX_BYTES = 64 * 1024
const DEFAULT_TIMEOUT_MS = 8000

function parseTotalSizeFromHeaders(headers: Headers): number | null {
  const contentRange = headers.get('content-range')
  if (contentRange) {
    const match = contentRange.match(/\/(\d+)\s*$/)
    if (match) {
      const n = Number.parseInt(match[1], 10)
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  const contentLength = headers.get('content-length')
  if (contentLength) {
    const n = Number.parseInt(contentLength, 10)
    if (Number.isFinite(n) && n > 0) return n
  }

  return null
}

async function readAtMost(response: Response, maxBytes: number): Promise<Buffer> {
  if (!response.body) {
    const ab = await response.arrayBuffer()
    return Buffer.from(ab).subarray(0, maxBytes)
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let total = 0

  while (total < maxBytes) {
    const { value, done } = await reader.read()
    if (done) break
    if (!value || value.byteLength === 0) continue

    const remaining = maxBytes - total
    if (value.byteLength <= remaining) {
      chunks.push(Buffer.from(value))
      total += value.byteLength
      continue
    }

    chunks.push(Buffer.from(value.subarray(0, remaining)))
    total += remaining
    break
  }

  try {
    await reader.cancel()
  } catch {}

  return Buffer.concat(chunks, total)
}

function parsePng(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24) return null
  const signature = buffer.subarray(0, 8)
  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!signature.equals(pngSig)) return null
  const width = buffer.readUInt32BE(16)
  const height = buffer.readUInt32BE(20)
  if (!width || !height) return null
  return { width, height }
}

function parseGif(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 10) return null
  const header = buffer.subarray(0, 6).toString('ascii')
  if (header !== 'GIF87a' && header !== 'GIF89a') return null
  const width = buffer.readUInt16LE(6)
  const height = buffer.readUInt16LE(8)
  if (!width || !height) return null
  return { width, height }
}

function parseWebp(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 30) return null
  if (buffer.subarray(0, 4).toString('ascii') !== 'RIFF') return null
  if (buffer.subarray(8, 12).toString('ascii') !== 'WEBP') return null

  const chunkType = buffer.subarray(12, 16).toString('ascii')

  if (chunkType === 'VP8X') {
    if (buffer.length < 30) return null
    const w =
      1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16))
    const h =
      1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16))
    if (!w || !h) return null
    return { width: w, height: h }
  }

  if (chunkType === 'VP8 ') {
    const start = 20
    if (buffer.length < start + 10) return null
    // Start code: 0x9D 0x01 0x2A
    if (buffer[start + 3] !== 0x9d || buffer[start + 4] !== 0x01 || buffer[start + 5] !== 0x2a) return null
    const width = buffer.readUInt16LE(start + 6) & 0x3fff
    const height = buffer.readUInt16LE(start + 8) & 0x3fff
    if (!width || !height) return null
    return { width, height }
  }

  if (chunkType === 'VP8L') {
    const start = 20
    if (buffer.length < start + 5) return null
    if (buffer[start] !== 0x2f) return null
    const bits = buffer.readUInt32LE(start + 1)
    const width = (bits & 0x3fff) + 1
    const height = ((bits >> 14) & 0x3fff) + 1
    if (!width || !height) return null
    return { width, height }
  }

  return null
}

function isJpegStart(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8
}

function parseJpeg(buffer: Buffer): { width: number; height: number } | null {
  if (!isJpegStart(buffer)) return null

  // https://www.w3.org/Graphics/JPEG/itu-t81.pdf (SOF markers)
  const SOF = new Set([
    0xc0, 0xc1, 0xc2, 0xc3,
    0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb,
    0xcd, 0xce, 0xcf
  ])

  let offset = 2
  while (offset + 4 <= buffer.length) {
    // Find 0xFF marker
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    // Skip fill bytes 0xFF
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1
    if (offset >= buffer.length) break

    const marker = buffer[offset]
    offset += 1

    // Standalone markers without length
    if (marker === 0xd8 || marker === 0xd9) continue
    if (marker >= 0xd0 && marker <= 0xd7) continue

    if (offset + 2 > buffer.length) break
    const segmentLength = buffer.readUInt16BE(offset)
    offset += 2
    if (segmentLength < 2) break

    if (SOF.has(marker)) {
      if (offset + 5 > buffer.length) break
      // const precision = buffer[offset]
      const height = buffer.readUInt16BE(offset + 1)
      const width = buffer.readUInt16BE(offset + 3)
      if (!width || !height) return null
      return { width, height }
    }

    offset += segmentLength - 2
  }

  return null
}

function parseImageDimensions(buffer: Buffer): { width: number; height: number; type: ProbedImage['type'] } | null {
  const png = parsePng(buffer)
  if (png) return { ...png, type: 'png' }

  const gif = parseGif(buffer)
  if (gif) return { ...gif, type: 'gif' }

  const webp = parseWebp(buffer)
  if (webp) return { ...webp, type: 'webp' }

  const jpeg = parseJpeg(buffer)
  if (jpeg) return { ...jpeg, type: 'jpeg' }

  return null
}

function buildHeaders(url: string, maxBytes: number, referer?: string): Record<string, string> {
  let origin = ''
  try {
    origin = new URL(url).origin
  } catch {}

  return {
    Range: `bytes=0-${Math.max(0, maxBytes - 1)}`,
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    Referer: referer || origin
  }
}

export async function probeRemoteImage(url: string, options: ProbeOptions = {}): Promise<ProbedImage | null> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS

  try {
    // Validate URL early
    // eslint-disable-next-line no-new
    new URL(url)
  } catch {
    return null
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: buildHeaders(url, maxBytes, options.referer),
      signal: controller.signal
    })

    if (!response.ok) return null

    const byteSize = parseTotalSizeFromHeaders(response.headers)
    const buffer = await readAtMost(response, maxBytes)
    const dims = parseImageDimensions(buffer)
    if (!dims) return null

    return { ...dims, byteSize }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
