import crypto from 'crypto'
import Redis from 'ioredis'

type Purpose = 'register'

type Store = {
  setCode: (key: string, hash: string, ttlMs: number) => Promise<void>
  getCode: (key: string) => Promise<string | null>
  deleteKey: (key: string) => Promise<void>
  incr: (key: string, ttlMs: number) => Promise<number>
}

let redisClient: Redis | null = null

function getRedisClient(): Redis | null {
  if (process.env.AUTH_CODE_DISABLE_REDIS === '1') return null
  if (redisClient) return redisClient

  const redisUrl = process.env.REDIS_URL
  const redisHost = process.env.REDIS_HOST || 'localhost'
  const redisPort = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379

  try {
    redisClient = redisUrl
      ? new Redis(redisUrl, { maxRetriesPerRequest: null, retryStrategy: () => null })
      : new Redis({
          host: redisHost,
          port: redisPort,
          maxRetriesPerRequest: null,
          retryStrategy: () => null
        })

    redisClient.on('error', (err) => {
      console.error('[AuthCode] Redis error:', err)
    })

    return redisClient
  } catch (err) {
    console.error('[AuthCode] Failed to init Redis:', err)
    redisClient = null
    return null
  }
}

const memoryStore = new Map<string, { value: string; expiresAt: number }>()
const memoryCounter = new Map<string, { count: number; expiresAt: number }>()

function createMemoryStore(): Store {
  return {
    setCode: async (key, hash, ttlMs) => {
      memoryStore.set(key, { value: hash, expiresAt: Date.now() + ttlMs })
    },
    getCode: async (key) => {
      const existing = memoryStore.get(key)
      if (!existing) return null
      if (Date.now() >= existing.expiresAt) {
        memoryStore.delete(key)
        return null
      }
      return existing.value
    },
    deleteKey: async (key) => {
      memoryStore.delete(key)
      memoryCounter.delete(key)
    },
    incr: async (key, ttlMs) => {
      const existing = memoryCounter.get(key)
      const now = Date.now()
      if (!existing || now >= existing.expiresAt) {
        memoryCounter.set(key, { count: 1, expiresAt: now + ttlMs })
        return 1
      }
      existing.count += 1
      memoryCounter.set(key, existing)
      return existing.count
    }
  }
}

function createStore(): Store {
  const client = getRedisClient()
  const mem = createMemoryStore()

  if (!client) return mem

  // Redis is optional: if it fails, fall back to in-memory so dev can run without Redis.
  return {
    setCode: async (key, hash, ttlMs) => {
      try {
        await client.set(key, hash, 'PX', ttlMs)
      } catch {
        await mem.setCode(key, hash, ttlMs)
      }
    },
    getCode: async (key) => {
      try {
        const val = await client.get(key)
        if (typeof val === 'string') return val
      } catch {
        // ignore
      }
      return mem.getCode(key)
    },
    deleteKey: async (key) => {
      try {
        await client.del(key)
      } catch {
        // ignore
      }
      await mem.deleteKey(key)
    },
    incr: async (key, ttlMs) => {
      try {
        const count = await client.incr(key)
        if (count === 1) {
          await client.pexpire(key, ttlMs)
        }
        return count
      } catch {
        return mem.incr(key, ttlMs)
      }
    }
  }
}

function hashCode(code: string): string {
  const secret = process.env.AUTH_CODE_SECRET || process.env.JWT_SECRET || 'dev_auth_code_secret'
  return crypto.createHash('sha256').update(`${secret}:${code}`).digest('hex')
}

function codeKey(purpose: Purpose, phone: string) {
  return `auth_code:${purpose}:${phone}`
}

function attemptsKey(purpose: Purpose, phone: string) {
  return `auth_code_attempts:${purpose}:${phone}`
}

export function generateSixDigitCode(): string {
  const n = crypto.randomInt(0, 1000000)
  return String(n).padStart(6, '0')
}

export async function storePhoneCode(opts: {
  phone: string
  purpose: Purpose
  code: string
  ttlMs?: number
}): Promise<void> {
  const ttlMs = opts.ttlMs ?? 5 * 60 * 1000
  const store = createStore()
  await store.setCode(codeKey(opts.purpose, opts.phone), hashCode(opts.code), ttlMs)
  await store.deleteKey(attemptsKey(opts.purpose, opts.phone))
}

export async function verifyPhoneCode(opts: {
  phone: string
  purpose: Purpose
  code: string
  ttlMs?: number
  maxAttempts?: number
}): Promise<boolean> {
  const ttlMs = opts.ttlMs ?? 5 * 60 * 1000
  const maxAttempts = opts.maxAttempts ?? 5
  const store = createStore()

  const storedHash = await store.getCode(codeKey(opts.purpose, opts.phone))
  if (!storedHash) return false

  const attempts = await store.incr(attemptsKey(opts.purpose, opts.phone), ttlMs)
  if (attempts > maxAttempts) {
    await store.deleteKey(codeKey(opts.purpose, opts.phone))
    await store.deleteKey(attemptsKey(opts.purpose, opts.phone))
    return false
  }

  const ok = storedHash === hashCode(opts.code)
  if (!ok) return false

  await store.deleteKey(codeKey(opts.purpose, opts.phone))
  await store.deleteKey(attemptsKey(opts.purpose, opts.phone))
  return true
}
