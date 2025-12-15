import { useState, useEffect } from "react"
import "./style.css"

export default function Options() {
    const [apiUrl, setApiUrl] = useState("http://localhost:3000")
    const [licenseKey, setLicenseKey] = useState("")
    const [companyName, setCompanyName] = useState("")
    const [isActivated, setIsActivated] = useState(false)
    const [licenseInfo, setLicenseInfo] = useState<any>(null)
    const [status, setStatus] = useState("")

    useEffect(() => {
        // 加载已保存的配置
        chrome.storage.local.get(["apiUrl", "licenseKey", "licenseInfo"], (result) => {
            if (result.apiUrl) setApiUrl(result.apiUrl)
            if (result.licenseKey) {
                setLicenseKey(result.licenseKey)
                setIsActivated(true)
            }
            if (result.licenseInfo) {
                setLicenseInfo(result.licenseInfo)
                setCompanyName(result.licenseInfo.companyName)
            }
        })
    }, [])

    const normalizeApiUrl = (input: string) => input.trim().replace(/\/+$/, "")

    const isLocalHostname = (hostname: string) =>
        hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"

    const ensureHostPermission = async (baseUrl: string) => {
        const normalized = normalizeApiUrl(baseUrl)
        const origin = new URL(normalized).origin
        const pattern = `${origin}/*`

        const alreadyGranted = await new Promise<boolean>((resolve) => {
            chrome.permissions.contains({ origins: [pattern] }, resolve)
        })

        if (alreadyGranted) return true

        return new Promise<boolean>((resolve) => {
            chrome.permissions.request({ origins: [pattern] }, (granted) => resolve(!!granted))
        })
    }

    const handleSaveApiUrl = async () => {
        try {
            const normalized = normalizeApiUrl(apiUrl)
            const url = new URL(normalized)

            if (url.protocol !== "https:" && !isLocalHostname(url.hostname)) {
                setStatus("❌ 生产环境必须使用 HTTPS（本地 localhost 可用 http）")
                setTimeout(() => setStatus(""), 5000)
                return
            }

            // 非本地域名需要用户授权 host 权限（否则插件无法访问你的服务器）
            if (!isLocalHostname(url.hostname)) {
                const granted = await ensureHostPermission(normalized)
                if (!granted) {
                    setStatus("❌ 未授权访问该后端域名，请在弹窗中点击允许")
                    setTimeout(() => setStatus(""), 5000)
                    return
                }
            }

            chrome.storage.local.set({ apiUrl: normalized }, () => {
                setApiUrl(normalized)
                setStatus("✅ API地址已保存")
                setTimeout(() => setStatus(""), 2000)
            })
        } catch (error) {
            setStatus("❌ API地址格式不正确，请输入完整 URL（如 https://example.com）")
            setTimeout(() => setStatus(""), 5000)
        }
    }

    const handleActivate = async () => {
        if (!licenseKey || !companyName) {
            setStatus("请输入授权码和公司名称")
            return
        }

        try {
            setStatus("正在验证授权码...")

            const normalizedApiUrl = normalizeApiUrl(apiUrl)
            const url = new URL(normalizedApiUrl)
            if (url.protocol !== "https:" && !isLocalHostname(url.hostname)) {
                setStatus("❌ 生产环境必须使用 HTTPS（本地 localhost 可用 http）")
                setTimeout(() => setStatus(""), 5000)
                return
            }

            if (!isLocalHostname(url.hostname)) {
                const granted = await ensureHostPermission(normalizedApiUrl)
                if (!granted) {
                    setStatus("❌ 未授权访问该后端域名，请在弹窗中点击允许")
                    setTimeout(() => setStatus(""), 5000)
                    return
                }
            }

            // 生成设备ID（唯一标识这个浏览器）
            const deviceId = await getDeviceId()

            const res = await fetch(`${normalizedApiUrl}/api/plugin/session`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    licenseKey,
                    companyName,
                    deviceId
                })
            })

            const data = await res.json()

            if (res.ok && data.valid) {
                // 保存授权信息
                const licenseData = {
                    licenseKey,
                    companyName: data.companyName,
                    plan: data.plan,
                    expiresAt: data.expiresAt,
                    userId: data.userId,
                    activatedAt: Date.now()
                }

                chrome.storage.local.set({
                    licenseKey,
                    licenseInfo: licenseData,
                    deviceId,
                    token: data.token
                }, () => {
                    setIsActivated(true)
                    setLicenseInfo(licenseData)
                    setCompanyName(data.companyName)
                    setStatus("✅ 授权激活成功！")
                    setTimeout(() => setStatus(""), 3000)
                })
            } else {
                setStatus(`❌ 激活失败: ${data.error || '未知错误'}`)
                setTimeout(() => setStatus(""), 5000)
            }
        } catch (error) {
            setStatus(`❌ 连接失败: ${(error as Error).message}`)
            setTimeout(() => setStatus(""), 5000)
        }
    }

    const handleDeactivate = () => {
        chrome.storage.local.remove(["licenseKey", "licenseInfo", "deviceId", "token"], () => {
            setIsActivated(false)
            setLicenseInfo(null)
            setLicenseKey("")
            setCompanyName("")
            setStatus("已取消授权")
            setTimeout(() => setStatus(""), 2000)
        })
    }

    // 生成唯一设备ID
    const getDeviceId = async (): Promise<string> => {
        return new Promise((resolve) => {
            chrome.storage.local.get(["deviceId"], (result) => {
                if (result.deviceId) {
                    resolve(result.deviceId)
                } else {
                    // 生成新的设备ID
                    const newDeviceId = `device-${Date.now()}-${Math.random().toString(36).substring(7)}`
                    chrome.storage.local.set({ deviceId: newDeviceId })
                    resolve(newDeviceId)
                }
            })
        })
    }

    // 格式化日期
    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleDateString('zh-CN')
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
                    <div className="flex items-center gap-4">
                        <img src="/logo.png" alt="Logo" className="w-16 h-16 rounded-lg bg-white p-2" />
                        <div>
                            <h1 className="text-2xl font-bold">政采云智能助手</h1>
                            <p className="text-blue-100 text-sm mt-1">AI驱动的自动化工具</p>
                        </div>
                    </div>
                </div>

                <div className="p-8">
                    {/* API设置 */}
                    <div className="mb-8">
                        <label className="block text-sm font-semibold text-gray-700 mb-3">
                            🌐 后端服务地址
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={apiUrl}
                                onChange={(e) => setApiUrl(e.target.value)}
                                className="flex-1 border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none transition"
                                placeholder="http://localhost:3000"
                            />
                            <button
                                onClick={handleSaveApiUrl}
                                className="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition font-medium"
                            >
                                保存
                            </button>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 my-8"></div>

                    {/* 授权激活 */}
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                            <span className="text-2xl">🔑</span>
                            授权管理
                        </h2>

                        {isActivated && licenseInfo ? (
                            // 已激活状态
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-2xl">✅</span>
                                            <h3 className="text-lg font-bold text-green-800">授权已激活</h3>
                                        </div>
                                        <p className="text-green-700 text-sm">您的授权码已成功验证</p>
                                    </div>
                                    <button
                                        onClick={handleDeactivate}
                                        className="text-sm text-red-600 hover:text-red-800 underline font-medium"
                                    >
                                        取消授权
                                    </button>
                                </div>

                                <div className="space-y-3 mt-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 font-medium">公司名称</span>
                                        <span className="text-gray-900 font-semibold">{licenseInfo.companyName}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 font-medium">套餐类型</span>
                                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">
                                            {licenseInfo.plan === 'enterprise' ? '企业版' :
                                                licenseInfo.plan === 'professional' ? '专业版' :
                                                    licenseInfo.plan === 'standard' ? '标准版' : '基础版'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 font-medium">到期时间</span>
                                        <span className="text-gray-900 font-semibold">{formatDate(licenseInfo.expiresAt)}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-gray-600 font-medium">授权码</span>
                                        <span className="font-mono text-sm text-gray-700">{licenseKey}</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // 未激活状态
                            <div className="space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        📧 公司名称 *
                                    </label>
                                    <input
                                        type="text"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 focus:border-blue-500 focus:outline-none transition"
                                        placeholder="请输入您的公司名称"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                                        🔐 授权码 *
                                    </label>
                                    <input
                                        type="text"
                                        value={licenseKey}
                                        onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                                        className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 font-mono focus:border-blue-500 focus:outline-none transition"
                                        placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        💡 在网站购买后获得授权码
                                    </p>
                                </div>

                                <button
                                    onClick={handleActivate}
                                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 transition font-bold text-lg shadow-lg"
                                >
                                    🚀 激活授权
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* 状态提示 */}
            {status && (
                <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-4 rounded-xl shadow-2xl animate-slide-up max-w-md">
                    <p className="font-medium">{status}</p>
                </div>
            )}
        </div>
    )
}
