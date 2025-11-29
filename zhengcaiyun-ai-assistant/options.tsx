import { useState, useEffect } from "react"
import "./style.css"

export default function Options() {
    const [apiUrl, setApiUrl] = useState("http://localhost:3000")
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [token, setToken] = useState("")
    const [status, setStatus] = useState("")

    useEffect(() => {
        chrome.storage.local.get(["apiUrl", "token", "email"], (result) => {
            if (result.apiUrl) setApiUrl(result.apiUrl)
            if (result.token) setToken(result.token)
            if (result.email) setEmail(result.email)
        })
    }, [])

    const handleSave = () => {
        chrome.storage.local.set({ apiUrl }, () => {
            setStatus("设置已保存")
            setTimeout(() => setStatus(""), 2000)
        })
    }

    const handleLogin = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            })
            const data = await res.json()

            if (res.ok) {
                chrome.storage.local.set({ token: data.token, email: data.user.email }, () => {
                    setToken(data.token)
                    setStatus("登录成功")
                    setTimeout(() => setStatus(""), 2000)
                })
            } else {
                setStatus(`登录失败: ${data.error}`)
            }
        } catch (error) {
            setStatus(`登录出错: ${(error as Error).message}`)
        }
    }

    const handleLogout = () => {
        chrome.storage.local.remove(["token", "email"], () => {
            setToken("")
            setEmail("")
            setPassword("")
            setStatus("已退出登录")
            setTimeout(() => setStatus(""), 2000)
        })
    }

    return (
        <div className="p-8 max-w-md mx-auto">
            <h1 className="text-2xl font-bold mb-6">政采云助手设置</h1>

            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    后端 API 地址
                </label>
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        className="flex-1 border border-gray-300 rounded px-3 py-2"
                        placeholder="http://localhost:3000"
                    />
                    <button
                        onClick={handleSave}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
                    >
                        保存
                    </button>
                </div>
            </div>

            <hr className="my-6 border-gray-200" />

            <div className="mb-6">
                <h2 className="text-lg font-semibold mb-4">账号登录</h2>
                {token ? (
                    <div className="bg-green-50 border border-green-200 rounded p-4">
                        <p className="text-green-800 mb-2">已登录: {email}</p>
                        <button
                            onClick={handleLogout}
                            className="text-sm text-red-600 hover:text-red-800 underline"
                        >
                            退出登录
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full border border-gray-300 rounded px-3 py-2"
                            />
                        </div>
                        <button
                            onClick={handleLogin}
                            className="w-full bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                        >
                            登录
                        </button>
                    </div>
                )}
            </div>

            {status && (
                <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow-lg">
                    {status}
                </div>
            )}
        </div>
    )
}
