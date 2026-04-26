import CryptoJS from "crypto-js"

export interface LicenseVerifyResult {
  valid: boolean
  error?: string
  code?: string
  bindUrl?: string
  companyName?: string
  expiresAt?: number
  plan?: string
  userId?: string | null
  maxDevices?: number
  currentDevices?: number
  boundCompanyName?: string
  submittedCompanyName?: string
  token?: string
}

export interface LicenseInfo {
  licenseKey: string
  companyName: string
  activatedAt?: number
  expiresAt?: number
  plan?: string
  status?: string
  userId?: string | null
  maxDevices?: number
  currentDevices?: number
}

async function getBackendUrl(): Promise<string> {
  const result = await chrome.storage.local.get(["apiUrl"])
  return (
    result.apiUrl ||
    process.env.PLASMO_PUBLIC_BACKEND_URL ||
    "http://localhost:3000"
  )
}

async function getOrCreateDeviceId(): Promise<string> {
  const result = await chrome.storage.local.get(["deviceId"])
  if (result.deviceId) return result.deviceId

  const newDeviceId = `device-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2)}`
  await chrome.storage.local.set({ deviceId: newDeviceId })
  return newDeviceId
}

// 兼容旧版本：曾把 license 加密存到 key=license
function decryptLegacyLicense(encrypted: string): {
  licenseKey: string
  companyName: string
} | null {
  try {
    const decrypted = CryptoJS.AES.decrypt(encrypted, "your-secret-key").toString(
      CryptoJS.enc.Utf8
    )
    const data = JSON.parse(decrypted)
    if (!data?.licenseKey || !data?.companyName) return null
    return { licenseKey: data.licenseKey, companyName: data.companyName }
  } catch {
    return null
  }
}

export async function storeLicense(
  licenseKey: string,
  companyName: string,
  token?: string
): Promise<void> {
  const deviceId = await getOrCreateDeviceId()

  const licenseInfo = {
    licenseKey,
    companyName,
    status: "active",
    activatedAt: Date.now()
  }

  await chrome.storage.local.set({
    licenseKey,
    licenseInfo,
    deviceId,
    ...(token ? { token } : {})
  })
}

export async function getStoredLicense(): Promise<LicenseInfo | null> {
  const result = await chrome.storage.local.get(["licenseKey", "licenseInfo", "license"])

  // 新版：明文存储 + licenseInfo
  if (result.licenseKey && result.licenseInfo?.companyName) {
    return {
      licenseKey: result.licenseKey,
      companyName: result.licenseInfo.companyName,
      activatedAt: result.licenseInfo.activatedAt,
      expiresAt: result.licenseInfo.expiresAt,
      plan: result.licenseInfo.plan,
      status: result.licenseInfo.status || "active",
      userId: result.licenseInfo.userId ?? null,
      maxDevices: result.licenseInfo.maxDevices,
      currentDevices: result.licenseInfo.currentDevices
    }
  }

  // 旧版：加密在 key=license
  if (typeof result.license === "string" && result.license.length > 0) {
    const legacy = decryptLegacyLicense(result.license)
    if (legacy) {
      // 自动迁移到新版存储结构
      await storeLicense(legacy.licenseKey, legacy.companyName)
      await chrome.storage.local.remove(["license"])
      return { ...legacy, status: "active", activatedAt: Date.now() }
    }
  }

  return null
}

export function extractZcyCompanyInfo(): { companyName: string } | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(
      "[class*='company'], [class*='corp'], [class*='supplier'], [class*='merchant'], .user-info, .account-info"
    )
  )

  for (const el of candidates) {
    const text = el.textContent?.trim()
    if (text && /公司|集团|商贸|科技|有限|供应商/.test(text)) {
      return { companyName: text.replace(/\s+/g, " ") }
    }
  }

  const bodyText = document.body?.innerText || ""
  const match = bodyText.match(/[\u4e00-\u9fa5A-Za-z0-9（）()]{2,80}(?:公司|集团|商贸|科技|有限公司|供应商)/)
  return match ? { companyName: match[0] } : null
}

export async function verifyLicense(
  licenseKey: string,
  currentCompanyName: string
): Promise<LicenseVerifyResult> {
  try {
    const apiUrl = await getBackendUrl()
    const deviceId = await getOrCreateDeviceId()

    const response = await fetch(`${apiUrl}/api/plugin/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        licenseKey,
        companyName: currentCompanyName,
        deviceId
      })
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok || !data?.valid) {
      return {
        valid: false,
        error: data?.error || "验证失败",
        code: data?.code,
        bindUrl: data?.bindUrl,
        plan: data?.plan,
        userId: data?.userId ?? null,
        maxDevices: data?.maxDevices,
        currentDevices: data?.currentDevices,
        boundCompanyName: data?.boundCompanyName,
        submittedCompanyName: data?.submittedCompanyName
      }
    }

    // 存储 token，供后续接口调用（fetchWithAuth）使用
    if (data.token) {
      await chrome.storage.local.set({ token: data.token })
    }

    return {
      valid: true,
      companyName: data.companyName,
      expiresAt: data.expiresAt,
      token: data.token,
      code: data?.code,
      bindUrl: data?.bindUrl,
      plan: data?.plan,
      userId: data?.userId ?? null,
      maxDevices: data?.maxDevices,
      currentDevices: data?.currentDevices
    }
  } catch (error) {
    console.error("[License] 验证请求失败:", error)
    return { valid: false, error: "网络错误，请检查连接" }
  }
}

export async function checkAuthorization(currentCompanyName: string): Promise<boolean> {
  const stored = await getStoredLicense()
  if (!stored) return false

  // 在线刷新 token + 校验
  const result = await verifyLicense(stored.licenseKey, currentCompanyName)
  return result.valid === true
}

export async function clearLicense(): Promise<void> {
  await chrome.storage.local.remove([
    "license",
    "licenseKey",
    "licenseInfo",
    "deviceId",
    "token"
  ])
}
