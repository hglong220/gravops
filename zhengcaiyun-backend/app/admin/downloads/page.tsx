'use client';

import { useState, useEffect } from 'react';

export default function AdminDownloadsPage() {
    const [versions, setVersions] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch('/api/admin/versions')
            .then(res => res.json())
            .then(data => {
                setVersions(data);
                setLoading(false);
            });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/admin/versions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(versions)
            });
            alert('保存成功');
        } catch (err) {
            alert('保存失败');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-gray-500">Loading...</div>;

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">软件发布管理</h1>
                    <p className="text-sm text-gray-500 mt-1">管理客户端和插件的版本信息及下载链接。</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-6 py-2 bg-black text-white rounded-xl font-bold hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                    {saving ? '保存中...' : '保存更改'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Chrome Extension Config */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                        Chrome 浏览器插件
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">版本号</label>
                            <input
                                type="text"
                                value={versions.chrome.version}
                                onChange={(e) => setVersions({ ...versions, chrome: { ...versions.chrome, version: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">更新日期</label>
                            <input
                                type="date"
                                value={versions.chrome.date}
                                onChange={(e) => setVersions({ ...versions, chrome: { ...versions.chrome, date: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">文件大小</label>
                            <input
                                type="text"
                                value={versions.chrome.size}
                                onChange={(e) => setVersions({ ...versions, chrome: { ...versions.chrome, size: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">下载链接 (URL)</label>
                            <input
                                type="text"
                                value={versions.chrome.link}
                                onChange={(e) => setVersions({ ...versions, chrome: { ...versions.chrome, link: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                </div>

                {/* Windows Client Config */}
                <div className="bg-white rounded-2xl border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                        Windows 客户端
                    </h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">版本号</label>
                            <input
                                type="text"
                                value={versions.windows.version}
                                onChange={(e) => setVersions({ ...versions, windows: { ...versions.windows, version: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">更新日期</label>
                            <input
                                type="date"
                                value={versions.windows.date}
                                onChange={(e) => setVersions({ ...versions, windows: { ...versions.windows, date: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">文件大小</label>
                            <input
                                type="text"
                                value={versions.windows.size}
                                onChange={(e) => setVersions({ ...versions, windows: { ...versions.windows, size: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">下载链接 (URL)</label>
                            <input
                                type="text"
                                value={versions.windows.link}
                                onChange={(e) => setVersions({ ...versions, windows: { ...versions.windows, link: e.target.value } })}
                                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/5"
                                placeholder="https://..."
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
