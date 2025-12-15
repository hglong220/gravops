'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Versions = {
    chrome: { version: string; date: string; size: string; link: string }
    windows: { version: string; date: string; size: string; link: string }
}

const DEFAULT_VERSIONS: Versions = {
    chrome: {
        version: 'v1.2.0',
        date: '2025-11-20',
        size: '2.5 MB',
        link: '#'
    },
    windows: {
        version: 'v1.0.5',
        date: '2025-11-15',
        size: '45.2 MB',
        link: '#'
    }
}

export default function DownloadsPage() {
    const router = useRouter()
    const [versions, setVersions] = useState<Versions>(DEFAULT_VERSIONS)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const token = localStorage.getItem('token')
        if (!token) {
            router.push('/login')
            return
        }

        ;(async () => {
            try {
                setError(null)
                const res = await fetch('/api/versions', {
                    headers: { Authorization: `Bearer ${token}` }
                })

                if (res.status === 401) {
                    localStorage.removeItem('token')
                    localStorage.removeItem('user')
                    router.push('/login')
                    return
                }

                const data = await res.json()
                if (data?.chrome?.version && data?.windows?.version) {
                    setVersions(data)
                } else {
                    setVersions(DEFAULT_VERSIONS)
                }
            } catch {
                setError('加载失败，请刷新重试')
                setVersions(DEFAULT_VERSIONS)
            } finally {
                setLoading(false)
            }
        })()
    }, [router])

    if (loading) return <div className="p-8 text-gray-500">Loading...</div>

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">{error}</div>
            )}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">软件下载</h1>
                <p className="text-sm text-gray-500 mt-1">获取最新版本的客户端和浏览器插件。</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chrome Extension */}
                <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col h-full">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                        <img src="/icon48.plasmo.aced7582.png" alt="Logo" className="w-8 h-8" />
                    </div>

                    <h2 className="text-xl font-bold text-gray-900">Chrome 浏览器插件</h2>
                    <p className="text-gray-500 mt-2 flex-1">
                        核心功能组件。直接在政采云网页上运行，提供自动化填写、AI识别和辅助上传功能。
                    </p>

                    <div className="mt-8 space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">当前版本</span>
                            <span className="font-mono font-bold">{versions.chrome.version}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">更新时间</span>
                            <span>{versions.chrome.date}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">文件大小</span>
                            <span>{versions.chrome.size}</span>
                        </div>

                        <a
                            href={versions.chrome.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-white border border-gray-200 text-gray-900 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            下载插件 (.zip)
                        </a>

                        <a href="#" className="block text-center text-sm text-gray-500 hover:text-black hover:underline">
                            查看安装教程
                        </a>
                    </div>
                </div>

                {/* Windows Client */}
                <div className="bg-white p-8 rounded-2xl border border-gray-200 flex flex-col h-full">
                    <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mb-6">
                        <svg className="w-8 h-8 text-purple-600" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
                        </svg>
                    </div>

                    <h2 className="text-xl font-bold text-gray-900">Windows 桌面客户端</h2>
                    <p className="text-gray-500 mt-2 flex-1">
                        用于管理本地任务、批量处理图片和监控上传状态。包含内置的 Chromium 浏览器环境。
                    </p>

                    <div className="mt-8 space-y-4">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">当前版本</span>
                            <span className="font-mono font-bold">{versions.windows.version}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">更新时间</span>
                            <span>{versions.windows.date}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-500">系统要求</span>
                            <span>Windows 10/11 (64-bit)</span>
                        </div>

                        <a
                            href={versions.windows.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full py-3 bg-white border border-gray-200 text-gray-900 rounded-xl font-medium hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            下载客户端 (.exe)
                        </a>

                        <a href="#" className="block text-center text-sm text-gray-500 hover:text-black hover:underline">
                            查看系统要求
                        </a>
                    </div>
                </div>
            </div>
        </div>
    )
}
